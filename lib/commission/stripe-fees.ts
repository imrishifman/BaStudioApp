import 'server-only'
import { stripe } from '@/lib/stripe'

// Real gross / fee / net for a Stripe charge, pulled from its balance
// transaction. Commissions are computed on gross; fee + net are stored for the
// admin's net-revenue reporting. Degrades to gross-only if the balance
// transaction can't be read (fee/net = 0/gross) so a payment is never dropped.

export interface PaymentAmounts { gross: number; fee: number; net: number }

export async function amountsForCharge(
  chargeId: string | null | undefined,
  fallbackGross: number,
): Promise<PaymentAmounts> {
  if (!chargeId) return { gross: fallbackGross, fee: 0, net: fallbackGross }
  try {
    const charge = await stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] })
    const bt = charge.balance_transaction
    if (bt && typeof bt !== 'string') {
      return { gross: bt.amount / 100, fee: bt.fee / 100, net: bt.net / 100 }
    }
  } catch {
    /* fall through to fallback */
  }
  return { gross: fallbackGross, fee: 0, net: fallbackGross }
}
