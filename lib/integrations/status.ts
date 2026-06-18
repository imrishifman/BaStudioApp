import 'server-only'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getGoogleAccessToken, SeoConfigError } from '@/lib/seo/google-auth'

// Health + token status for every third party BaStudio talks to. Admin-only.
// NEVER returns a secret value: only presence, validity, mode (live/test), and
// expiry dates. Each check catches its own errors so one failure never breaks
// the rest. Live HTTP checks use a short timeout so the endpoint stays snappy.

export type IntegrationStatus =
  | 'ok' // configured and a live check passed
  | 'configured' // configured (key present) but not live-verified, or test mode
  | 'expiring' // a token that expires soon
  | 'expired' // a token that has expired
  | 'error' // configured but a live check failed
  | 'not_configured' // required env/token missing

export interface Integration {
  key: string
  name: string
  category: string
  status: IntegrationStatus
  detail: string
  expiresAt?: string | null
  daysLeft?: number | null
  balance?: string | null // human-formatted credits/balance remaining, when the API exposes it
  dashboardUrl?: string | null // where to check usage/billing when the API has no balance
  live: boolean // true if we performed a live check (vs. presence only)
}

const present = (v?: string) => typeof v === 'string' && v.trim().length > 0
const msg = (e: unknown) => (e instanceof Error ? e.message.slice(0, 160) : 'failed')
const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

async function pingOk(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(5000) })
    return { ok: res.ok, status: res.status }
  } catch (e) {
    return { ok: false, status: 0, error: msg(e) }
  }
}

async function pingJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json?: unknown; error?: string }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(5000) })
    const json = await res.json().catch(() => undefined)
    return { ok: res.ok, status: res.status, json }
  } catch (e) {
    return { ok: false, status: 0, error: msg(e) }
  }
}

// Pull a credit/balance number out of an arbitrary JSON response without
// hardcoding a provider's exact field name: the first numeric value under a key
// that looks like a balance, searched recursively.
function extractCredits(obj: unknown, depth = 0): number | null {
  if (typeof obj === 'number') return obj
  if (!obj || typeof obj !== 'object' || depth > 4) return null
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === 'number' && /credit|balance|remaining|available|quota/i.test(k)) return v
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const n = extractCredits(v, depth + 1)
    if (n != null) return n
  }
  return null
}

async function checkDatabase(): Promise<Integration> {
  const base = { key: 'database', name: 'Supabase (Postgres)', category: 'Database', live: true }
  if (!present(process.env.DATABASE_URL)) {
    return { ...base, status: 'not_configured', detail: 'DATABASE_URL not set', live: false }
  }
  try {
    await prisma.$queryRaw`SELECT 1`
    return { ...base, status: 'ok', detail: 'Connected' }
  } catch (e) {
    return { ...base, status: 'error', detail: msg(e) }
  }
}

async function checkStripe(): Promise<Integration> {
  const base = { key: 'stripe', name: 'Stripe', category: 'Payments', live: true }
  const k = process.env.STRIPE_SECRET_KEY
  if (!present(k)) return { ...base, status: 'not_configured', detail: 'STRIPE_SECRET_KEY not set', live: false }
  const mode = k!.startsWith('sk_live_') ? 'live' : k!.startsWith('sk_test_') ? 'test' : 'unknown'
  const webhook = present(process.env.STRIPE_WEBHOOK_SECRET)
  const dashboardUrl = 'https://dashboard.stripe.com/balance'
  try {
    const bal = await stripe.balance.retrieve()
    const avail = bal.available?.[0]
    const balance = avail
      ? `${(avail.amount / 100).toLocaleString('en-US', { style: 'currency', currency: avail.currency.toUpperCase() })} available`
      : null
    const notes = [`${mode} mode`]
    if (!webhook) notes.push('webhook secret missing')
    return {
      ...base,
      status: mode === 'live' ? 'ok' : 'configured',
      detail: `Key valid · ${notes.join(' · ')}`,
      balance,
      dashboardUrl,
    }
  } catch (e) {
    return { ...base, status: 'error', detail: `${mode} mode · ${msg(e)}`, dashboardUrl }
  }
}

async function checkGoogleServiceAccount(): Promise<Integration> {
  const base = { key: 'google_service_account', name: 'Google API · Search Console + GA4', category: 'Analytics', live: true }
  if (!present(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)) {
    return { ...base, status: 'not_configured', detail: 'Service account key not set', live: false }
  }
  try {
    await getGoogleAccessToken()
    const bits = [
      present(process.env.GSC_SITE_URL) ? 'GSC site set' : 'GSC site missing',
      present(process.env.GA4_PROPERTY_ID) ? 'GA4 property set' : 'GA4 property missing',
    ]
    return { ...base, status: 'ok', detail: `Token mints OK · ${bits.join(' · ')}` }
  } catch (e) {
    return { ...base, status: 'error', detail: e instanceof SeoConfigError ? e.message : msg(e) }
  }
}

async function checkInstagram(): Promise<Integration> {
  const base = { key: 'instagram', name: 'Instagram (Meta Graph)', category: 'Social', live: false }
  const configured = present(process.env.IG_BUSINESS_ACCOUNT_ID)
  const row = await prisma.socialToken.findUnique({ where: { provider: 'instagram' } }).catch(() => null)
  if (!row) {
    return {
      ...base,
      status: configured ? 'configured' : 'not_configured',
      detail: configured ? 'No token stored yet (connect the IG account)' : 'Not configured',
    }
  }
  if (!row.expiresAt) {
    return { ...base, status: 'ok', detail: `Token stored · no expiry recorded · updated ${fmtDate(row.updatedAt)}`, expiresAt: null }
  }
  const daysLeft = Math.floor((new Date(row.expiresAt).getTime() - Date.now()) / 86_400_000)
  const status: IntegrationStatus = daysLeft <= 0 ? 'expired' : daysLeft <= 10 ? 'expiring' : 'ok'
  const detail =
    daysLeft <= 0
      ? `Token expired ${fmtDate(row.expiresAt)} (auto-refresh failing)`
      : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${fmtDate(row.expiresAt)})`
  return { ...base, status, detail, expiresAt: new Date(row.expiresAt).toISOString(), daysLeft }
}

async function checkVercel(): Promise<Integration> {
  const base = { key: 'vercel', name: 'Vercel', category: 'Infrastructure', live: true, dashboardUrl: 'https://vercel.com/dashboard/usage' }
  const token = process.env.VERCEL_API_TOKEN
  if (!present(token)) {
    return { ...base, status: 'not_configured', detail: 'VERCEL_API_TOKEN not set (Latest-deploy card disabled)', live: false }
  }
  const r = await pingOk('https://api.vercel.com/v2/user', { headers: { Authorization: `Bearer ${token}` } })
  return r.ok ? { ...base, status: 'ok', detail: 'Token valid' } : { ...base, status: 'error', detail: r.error ?? `HTTP ${r.status}` }
}

async function checkResend(): Promise<Integration> {
  const base = { key: 'resend', name: 'Resend (email)', category: 'Email', live: true, dashboardUrl: 'https://resend.com/settings/billing' }
  const key = process.env.RESEND_API_KEY
  if (!present(key)) return { ...base, status: 'not_configured', detail: 'RESEND_API_KEY not set', live: false }
  const r = await pingOk('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } })
  return r.ok ? { ...base, status: 'ok', detail: 'Key valid' } : { ...base, status: 'error', detail: r.error ?? `HTTP ${r.status}` }
}

async function checkAnthropic(): Promise<Integration> {
  const base = { key: 'anthropic', name: 'Anthropic (Claude)', category: 'AI', live: true, dashboardUrl: 'https://console.anthropic.com/settings/billing' }
  const key = process.env.ANTHROPIC_API_KEY
  if (!present(key)) return { ...base, status: 'not_configured', detail: 'ANTHROPIC_API_KEY not set', live: false }
  // GET /v1/models is free (no token spend) and validates the key.
  const r = await pingOk('https://api.anthropic.com/v1/models', {
    headers: { 'x-api-key': key!, 'anthropic-version': '2023-06-01' },
  })
  return r.ok ? { ...base, status: 'ok', detail: 'Key valid' } : { ...base, status: 'error', detail: r.error ?? `HTTP ${r.status}` }
}

async function checkGemini(): Promise<Integration> {
  const base = { key: 'google_ai', name: 'Google AI (Gemini)', category: 'AI', live: true, dashboardUrl: 'https://aistudio.google.com/' }
  const key = process.env.GOOGLE_API_KEY
  if (!present(key)) return { ...base, status: 'not_configured', detail: 'GOOGLE_API_KEY not set', live: false }
  const r = await pingOk(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key!)}`)
  return r.ok ? { ...base, status: 'ok', detail: 'Key valid' } : { ...base, status: 'error', detail: r.error ?? `HTTP ${r.status}` }
}

async function checkTwilio(): Promise<Integration> {
  const base = { key: 'twilio', name: 'Twilio (WhatsApp)', category: 'Messaging', live: true, dashboardUrl: 'https://console.twilio.com/us1/billing/manage-billing/billing-overview' }
  const sid = process.env.TWILIO_ACCOUNT_SID
  const tok = process.env.TWILIO_AUTH_TOKEN
  if (!present(sid) || !present(tok)) {
    return { ...base, status: 'not_configured', detail: 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set', live: false }
  }
  const auth = Buffer.from(`${sid}:${tok}`).toString('base64')
  const r = await pingJson(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, { headers: { Authorization: `Basic ${auth}` } })
  if (!r.ok) return { ...base, status: 'error', detail: r.error ?? `HTTP ${r.status}` }
  const j = r.json as { balance?: string; currency?: string } | undefined
  const balance = j?.balance != null ? `${j.balance} ${(j.currency ?? '').toUpperCase()}`.trim() : null
  return { ...base, status: 'ok', detail: 'Account active', balance }
}

async function checkScrapeCreators(): Promise<Integration> {
  const base = { key: 'scrapecreators', name: 'ScrapeCreators (guest research)', category: 'Enrichment', live: true, dashboardUrl: 'https://app.scrapecreators.com/' }
  const key = process.env.SCRAPECREATORS_API_KEY
  if (!present(key)) return { ...base, status: 'not_configured', detail: 'SCRAPECREATORS_API_KEY not set', live: false }
  const headers = { 'x-api-key': key! }
  let r = await pingJson('https://api.scrapecreators.com/v1/credit-balance', { headers })
  if (r.status === 404) r = await pingJson('https://api.scrapecreators.com/v1/account/credit-balance', { headers })
  if (!r.ok) return { ...base, status: 'error', detail: r.error ?? `HTTP ${r.status}` }
  const credits = extractCredits(r.json)
  return { ...base, status: 'ok', detail: 'Key valid', balance: credits != null ? `${credits.toLocaleString()} credits` : null }
}

async function checkEnrichlayer(): Promise<Integration> {
  const base = { key: 'enrichlayer', name: 'Enrichlayer (LinkedIn)', category: 'Enrichment', live: true, dashboardUrl: 'https://enrichlayer.com/dashboard' }
  const key = process.env.ENRICHLAYER_API_KEY
  if (!present(key)) return { ...base, status: 'not_configured', detail: 'ENRICHLAYER_API_KEY not set', live: false }
  const raw = process.env.ENRICHLAYER_BASE_URL || 'https://enrichlayer.com/api/v2/profile'
  const url = `${raw.replace(/\/profile.*$/, '')}/credit-balance`
  const r = await pingJson(url, { headers: { Authorization: `Bearer ${key}` } })
  if (!r.ok) return { ...base, status: 'error', detail: r.error ?? `HTTP ${r.status}` }
  const credits = extractCredits(r.json)
  return { ...base, status: 'ok', detail: 'Key valid', balance: credits != null ? `${credits.toLocaleString()} credits` : null }
}

// Presence-only checks for services without a cheap/safe live ping.
function configOnly(key: string, name: string, category: string, vars: string[], note: string): Integration {
  const missing = vars.filter((v) => !present(process.env[v]))
  return {
    key,
    name,
    category,
    status: missing.length ? 'not_configured' : 'configured',
    detail: missing.length ? `Missing: ${missing.join(', ')}` : note,
    live: false,
  }
}

export async function getIntegrations(): Promise<Integration[]> {
  const live = await Promise.all([
    checkDatabase(),
    checkStripe(),
    checkGoogleServiceAccount(),
    checkInstagram(),
    checkVercel(),
    checkResend(),
    checkAnthropic(),
    checkGemini(),
    checkTwilio(),
    checkScrapeCreators(),
    checkEnrichlayer(),
  ])
  const presence = [
    configOnly('facebook', 'Facebook Page (Meta)', 'Social', ['FB_PAGE_ACCESS_TOKEN', 'FB_PAGE_ID'], 'Page token set (long-lived)'),
    configOnly('blob', 'Vercel Blob (storage)', 'Infrastructure', ['BLOB_READ_WRITE_TOKEN'], 'Read/write token set'),
    configOnly('google_oauth', 'Google OAuth (sign-in)', 'Auth', ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'], 'Client id + secret set'),
  ]
  return [...live, ...presence]
}
