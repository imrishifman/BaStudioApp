import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { GlassCard } from '@/components/common/GlassCard'
import { Calendar } from 'lucide-react'
import { TeamCalendarClient } from './team-calendar-client'

export default async function TeamCalendarPage({ params }: { params: Promise<{ userId: string; showId: string }> }) {
  const { userId, showId } = await params

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const [show, blocks] = await Promise.all([
    prisma.show.findFirst({ where: { id: showId }, include: { owner: { select: { fullName: true } } } }),
    prisma.availabilityBlock.findMany({
      where: { userId, status: 'available', date: { gte: today } },
      orderBy: { date: 'asc' },
    }),
  ])

  if (!show) notFound()

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl mx-auto mb-4" style={{ background: 'var(--bg-3)' }}>
          <Calendar size={22} style={{ color: 'var(--accent-violet)' }} />
        </div>
        <h1 className="display-sm text-[var(--ink-1)]">Book a recording slot</h1>
        <p className="body text-[var(--ink-2)] mt-2">for <strong className="text-[var(--ink-1)]">{show.name}</strong></p>
      </div>

      {blocks.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <p className="body text-[var(--ink-3)]">No available slots yet. Check back soon.</p>
        </GlassCard>
      ) : (
        <TeamCalendarClient blocks={JSON.parse(JSON.stringify(blocks))} showName={show.name} />
      )}
    </div>
  )
}
