import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse, type NextRequest } from 'next/server'

// Build an edge-safe auth instance for the proxy - no Prisma/bcrypt, so it
// can verify the JWT session on Vercel's edge runtime.
const { auth } = NextAuth(authConfig)

const REF_COOKIE = 'bas_ref'
const VID_COOKIE = 'bas_vid'
const THIRTY_DAYS = 60 * 60 * 24 * 30

function generateVisitorId() {
  // Lightweight uuid - no deps, runs on every request.
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 10)
  const r2 = Math.random().toString(36).slice(2, 10)
  return `${t}${r}${r2}`
}

// Apply affiliate cookies to whatever response we're about to return.
// First-touch wins for bas_ref (never overwritten while still valid).
// bas_vid is a stable anonymous visitor id for funnel analytics.
function applyAffiliateCookies(req: NextRequest, res: NextResponse) {
  const ref = req.nextUrl.searchParams.get('ref')
  const existingRef = req.cookies.get(REF_COOKIE)?.value
  const existingVid = req.cookies.get(VID_COOKIE)?.value
  const secure = process.env.NODE_ENV === 'production'

  if (ref && ref.trim() && !existingRef) {
    res.cookies.set(REF_COOKIE, ref.trim().slice(0, 64).toUpperCase(), {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: THIRTY_DAYS,
      path: '/',
    })
  }

  if (!existingVid) {
    res.cookies.set(VID_COOKIE, generateVisitorId(), {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: THIRTY_DAYS,
      path: '/',
    })
  }

  return res
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthed = !!req.auth

  const protectedPrefixes = ['/studio', '/dashboard', '/shows', '/podcast-dna', '/episodes', '/guests', '/calendar', '/team', '/account', '/pricing', '/admin', '/partner']
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))

  if (isProtected && !isAuthed) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('signin', '1')
    // Still set affiliate cookies on the redirect so attribution survives a
    // signin-then-signup round-trip.
    return applyAffiliateCookies(req as NextRequest, NextResponse.redirect(url))
  }

  return applyAffiliateCookies(req as NextRequest, NextResponse.next())
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|brief|influencer|team-calendar).*)'],
}
