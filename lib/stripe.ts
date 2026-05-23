import Stripe from 'stripe'

// Lazy singleton — instantiated on first property access (at request time),
// not at module evaluation time, so Vercel build doesn't need STRIPE_SECRET_KEY.
let _stripe: Stripe | null = null
function getInstance(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-04-22.dahlia',
    })
  }
  return _stripe
}

export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string | symbol) {
    const instance = getInstance()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? (value as Function).bind(instance) : value
  },
})

export const PRICE_IDS = {
  solo_monthly:
    process.env.STRIPE_PRICE_SOLO_MONTHLY ?? 'price_1TWOCWAqDyTKiar5Mu5QSC4s',
  solo_annual:
    process.env.STRIPE_PRICE_SOLO_ANNUAL ?? 'price_1TWOCWAqDyTKiar5T0xP9v7Q',
  master_monthly:
    process.env.STRIPE_PRICE_MASTER_MONTHLY ??
    'price_1TWOCWAqDyTKiar5deS5KhUG',
  master_annual:
    process.env.STRIPE_PRICE_MASTER_ANNUAL ?? 'price_1TWOCWAqDyTKiar5aIRqEFGn',
} as const

export type PriceKey = keyof typeof PRICE_IDS
