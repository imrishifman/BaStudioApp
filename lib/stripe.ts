import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
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
