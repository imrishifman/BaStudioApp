import Stripe from 'stripe'

// Singleton Stripe client. Empty key during build is OK; runtime API calls
// will throw a clear error if STRIPE_SECRET_KEY is not set.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  typescript: true,
})

export function ensureStripeConfigured() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
}
