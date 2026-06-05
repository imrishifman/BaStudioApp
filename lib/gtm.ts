// Google Tag Manager + Consent Mode v2 helpers.
//
// We do NOT hardcode GA4, Google Ads, or Meta Pixel here. Those tags live inside
// the GTM container. This module only (a) exposes the container id from config
// and (b) pushes clean, well-shaped events onto window.dataLayer at the key
// funnel moments. GTM picks them up and fans them out to the destination tags.

// Container id lives in env/config, never inline. Set NEXT_PUBLIC_GTM_ID in
// .env.local (dev) and in the Vercel project (preview/prod). When it's absent we
// skip injecting GTM entirely and these helpers become no-ops, so local dev and
// previews without the var never error.
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? ''
export const gtmEnabled = GTM_ID.length > 0

type DataLayerEntry = Record<string, unknown> | IArguments

declare global {
  interface Window {
    dataLayer?: DataLayerEntry[]
    gtag?: (...args: unknown[]) => void
  }
}

// Low-level push. Always guards for SSR and a missing dataLayer.
export function pushToDataLayer(entry: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(entry)
}

// Push a named event with arbitrary params. Undefined params are stripped so we
// never send `key: undefined` into the dataLayer.
export function pushEvent(event: string, params: Record<string, unknown> = {}): void {
  const clean: Record<string, unknown> = { event }
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) clean[k] = v
  }
  pushToDataLayer(clean)
}

// ---------------------------------------------------------------------------
// Consent Mode v2
// ---------------------------------------------------------------------------

const CONSENT_KEYS = [
  'ad_storage',
  'analytics_storage',
  'ad_user_data',
  'ad_personalization',
] as const

function gtagConsent(state: 'default' | 'update', value: Record<string, 'granted' | 'denied'>): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  // gtag pushes its raw `arguments` object onto the dataLayer; GTM's built-in
  // Consent API reads that exact shape. Defining the shim here keeps the update
  // calls working even if the inline default script in the document ran first.
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    }
  }
  window.gtag('consent', state, value)
}

// Grant marketing + analytics consent (called when the visitor accepts the
// cookie banner). Mirrors the four Consent Mode v2 signals.
export function grantConsent(): void {
  gtagConsent('update', {
    ad_storage: 'granted',
    analytics_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
  })
  pushEvent('consent_granted')
}

// Explicitly keep everything denied (called when the visitor declines).
export function denyConsent(): void {
  gtagConsent('update', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
  pushEvent('consent_denied')
}

export { CONSENT_KEYS }

// ---------------------------------------------------------------------------
// Enhanced conversions (web)
// ---------------------------------------------------------------------------
//
// Google's enhanced conversions improve match rates by sending a hashed,
// first-party identifier alongside the conversion. We only ever send a SHA-256
// hash of the email (lowercased + trimmed), never raw PII. GTM reads
// `enhanced_conversion_data.sha256_email_address` from the same dataLayer event
// as the conversion and forwards it to the Google Ads / GA4 tags.

// SHA-256 → lowercase hex. Returns undefined when crypto is unavailable (SSR /
// very old browsers) or the input is empty, so callers can omit the field
// cleanly rather than sending a bogus hash.
export async function sha256Hex(value: string): Promise<string | undefined> {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined
  if (typeof window === 'undefined' || !window.crypto?.subtle) return undefined
  const bytes = new TextEncoder().encode(normalized)
  const digest = await window.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Build the enhanced_conversion_data payload from a raw email. Resolves to
// undefined when no usable hash can be produced.
async function enhancedConversionData(
  email?: string,
): Promise<{ sha256_email_address: string } | undefined> {
  if (!email) return undefined
  const hash = await sha256Hex(email)
  return hash ? { sha256_email_address: hash } : undefined
}

// ---------------------------------------------------------------------------
// Funnel events
// ---------------------------------------------------------------------------

export type CtaLocation = 'hero' | 'nav' | 'pricing' | 'footer' | (string & {})

// SPA page view, pushed on every client-side route change.
export function spaPageView(pagePath: string, pageTitle: string): void {
  pushEvent('spa_page_view', { page_path: pagePath, page_title: pageTitle })
}

// A signup CTA was clicked. cta_location identifies which one (hero, pricing...).
export function trackBeginSignup(ctaLocation: CtaLocation): void {
  pushEvent('begin_signup', { cta_location: ctaLocation })
}

// A brand-new account was created. method is the auth method used. When an email
// is supplied we attach hashed enhanced-conversion data (never the raw email).
export async function trackSignUp(args: {
  method: 'email' | 'google' | (string & {})
  userId?: string
  email?: string
}): Promise<void> {
  const enhanced = await enhancedConversionData(args.email)
  pushEvent('sign_up', {
    method: args.method,
    user_id: args.userId,
    enhanced_conversion_data: enhanced,
  })
}

export interface StartSubscriptionArgs {
  value: number
  currency: string
  plan: 'studio_solo' | 'master' | (string & {})
  billingPeriod: 'monthly' | 'annual' | (string & {})
  transactionId: string
  userId?: string
  email?: string
}

// A paid subscription was confirmed (fired only after Stripe confirms payment).
// value must be a number (no currency symbol); transactionId must be unique per
// purchase so the conversion is never double-counted. When an email is supplied
// we attach hashed enhanced-conversion data (never the raw email).
export async function trackStartSubscription(args: StartSubscriptionArgs): Promise<void> {
  const enhanced = await enhancedConversionData(args.email)
  pushEvent('start_subscription', {
    value: args.value,
    currency: args.currency,
    plan: args.plan,
    billing_period: args.billingPeriod,
    transaction_id: args.transactionId,
    user_id: args.userId,
    enhanced_conversion_data: enhanced,
  })
}
