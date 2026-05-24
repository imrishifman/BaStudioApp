import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { GlassCard } from '@/components/common/GlassCard'
import { Mic, Calendar, Clock, FileText } from 'lucide-react'
import { resolveSections, normalizeGenerated, chosenQuestionTexts, DEFAULT_CLOSING_QUESTION } from '@/lib/questions'

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const episode = await prisma.episode.findUnique({
    where: { id },
    include: { show: true },
  })
  if (!episode) notFound()

  const sections = [
    { icon: Mic, label: 'Show', value: episode.show?.name },
    { icon: FileText, label: 'Episode', value: episode.title ?? episode.description },
    { icon: Calendar, label: 'Frequency', value: episode.show?.publishFrequency },
  ].filter(s => s.value)

  const { storedSections } = normalizeGenerated(episode.generatedQuestions)
  const briefSections = resolveSections(episode.show?.episodeSections, storedSections)
  const customClosing = (episode.selectedQuestions as { _closing?: string } | null)?._closing
  const closing = customClosing ?? episode.show?.closingQuestion ?? DEFAULT_CLOSING_QUESTION
  const questions = chosenQuestionTexts(episode.generatedQuestions, episode.selectedQuestions, briefSections, closing)

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 text-center">
        <p className="eyebrow text-[var(--ink-3)] mb-2">Guest Brief</p>
        <h1 className="display-sm text-[var(--ink-1)]">Welcome, {episode.guestName}</h1>
        <p className="body text-[var(--ink-2)] mt-2">Here's everything you need to know before we record.</p>
      </div>

      <div className="space-y-4">
        {sections.map(s => {
          const Icon = s.icon
          return (
            <GlassCard key={s.label} className="flex gap-4 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--bg-3)' }}>
                <Icon size={16} style={{ color: 'var(--accent-violet)' }} />
              </div>
              <div>
                <p className="eyebrow text-[var(--ink-3)]">{s.label}</p>
                <p className="body text-[var(--ink-1)] mt-0.5">{s.value}</p>
              </div>
            </GlassCard>
          )
        })}

        {episode.guestBio && (
          <GlassCard className="p-4">
            <p className="eyebrow text-[var(--ink-3)] mb-2">Your bio we'll use</p>
            <p className="body text-[var(--ink-2)] whitespace-pre-wrap">{episode.guestBio}</p>
          </GlassCard>
        )}

        {questions && questions.length > 0 && (
          <GlassCard className="p-4">
            <p className="eyebrow text-[var(--ink-3)] mb-3">Questions we may explore</p>
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="body-sm text-[var(--ink-4)] shrink-0 w-5">{i + 1}.</span>
                  <p className="body-sm text-[var(--ink-2)]">{q}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>

      <p className="mt-10 text-center body-sm text-[var(--ink-4)]">Prepared with Ba-Studio</p>
    </div>
  )
}
