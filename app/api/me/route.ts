import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
  const allowed = ['fullName', 'hostName', 'showName', 'showDescription', 'targetAudience', 'brandColors', 'brandLogoUrl', 'brandAppName', 'notifyTeamOnAvailability', 'onboardingComplete', 'skippedDnaSetup']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) { if (key in body) patch[key] = body[key] }
  const user = await prisma.user.update({ where: { email: session.user.email }, data: patch })
  return NextResponse.json(user)
}
