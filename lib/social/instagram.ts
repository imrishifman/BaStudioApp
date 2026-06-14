// Instagram publishing via the Instagram API with Instagram Login.
// Base host: graph.instagram.com. Account: @bastudiopodcast (IG Business
// account id 17841447722200068). The access token is a ~60-day long-lived
// token stored in the SocialToken table (provider 'instagram') and rotated by
// the refresh cron. We read it from the DB, never from a static env var, so the
// refresh job can update it in place.
//
// Granted permissions: instagram_business_basic, instagram_business_content_publish,
// instagram_business_manage_comments, instagram_business_manage_messages.

import { prisma } from '@/lib/prisma'

const GRAPH = 'https://graph.instagram.com'
const VERSION = 'v23.0'
const PROVIDER = 'instagram'

export const IG_BUSINESS_ACCOUNT_ID =
  process.env.IG_BUSINESS_ACCOUNT_ID ?? '17841447722200068'

export class InstagramError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message)
    this.name = 'InstagramError'
  }
}

// ---- token storage -------------------------------------------------------

export async function getAccessToken(): Promise<string> {
  const row = await prisma.socialToken.findUnique({ where: { provider: PROVIDER } })
  if (!row?.accessToken) {
    throw new InstagramError(
      'No Instagram token stored. Seed it once via POST /api/social/token.',
    )
  }
  return row.accessToken
}

export async function getTokenStatus() {
  const row = await prisma.socialToken.findUnique({ where: { provider: PROVIDER } })
  if (!row) return { present: false as const }
  const daysLeft = row.expiresAt
    ? Math.round((row.expiresAt.getTime() - Date.now()) / 86_400_000)
    : null
  return {
    present: true as const,
    expiresAt: row.expiresAt,
    daysLeft,
    updatedAt: row.updatedAt,
    tokenPreview: `${row.accessToken.slice(0, 6)}…${row.accessToken.slice(-4)}`,
  }
}

export async function setAccessToken(token: string, expiresInSeconds?: number) {
  const expiresAt = expiresInSeconds
    ? new Date(Date.now() + expiresInSeconds * 1000)
    : new Date(Date.now() + 60 * 86_400_000) // assume 60 days if unknown
  await prisma.socialToken.upsert({
    where: { provider: PROVIDER },
    create: { provider: PROVIDER, accessToken: token, expiresAt },
    update: { accessToken: token, expiresAt },
  })
  return { ok: true, expiresAt }
}

// Exchange the current long-lived token for a fresh 60-day one. Run on a cron
// every ~50 days. Safe to call any time after 24h of token age.
export async function refreshAccessToken() {
  const current = await getAccessToken()
  const url = `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`
  const res = await fetch(url, { method: 'GET' })
  const data = (await res.json()) as {
    access_token?: string
    expires_in?: number
    error?: unknown
  }
  if (!res.ok || !data.access_token) {
    throw new InstagramError('Token refresh failed', data.error ?? data)
  }
  await setAccessToken(data.access_token, data.expires_in)
  return { ok: true, expiresIn: data.expires_in }
}

// ---- read / verify -------------------------------------------------------

export async function verifyConnection() {
  const token = await getAccessToken()
  const url = `${GRAPH}/${VERSION}/${IG_BUSINESS_ACCOUNT_ID}?fields=user_id,username&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  const data = (await res.json()) as {
    username?: string
    user_id?: string
    error?: unknown
  }
  if (!res.ok || !data.username) {
    throw new InstagramError('Connection check failed', data.error ?? data)
  }
  return { username: data.username, userId: data.user_id }
}

// ---- publishing ----------------------------------------------------------

async function graphPost(path: string, body: Record<string, string>) {
  const token = await getAccessToken()
  const res = await fetch(`${GRAPH}/${VERSION}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, access_token: token }).toString(),
  })
  const data = (await res.json()) as { id?: string; error?: unknown }
  if (!res.ok || !data.id) {
    throw new InstagramError(`Graph POST ${path} failed`, data.error ?? data)
  }
  return data.id
}

async function getPermalink(mediaId: string): Promise<string | null> {
  try {
    const token = await getAccessToken()
    const res = await fetch(
      `${GRAPH}/${VERSION}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`,
    )
    const data = (await res.json()) as { permalink?: string }
    return data.permalink ?? null
  } catch {
    return null
  }
}

export interface PublishImageInput {
  imageUrl: string // must be a public https URL Instagram can fetch
  caption: string
  hashtags?: string // appended to the caption
}

// Single-image publish: create a media container, then publish it.
// Returns the IG media id and permalink.
export async function publishImage(
  input: PublishImageInput,
): Promise<{ mediaId: string; permalink: string | null }> {
  if (!/^https:\/\//.test(input.imageUrl)) {
    throw new InstagramError('imageUrl must be a public https URL')
  }
  if (/—|–/.test(input.caption)) {
    // Brand rule: no em dashes (or en dashes) in user-facing copy.
    throw new InstagramError('Caption contains an em/en dash; rewrite it first.')
  }
  const fullCaption = input.hashtags
    ? `${input.caption}\n\n${input.hashtags}`
    : input.caption

  const creationId = await graphPost(`${IG_BUSINESS_ACCOUNT_ID}/media`, {
    image_url: input.imageUrl,
    caption: fullCaption,
  })
  const mediaId = await graphPost(`${IG_BUSINESS_ACCOUNT_ID}/media_publish`, {
    creation_id: creationId,
  })
  const permalink = await getPermalink(mediaId)
  return { mediaId, permalink }
}
