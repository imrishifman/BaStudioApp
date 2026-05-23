import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

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
