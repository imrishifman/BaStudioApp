'use client'

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PillButton } from '@/components/common/PillButton'
import { UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Show, Team } from '@prisma/client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const inputCls = 'bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]'
const selectCls = 'h-10 rounded-[var(--radius-sm)] border bg-[var(--bg-3)] border-[var(--line-2)] px-3 text-sm text-[var(--ink-1)]'

export function NewTeamModal({
  open,
  onOpenChange,
  team,
  shows,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  team: Team | null
  shows: Show[]
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [showId, setShowId] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [memberInput, setMemberInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(team?.name ?? '')
      setShowId(team?.showId ?? '')
      setMembers(team?.memberEmails ?? [])
      setMemberInput('')
    }
  }, [open, team])

  function addMember() {
    const email = memberInput.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      toast.error('Enter a valid email')
      return
    }
    if (members.includes(email)) {
      toast('Already added')
      return
    }
    setMembers((p) => [...p, email])
    setMemberInput('')
  }

  async function save() {
    if (!name.trim()) {
      toast.error('Team name is required')
      return
    }
    setSaving(true)
    try {
      const url = team ? `/api/teams/${team.id}` : '/api/teams'
      const method = team ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, showId: showId || null, memberEmails: members }),
      })
      if (res.ok) {
        onOpenChange(false)
        onSaved()
      } else {
        toast.error('Could not save team')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--line-1)]" style={{ background: 'var(--bg-2)' }}>
        <DialogHeader>
          <DialogTitle className="display-sm text-[var(--ink-1)]">
            {team ? 'Edit team' : 'New team'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="body-sm text-[var(--ink-2)]">Team name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Crew"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="body-sm text-[var(--ink-2)]">Attach to show</Label>
            <select value={showId} onChange={(e) => setShowId(e.target.value)} className={selectCls}>
              <option value="">No show</option>
              {shows.map((s) => (
                <option key={s.id} value={s.id} style={{ background: 'var(--bg-3)' }}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--ink-4)]">
              New episodes for this show will automatically attach this team.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="body-sm text-[var(--ink-2)]">Members</Label>
            <div className="flex gap-2">
              <Input
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addMember()
                  }
                }}
                placeholder="member@email.com"
                className={`${inputCls} flex-1`}
              />
              <PillButton type="button" size="sm" variant="secondary" onClick={addMember}>
                <UserPlus size={14} />
              </PillButton>
            </div>
            {members.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {members.map((m) => (
                  <span
                    key={m}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px]"
                    style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
                  >
                    {m}
                    <button
                      onClick={() => setMembers((p) => p.filter((x) => x !== m))}
                      className="text-[var(--ink-4)] transition-colors hover:text-[var(--error)]"
                      aria-label="Remove"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <PillButton onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save team'}
            </PillButton>
            <PillButton variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </PillButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
