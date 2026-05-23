import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

// Build an edge-safe auth instance for the middleware — no Prisma/bcrypt, so
// it can verify the JWT session on Vercel's edge runtime.
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthed = !!req.auth

  const protectedPrefixes = ['/studio', '/dashboard', '/shows', '/podcast-dna', '/episodes', '/guests', '/calendar', '/team', '/account', '/pricing', '/admin']
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))

  if (isProtected && !isAuthed) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('signin', '1')
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|brief|influencer|team-calendar).*)'],
}
