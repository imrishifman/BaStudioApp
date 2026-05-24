'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Wand2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const ACTIONS = [
  { key: 'rephrase', label: 'Rephrase' },
  { key: 'shorten', label: 'Shorten' },
  { key: 'punchier', label: 'Punch it up' },
  { key: 'formal', label: 'More formal' },
]

interface Props {
  value: string
  onChange: (v: string) => void
  rows?: number
  className?: string
  placeholder?: string
}

// A Textarea with an Apple-Intelligence-style floating toolbar: select text and
// rewrite the selection in place (Rephrase / Shorten / Punch it up / More formal).
export function SmartTextarea({ value, onChange, rows, className, placeholder }: Props) {
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null)
  const [busy, setBusy] = useState(false)

  function readSelection(el: HTMLTextAreaElement) {
    const { selectionStart: start, selectionEnd: end } = el
    setSel(end - start >= 2 ? { start, end } : null)
  }

  async function apply(action: string) {
    if (!sel) return
    const selected = value.slice(sel.start, sel.end)
    setBusy(true)
    try {
      const res = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selected, action }),
      })
      const data = await res.json()
      if (!data.text) throw new Error(data.error ?? 'Rewrite failed')
      onChange(value.slice(0, sel.start) + data.text + value.slice(sel.end))
      setSel(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rewrite failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      {sel && (
        <div
          className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-full border px-1.5 py-1 shadow-xl"
          style={{ background: 'var(--bg-2)', borderColor: 'var(--line-2)' }}
        >
          {busy ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 text-[12px] text-[var(--ink-2)]">
              <Loader2 size={12} className="animate-spin" /> Rewriting…
            </span>
          ) : (
            <>
              <Wand2 size={13} className="ml-1 mr-0.5 text-[var(--accent-violet)]" />
              {ACTIONS.map((a) => (
                <button
                  key={a.key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => apply(a.key)}
                  className="rounded-full px-2 py-1 text-[12px] font-medium text-[var(--ink-2)] transition-colors hover:bg-[rgba(127,127,127,0.12)] hover:text-[var(--ink-1)]"
                >
                  {a.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={(e) => readSelection(e.currentTarget)}
        onMouseUp={(e) => readSelection(e.currentTarget)}
        onKeyUp={(e) => readSelection(e.currentTarget)}
        rows={rows}
        className={className}
        placeholder={placeholder}
      />
    </div>
  )
}
