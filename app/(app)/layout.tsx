import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/app/Sidebar'
import { MobileNav } from '@/components/app/MobileNav'
import { UpgradeBanner } from '@/components/common/UpgradeBanner'

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

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-0)' }}>
      <Sidebar isPartner={isPartner} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileNav isPartner={isPartner} />
        <UpgradeBanner />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  )
}
