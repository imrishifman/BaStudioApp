import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureGuestFromEpisode } from '@/lib/guest-sync'
import { normalisePlan, maxEpisodesPerMonth } from '@/lib/plan-gating'
import { effectivePlan } from '@/lib/trial'
import { isAdmin } from '@/lib/admin'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const episodes = await prisma.episode.findMany({
    where: { createdByEmail: session.user.email },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(episodes)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Server-side monthly creation cap (the wizard gates at the door too; this
  // makes the limit unbypassable). Trial users get their trial plan's quota;
  // admins are never capped.
  if (!isAdmin(session.user.email)) {
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const [user, monthlyCount] = await Promise.all([
      prisma.user.findUnique({
        where: { email: session.user.email },
        select: { plan: true, planStatus: true, planOverride: true, trialEndsAt: true },
      }),
      prisma.episode.count({
        where: { createdByEmail: session.user.email, createdAt: { gte: firstOfMonth } },
      }),
    ])
    const plan = normalisePlan(user ? effectivePlan(user, Date.now()) : 'free')
    if (monthlyCount >= maxEpisodesPerMonth(plan)) {
      return NextResponse.json({ error: 'episode_limit_reached' }, { status: 403 })
    }
  }

  const body = await req.json()
  const episode = await prisma.episode.create({
    data: {
      ...body,
      createdByEmail: session.user.email,
      currentStep: 1,
      status: 'draft',
    },
  })

  // Every episode guest flows into the Guest CRM automatically.
  await ensureGuestFromEpisode(session.user.email, episode)

  // Auto-attach the show's team (if any) to the new episode.
  if (episode.showId) {
    const team = await prisma.team.findFirst({
      where: { ownerEmail: session.user.email, showId: episode.showId },
    })
    if (team) {
      const withTeam = await prisma.episode.update({
        where: { id: episode.id },
        data: { teamId: team.id, sharedWith: team.memberEmails },
      })
      return NextResponse.json(withTeam)
    }
  }

  return NextResponse.json(episode)
}
