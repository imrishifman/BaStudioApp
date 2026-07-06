import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

export const maxDuration = 20
export const runtime = 'nodejs'
// Always fetch fresh data; polling endpoint should never be cached.
export const dynamic = 'force-dynamic'

// Normalize a dollar amount charged for one billing period to per-month,
// based on the subscription's billing interval.
function periodAmountToMonthly(amount: number, price: Stripe.Price | null | undefined): number {
  const count = price?.recurring?.interval_count || 1
  switch (price?.recurring?.interval) {
    case 'year': return amount / (12 * count)
    case 'month': return amount / count
    case 'week': return (amount * 52) / 12 / count
    case 'day': return (amount * 365) / 12 / count
    default: return 0
  }
}

// Money actually COLLECTED on a subscription's most recent invoice. This is the
// source of truth for "paid": gifted/comped accounts (100% off), trials, and
// lapsed-coupon subscriptions whose renewal invoice was never actually paid all
// have amount_paid = 0 and are excluded, regardless of the list price.
function latestPaidAmount(sub: Stripe.Subscription): number {
  const raw = (sub as unknown as { latest_invoice?: string | Stripe.Invoice | null }).latest_invoice
  if (!raw || typeof raw === 'string') return 0
  if (raw.status !== 'paid') return 0
  return (raw.amount_paid ?? 0) / 100
}

interface StripeSubsSummary {
  paidMembers: number
  soloActive: number
  masterActive: number
  mrr: number
  error: string | null
}

// Source of truth for revenue: money actually collected by Stripe (the latest
// invoice's amount_paid), NOT the local DB and NOT the subscription list price.
// A subscription counts as a paid member only when Stripe reports its most
// recent invoice as PAID with a real amount. Paginates so we never miss anyone.
async function computeStripeSubscriptions(): Promise<StripeSubsSummary> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { paidMembers: 0, soloActive: 0, masterActive: 0, mrr: 0, error: 'Stripe not configured' }
  }
  const soloPrices = new Set(
    [process.env.STRIPE_PRICE_SOLO_MONTHLY, process.env.STRIPE_PRICE_SOLO_ANNUAL].filter(Boolean),
  )
  const masterPrices = new Set(
    [process.env.STRIPE_PRICE_MASTER_MONTHLY, process.env.STRIPE_PRICE_MASTER_ANNUAL].filter(Boolean),
  )

  let paidMembers = 0
  let soloActive = 0
  let masterActive = 0
  let mrr = 0
  let startingAfter: string | undefined

  try {
    // Cap pages defensively so a runaway loop can't stall the polling cycle.
    for (let page = 0; page < 20; page++) {
      const res = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        expand: ['data.latest_invoice'],
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })

      for (const sub of res.data) {
        // Collected cash only: $0 latest invoice (gift, comp, trial, or an
        // unpaid renewal) means NOT a paid member, whatever the list price.
        const paid = latestPaidAmount(sub)
        if (paid <= 0.001) continue
        const monthly = periodAmountToMonthly(paid, sub.items.data[0]?.price)
        if (monthly <= 0.001) continue
        let plan: 'solo' | 'master' | null = null
        for (const item of sub.items.data) {
          if (soloPrices.has(item.price.id)) plan = 'solo'
          else if (masterPrices.has(item.price.id)) plan = 'master'
        }
        paidMembers++
        mrr += monthly
        if (plan === 'solo') soloActive++
        else if (plan === 'master') masterActive++
      }

      if (!res.has_more) break
      startingAfter = res.data[res.data.length - 1]?.id
    }
    return { paidMembers, soloActive, masterActive, mrr, error: null }
  } catch (err) {
    return {
      paidMembers: 0,
      soloActive: 0,
      masterActive: 0,
      mrr: 0,
      error: err instanceof Error ? err.message : 'Stripe subscription lookup failed',
    }
  }
}

interface VercelDeployment {
  uid: string
  name?: string
  url?: string
  state?: string  // READY | BUILDING | ERROR | QUEUED | CANCELED
  createdAt?: number
  meta?: { githubCommitSha?: string; githubCommitMessage?: string; githubCommitAuthorName?: string }
  target?: string
}

async function fetchLatestVercelDeploy(): Promise<VercelDeployment | { error: string } | null> {
  const token = process.env.VERCEL_API_TOKEN
  if (!token) return null
  // These are project/team ids we already know from the Vercel MCP earlier.
  const projectId = 'prj_rP425mAha4FTNYuol2tXzwYFsRV4'
  const teamId = 'team_cBLBShWC8mDLMIUel1fNlDd2'
  try {
    const url = `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=1&target=production`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      // Short timeout: never let a slow Vercel API call block the admin polling cycle.
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { error: `Vercel API ${res.status}` }
    const json = (await res.json()) as { deployments?: VercelDeployment[] }
    return json.deployments?.[0] ?? null
  } catch (err) {
    return { error: (err as Error).message }
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Run all queries in parallel — total endpoint latency = slowest single query,
  // not sum of all queries.
  const [
    stripeSubs,
    canceledLast30,
    clicksLast24h,
    clicksTotal,
    attributionsTotal,
    conversionsThisMonth,
    unpaidCommissionAgg,
    topInfluencer,
    influencerCount,
    dbPingResult,
    deploy,
  ] = await Promise.all([
    // Subscriptions + revenue: live Stripe is the source of truth. Only counts
    // subscriptions Stripe reports as `active` that net more than $0 after
    // discounts as paid members (so 100%-off comps don't inflate MRR).
    computeStripeSubscriptions(),
    prisma.user.count({
      where: {
        OR: [
          { cancelAtPeriodEnd: true, currentPeriodEnd: { gte: now } },
          { planStatus: 'cancelled', currentPeriodEnd: { gte: thirtyDaysAgo } },
        ],
      },
    }),
    // Affiliate live numbers.
    prisma.referralClick.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.referralClick.count(),
    prisma.referralAttribution.count(),
    prisma.influencerConversion.count({ where: { conversionDate: { gte: startOfMonth } } }),
    prisma.influencerConversion.aggregate({
      _sum: { commissionEarned: true },
      where: { commissionPaid: false },
    }),
    prisma.influencerConversion.groupBy({
      by: ['influencerId'],
      _count: { _all: true },
      orderBy: { _count: { influencerId: 'desc' } },
      take: 1,
    }),
    prisma.influencer.count({ where: { status: 'active' } }),
    // System health.
    prisma.$queryRaw`SELECT 1`.then(() => ({ ok: true, error: null as string | null }))
      .catch((e: Error) => ({ ok: false, error: e.message.slice(0, 200) })),
    fetchLatestVercelDeploy(),
  ])

  // Resolve top influencer name if there is one.
  let topInfluencerName: string | null = null
  let topInfluencerConversions = 0
  if (topInfluencer.length > 0) {
    const top = topInfluencer[0]
    topInfluencerConversions = top._count._all
    const inf = await prisma.influencer.findUnique({
      where: { id: top.influencerId },
      select: { name: true },
    })
    topInfluencerName = inf?.name ?? null
  }

  // Env-var presence (booleans only — never values).
  const present = (v?: string) => typeof v === 'string' && v.trim().length > 0
  const env = {
    anthropic: present(process.env.ANTHROPIC_API_KEY),
    google: present(process.env.GOOGLE_API_KEY),
    stripeSecret: present(process.env.STRIPE_SECRET_KEY),
    stripeWebhook: present(process.env.STRIPE_WEBHOOK_SECRET),
    vercelToken: present(process.env.VERCEL_API_TOKEN),
    resend: present(process.env.RESEND_API_KEY),
    database: present(process.env.DATABASE_URL),
  }

  return NextResponse.json({
    fetchedAt: now.toISOString(),
    subscriptions: {
      paidMembers: stripeSubs.paidMembers,
      soloActive: stripeSubs.soloActive,
      masterActive: stripeSubs.masterActive,
      mrrDollars: +stripeSubs.mrr.toFixed(2),
      arrDollars: +(stripeSubs.mrr * 12).toFixed(2),
      canceledLast30,
      stripeError: stripeSubs.error,
    },
    affiliate: {
      activeInfluencers: influencerCount,
      clicksLast24h,
      clicksTotal,
      attributionsTotal,
      conversionsThisMonth,
      unpaidCommissionDollars: +(unpaidCommissionAgg._sum.commissionEarned ?? 0).toFixed(2),
      topInfluencer: topInfluencerName ? { name: topInfluencerName, conversions: topInfluencerConversions } : null,
    },
    system: {
      db: dbPingResult,
      env,
      deploy,
    },
  })
}
