import 'server-only'
import type Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getPriceMap } from '@/lib/stripe-config'
import { getCommissionConfig, type CommissionConfigData } from './config'
import { periodOf, studioCommission, callerCommission, bonusCrossings } from './engine'
import { amountsForCharge } from './stripe-fees'

// Event-based commission writers. Every write is idempotent via the
// CommissionEvent unique key (stripePaymentId, recipientType, recipientId,
// type) + createMany skipDuplicates, so Stripe webhook retries never double-pay.

// --- helpers ---------------------------------------------------------------

// The studio (= Influencer) a user is referred by: the ReferredUser row if we
// have one, else the first-touch ReferralAttribution (studio = influencer).
async function resolveStudioId(email: string): Promise<string | null> {
  const ru = await prisma.referredUser.findUnique({ where: { userEmail: email }, select: { studioId: true } })
  if (ru) return ru.studioId
  const attr = await prisma.referralAttribution.findUnique({ where: { userEmail: email }, select: { influencerId: true } })
  return attr?.influencerId ?? null
}

async function invoiceEmail(invoice: Stripe.Invoice): Promise<string | null> {
  if (invoice.customer_email) return invoice.customer_email.toLowerCase()
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return null
  try {
    const c = await stripe.customers.retrieve(customerId)
    if (!('deleted' in c) && c.email) return c.email.toLowerCase()
  } catch {
    /* ignore */
  }
  return null
}

// Best-effort charge id across Stripe API shapes; fee/net just fall back to
// gross if we can't find it, so a payment is never dropped.
function invoiceChargeId(invoice: Stripe.Invoice): string | null {
  const c = (invoice as unknown as { charge?: string | { id: string } | null }).charge
  if (c) return typeof c === 'string' ? c : c.id
  return null
}

function invoicePlan(invoice: Stripe.Invoice): 'solo' | 'master' | null {
  const line = invoice.lines?.data?.[0] as unknown as { price?: { id?: string } | null } | undefined
  const priceId = line?.price?.id
  if (!priceId) return null
  const meta = getPriceMap()[priceId]
  return meta ? meta.plan : null
}

// --- activation + bonus ----------------------------------------------------

// A studio activates when its FIRST referred user completes a full paying
// month. Crossing a bonus threshold credits the caller once.
async function creditBonusForCaller(callerId: string, cfg: CommissionConfigData): Promise<void> {
  const newCount = await prisma.influencer.count({ where: { callerId, activatedDate: { not: null } } })
  const crossings = bonusCrossings(newCount - 1, newCount, cfg)
  if (!crossings.length) return
  const period = periodOf(new Date())
  await prisma.commissionEvent.createMany({
    data: crossings.map((threshold) => ({
      stripePaymentId: `bonus-${callerId}-${threshold}`,
      recipientType: 'caller' as const,
      recipientId: callerId,
      amountGross: 0,
      stripeFee: 0,
      amountNet: 0,
      rateApplied: 0,
      amount: cfg.bonusAmount,
      period,
      type: 'bonus' as const,
      notes: `Bonus: reached ${threshold} activated studios`,
    })),
    skipDuplicates: true,
  })
}

// Mark a referred user activated and, if it's the studio's first activation,
// stamp the studio + run the caller's bonus check.
async function activateReferredUser(email: string, cfg: CommissionConfigData): Promise<void> {
  const ru = await prisma.referredUser.findUnique({ where: { userEmail: email }, select: { activated: true, status: true, studioId: true } })
  if (!ru || ru.status !== 'active') return
  if (!ru.activated) await prisma.referredUser.update({ where: { userEmail: email }, data: { activated: true } })
  const studio = await prisma.influencer.findUnique({ where: { id: ru.studioId }, select: { activatedDate: true, callerId: true } })
  if (studio && !studio.activatedDate) {
    await prisma.influencer.update({ where: { id: ru.studioId }, data: { activatedDate: new Date() } })
    if (studio.callerId) await creditBonusForCaller(studio.callerId, cfg)
  }
}

// --- public entry points ---------------------------------------------------

// invoice.payment_succeeded → commission events. Two disjoint paths:
//  A) the payer IS a studio the caller onboarded → caller earns 18% on the
//     studio's OWN subscription for 12 months (the studio does not earn on
//     itself);
//  B) the payer is a customer referred by a studio → studio 20% lifetime +
//     that studio's caller 18% within the customer's 12-month window.
export async function recordInvoicePayment(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.id) return
  const email = await invoiceEmail(invoice)
  if (!email) return

  const grossPaid = (invoice.amount_paid ?? 0) / 100
  if (grossPaid <= 0) return
  const paidAt = new Date((invoice.created ?? Math.floor(Date.now() / 1000)) * 1000)
  const { gross, fee, net } = await amountsForCharge(invoiceChargeId(invoice), grossPaid)
  const cfg = await getCommissionConfig()
  const period = periodOf(paidAt)

  // Path A: the payer is a studio onboarded by a caller (matched by email).
  const ownStudio = await prisma.influencer.findFirst({
    where: { email, callerId: { not: null } },
    select: { id: true, callerId: true, firstPaidAt: true },
  })
  if (ownStudio?.callerId) {
    const firstPaid = ownStudio.firstPaidAt ?? paidAt
    if (!ownStudio.firstPaidAt) await prisma.influencer.update({ where: { id: ownStudio.id }, data: { firstPaidAt: paidAt } })
    const cc = callerCommission(gross, cfg, firstPaid, paidAt)
    if (cc.amount > 0) {
      await prisma.commissionEvent.createMany({
        data: [{
          stripePaymentId: invoice.id, stripeInvoiceId: invoice.id,
          recipientType: 'caller', recipientId: ownStudio.callerId, referredUserEmail: email,
          amountGross: gross, stripeFee: fee, amountNet: net, rateApplied: cc.rate, amount: cc.amount,
          period, type: 'commission', notes: 'Caller commission on studio own subscription',
        }],
        skipDuplicates: true,
      })
    }
    return // studio's own payment handled; never also treat it as a referred customer
  }

  // Path B: referred customer.
  const studioId = await resolveStudioId(email)
  if (!studioId) return // organic / not studio-referred

  const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null
  const plan = invoicePlan(invoice)

  // Lock attribution / first payment. First payment date anchors the window.
  const existing = await prisma.referredUser.findUnique({ where: { userEmail: email } })
  const firstPaymentDate = existing?.firstPaymentDate ?? paidAt
  await prisma.referredUser.upsert({
    where: { userEmail: email },
    create: {
      userEmail: email,
      studioId,
      plan: plan ?? existing?.plan ?? 'solo',
      stripeCustomerId,
      firstPaymentDate: paidAt,
      status: 'active',
    },
    update: {
      status: 'active',
      ...(stripeCustomerId ? { stripeCustomerId } : {}),
      ...(plan ? { plan } : {}),
      firstPaymentDate,
    },
  })

  const rows: Prisma.CommissionEventCreateManyInput[] = []

  const sc = studioCommission(gross, cfg, firstPaymentDate, paidAt)
  if (sc.amount > 0) {
    rows.push({
      stripePaymentId: invoice.id, stripeInvoiceId: invoice.id,
      recipientType: 'studio', recipientId: studioId, referredUserEmail: email,
      amountGross: gross, stripeFee: fee, amountNet: net, rateApplied: sc.rate, amount: sc.amount,
      period, type: 'commission',
    })
  }

  const studioRow = await prisma.influencer.findUnique({ where: { id: studioId }, select: { callerId: true } })
  if (studioRow?.callerId) {
    const cc = callerCommission(gross, cfg, firstPaymentDate, paidAt)
    if (cc.amount > 0) {
      rows.push({
        stripePaymentId: invoice.id, stripeInvoiceId: invoice.id,
        recipientType: 'caller', recipientId: studioRow.callerId, referredUserEmail: email,
        amountGross: gross, stripeFee: fee, amountNet: net, rateApplied: cc.rate, amount: cc.amount,
        period, type: 'commission',
      })
    }
  }

  if (rows.length) await prisma.commissionEvent.createMany({ data: rows, skipDuplicates: true })

  // A monthly renewal is a completed paying month → activate immediately.
  // (Annual + 30-day activation is handled by the daily cron.)
  if (invoice.billing_reason === 'subscription_cycle') {
    await activateReferredUser(email, cfg)
  }
}

// charge.refunded / charge.dispute.created → negative clawback events that
// reverse the studio + caller commissions for the original payment.
export async function recordChargeReversal(invoiceId: string | null, reason: 'refund' | 'dispute'): Promise<void> {
  if (!invoiceId) return
  const originals = await prisma.commissionEvent.findMany({ where: { stripePaymentId: invoiceId, type: 'commission' } })
  if (!originals.length) return
  const period = periodOf(new Date())
  await prisma.commissionEvent.createMany({
    data: originals.map((o) => ({
      stripePaymentId: o.stripePaymentId, stripeInvoiceId: o.stripeInvoiceId,
      recipientType: o.recipientType, recipientId: o.recipientId, referredUserEmail: o.referredUserEmail,
      amountGross: -o.amountGross, stripeFee: -o.stripeFee, amountNet: -o.amountNet,
      rateApplied: o.rateApplied, amount: -o.amount, period, type: 'clawback',
      notes: `Clawback (${reason}) of ${o.recipientType} commission`,
    })),
    skipDuplicates: true,
  })
  const email = originals[0]?.referredUserEmail
  if (email) await prisma.referredUser.updateMany({ where: { userEmail: email }, data: { status: 'refunded' } })
}

// Mark a referred user's subscription state (from subscription.deleted, etc.),
// so the activation cron never activates a lapsed user.
export async function setReferredUserStatus(email: string, status: 'active' | 'canceled' | 'refunded'): Promise<void> {
  await prisma.referredUser.updateMany({ where: { userEmail: email.toLowerCase() }, data: { status } })
}

// Daily cron: activate any active, not-yet-activated referred user who has been
// paying for 30+ days (covers annual plans and any missed monthly signal).
export async function activateEligibleReferredUsers(): Promise<number> {
  const cfg = await getCommissionConfig()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const due = await prisma.referredUser.findMany({
    where: { activated: false, status: 'active', firstPaymentDate: { not: null, lte: cutoff } },
    select: { userEmail: true },
  })
  for (const u of due) await activateReferredUser(u.userEmail, cfg)
  return due.length
}
