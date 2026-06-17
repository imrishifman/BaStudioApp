import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LANG_COOKIE, LANGUAGES } from '@/lib/i18n/config'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  return NextResponse.json(user)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const allowed = ['fullName', 'hostName', 'showName', 'showDescription', 'targetAudience', 'brandColors', 'brandLogoUrl', 'brandAppName', 'notifyTeamOnAvailability', 'onboardingComplete', 'skippedDnaSetup', 'language', 'seenWizardIntro', 'trialEndedNoticeShown', 'trialWelcomeSeen', 'compWelcomeSeen']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) { if (key in body) patch[key] = body[key] }
  // Only accept a supported language code; ignore anything else.
  if ('language' in patch && !(LANGUAGES as readonly string[]).includes(String(patch.language))) {
    delete patch.language
  }
  const user = await prisma.user.update({ where: { email: session.user.email }, data: patch })
  const res = NextResponse.json(user)
  // Mirror the choice to a cookie so pre-session screens (e.g. the email verify
  // page) and the next server render can pick it up immediately.
  if (typeof patch.language === 'string') {
    res.cookies.set(LANG_COOKIE, patch.language, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }
  return res
}
