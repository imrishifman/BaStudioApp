import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { EpisodeWizard } from '@/components/episode/EpisodeWizard'
import { EpisodeLimitScreen } from '@/components/episode/EpisodeLimitScreen'
import { normalisePlan, maxEpisodesPerMonth } from '@/lib/plan-gating'
import { effectivePlan } from '@/lib/trial'
import { isAdmin } from '@/lib/admin'

export default async function NewEpisodePage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')

  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const [shows, user, monthlyCount] = await Promise.all([
    prisma.show.findMany({
      where: { ownerEmail: session.user.email },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        seenWizardIntro: true,
        plan: true,
        planStatus: true,
        planOverride: true,
        trialEndsAt: true,
      },
    }),
    prisma.episode.count({
      where: { createdByEmail: session.user.email, createdAt: { gte: firstOfMonth } },
    }),
  ])

  // Gate the wizard at the door: if the user has already created this month's
  // quota, tell them NOW (the moment they clicked "+ New Episode") instead of
  // letting them fill in a guest and fail later at the research step. Trial
  // users get their trial plan's quota; admins are never capped.
  const plan = normalisePlan(user ? effectivePlan(user, Date.now()) : 'free')
  const cap = maxEpisodesPerMonth(plan)
  if (!isAdmin(session.user.email) && monthlyCount >= cap) {
    return <EpisodeLimitScreen cap={cap} />
  }

  return (
    <EpisodeWizard
      episode={null}
      shows={JSON.parse(JSON.stringify(shows))}
      userEmail={session.user.email}
      userPlan={session.user.plan}
      seenWizardIntro={user?.seenWizardIntro ?? false}
    />
  )
}
