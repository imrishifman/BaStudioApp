'use client'

import { useState } from 'react'
import type { Episode, Show } from '@prisma/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PillButton } from '@/components/common/PillButton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sparkles, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  episode: Episode | null
  show: Show | null
  shows: Show[]
  onNext: (patch: Partial<Episode>) => Promise<void>
  onEpisodeCreated: (ep: Episode) => void
  userEmail: string
}

export function Step1GuestName({ episode, show, shows, onNext, onEpisodeCreated, userEmail }: Props) {
  const [guestName, setGuestName] = useState(episode?.guestName ?? '')
  const [showId, setShowId] = useState(episode?.showId ?? shows[0]?.id ?? '')
  const [guestLinkedinUrl, setLinkedin] = useState(episode?.guestLinkedinUrl ?? '')
  const [guestTwitterUrl, setTwitter] = useState(episode?.guestTwitterUrl ?? '')
  const [guestInstagramUrl, setInstagram] = useState(episode?.guestInstagramUrl ?? '')
  const [guestWebsiteUrl, setWebsite] = useState(episode?.guestWebsiteUrl ?? '')
  const [guestExtraContext, setExtra] = useState(episode?.guestExtraContext ?? '')
  const [loading, setLoading] = useState(false)

  const hasFocus = !!(
    guestLinkedinUrl.trim() ||
    guestTwitterUrl.trim() ||
    guestInstagramUrl.trim() ||
    guestWebsiteUrl.trim() ||
    guestExtraContext.trim()
  )

  async function handleResearch() {
    if (!guestName.trim()) { toast.error('Enter a guest name first'); return }
    if (!hasFocus) { toast.error('Add at least one link or some context so the research stays focused'); return }
    setLoading(true)
    try {
      const patch: Partial<Episode> = {
        guestName, showId: showId || undefined,
        guestLinkedinUrl: guestLinkedinUrl || undefined,
        guestTwitterUrl: guestTwitterUrl || undefined,
        guestInstagramUrl: guestInstagramUrl || undefined,
        guestWebsiteUrl: guestWebsiteUrl || undefined,
        guestExtraContext: guestExtraContext || undefined,
        status: 'researching',
      }
      await onNext(patch)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 1 of 10</p>
        <h2 className="display-sm text-[var(--ink-1)]">Who's your guest?</h2>
        <p className="body mt-1 text-[var(--ink-2)]">
          Enter their name plus at least one link or some context. Ba-Studio researches the rest.
        </p>
      </div>

      <div className="space-y-4">
        {shows.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label className="body-sm text-[var(--ink-2)]">Show (optional)</Label>
            <Select value={showId} onValueChange={setShowId}>
              <SelectTrigger className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)]">
                <SelectValue placeholder="Select a show" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-2)] border-[var(--line-1)]">
                {shows.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-[var(--ink-1)]">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="body-sm text-[var(--ink-2)]">Guest name *</Label>
          <Input
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            placeholder="e.g. Satya Nadella"
            className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)] text-lg"
            autoFocus
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="body-sm text-[var(--ink-2)]">Social & web links</Label>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: 'rgba(167,139,250,0.14)', color: 'var(--accent-violet)' }}
          >
            Recommended!
          </span>
          <span className="body-sm text-[var(--ink-4)]">— the more sources, the sharper the research</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={guestLinkedinUrl} onChange={e => setLinkedin(e.target.value)} placeholder="LinkedIn URL" className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]" />
          <Input value={guestTwitterUrl} onChange={e => setTwitter(e.target.value)} placeholder="Twitter / X URL" className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]" />
          <Input value={guestInstagramUrl} onChange={e => setInstagram(e.target.value)} placeholder="Instagram URL" className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]" />
          <Input value={guestWebsiteUrl} onChange={e => setWebsite(e.target.value)} placeholder="Website URL" className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="body-sm text-[var(--ink-2)]">Extra context (optional)</Label>
          <Textarea
            value={guestExtraContext}
            onChange={e => setExtra(e.target.value)}
            placeholder="What do you already know about this guest? Any specific angle?"
            rows={3}
            className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <PillButton onClick={handleResearch} disabled={loading || !guestName.trim() || !hasFocus} size="lg">
          {loading ? 'Researching…' : <><Sparkles size={16} /> Research guest</>}
        </PillButton>
        {guestName.trim() && !hasFocus && (
          <p className="body-sm text-[var(--ink-3)]">
            Add a LinkedIn, a website, or some context above so the research stays focused on the right person.
          </p>
        )}
      </div>
    </div>
  )
}
