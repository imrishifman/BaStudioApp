import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/app/Sidebar'
import { MobileNav } from '@/components/app/MobileNav'
import { UpgradeBanner } from '@/components/common/UpgradeBanner'
import { FirstStepReview } from '@/components/common/FirstStepReview'
import { ConfirmProvider } from '@/components/common/ConfirmDialog'
import { MILESTONE_KEYS, type MilestoneKey } from '@/lib/milestones'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import { dirFor, normalizeLang } from '@/lib/i18n/config'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/?signin=1')

  // Is this user a partner / influencer? Surfaces a "Partner" entry in the
  // sidebar/mobile nav. Matched by email, mirrors the lookup in /partner/page.
  const partner = await prisma.influencer.findFirst({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  })
  const isPartner = !!partner

  // First-time milestone detection. We compute completion from cheap counts on
  // every app load (rather than instrumenting each action site) and surface the
  // first not-yet-reviewed completed milestone as a one-time review prompt.
  const email = session.user.email.toLowerCase()
  const [user, showCount, dnaCount, episodeCount, publishedCount] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { reviewedMilestones: true, language: true } }),
    prisma.show.count({ where: { ownerEmail: email } }),
    prisma.show.count({ where: { ownerEmail: email, dnaConfigured: true } }),
    prisma.episode.count({ where: { createdByEmail: email } }),
    prisma.episode.count({ where: { createdByEmail: email, status: 'published' } }),
  ])

  const completed: Record<MilestoneKey, boolean> = {
    first_show: showCount > 0,
    first_dna: dnaCount > 0,
    first_episode: episodeCount > 0,
    first_published: publishedCount > 0,
  }
  const reviewed = new Set(user?.reviewedMilestones ?? [])
  const pendingMilestone =
    MILESTONE_KEYS.find((k) => completed[k] && !reviewed.has(k)) ?? null

  // Per-user language drives both the UI strings and the layout direction.
  const lang = normalizeLang(user?.language)
  const dir = dirFor(lang)

  return (
    <I18nProvider lang={lang}>
      <ConfirmProvider>
        <div dir={dir} className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-0)' }}>
          <Sidebar isPartner={isPartner} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <MobileNav isPartner={isPartner} />
            <UpgradeBanner />
            <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
              {children}
            </main>
          </div>
          <FirstStepReview pendingMilestone={pendingMilestone} />
        </div>
      </ConfirmProvider>
    </I18nProvider>
  )
}
