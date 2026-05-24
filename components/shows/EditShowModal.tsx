'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PillButton } from '@/components/common/PillButton'
import type { Show } from '@prisma/client'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  category: z.string().optional(),
  publishFrequency: z.string().optional(),
  hostName: z.string().optional(),
  targetAudience: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const CATEGORIES = ['interview', 'solo', 'narrative', 'panel', 'educational', 'comedy']
const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'variable']

const fieldCls = 'bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]'
const selectCls =
  'h-10 rounded-[var(--radius-sm)] border bg-[var(--bg-3)] border-[var(--line-2)] px-3 text-sm text-[var(--ink-1)] capitalize'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  show: Show | null
  onSaved: () => void
}

export function EditShowModal({ open, onOpenChange, show, onSaved }: Props) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    reset({
      name: show?.name ?? '',
      description: show?.description ?? '',
      category: show?.category ?? '',
      publishFrequency: show?.publishFrequency ?? '',
      hostName: show?.hostName ?? '',
      targetAudience: show?.targetAudience ?? '',
    })
  }, [show, reset])

  async function onSubmit(data: FormData) {
    const payload: Record<string, unknown> = {
      name: data.name,
      description: data.description,
      hostName: data.hostName,
      targetAudience: data.targetAudience,
    }
    // Only send enum fields when set (empty string is invalid for the enum).
    if (data.category) payload.category = data.category
    if (data.publishFrequency) payload.publishFrequency = data.publishFrequency

    const url = show ? `/api/shows/${show.id}` : '/api/shows'
    const method = show ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      onOpenChange(false)
      onSaved()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--line-1)]" style={{ background: 'var(--bg-2)' }}>
        <DialogHeader>
          <DialogTitle className="display-sm text-[var(--ink-1)]">
            {show ? 'Edit show' : 'New show'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="body-sm text-[var(--ink-2)]">Show name *</Label>
            <Input {...register('name')} className={fieldCls} />
            {errors.name && <p className="body-sm text-[var(--error)]">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="body-sm text-[var(--ink-2)]">Description</Label>
            <Textarea {...register('description')} rows={2} className={fieldCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="body-sm text-[var(--ink-2)]">Category</Label>
              <select {...register('category')} className={selectCls}>
                <option value="">Select…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} style={{ background: 'var(--bg-3)' }}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="body-sm text-[var(--ink-2)]">Publish frequency</Label>
              <select {...register('publishFrequency')} className={selectCls}>
                <option value="">Select…</option>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f} style={{ background: 'var(--bg-3)' }}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="body-sm text-[var(--ink-2)]">Host name</Label>
            <Input {...register('hostName')} className={fieldCls} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="body-sm text-[var(--ink-2)]">Target audience</Label>
            <Input {...register('targetAudience')} className={fieldCls} />
          </div>

          {!show && (
            <p
              className="rounded-[var(--radius-sm)] px-3 py-2 text-[13px]"
              style={{ background: 'rgba(48,209,88,0.1)', color: 'var(--success)' }}
            >
              👑 You&apos;ll automatically become the Manager of this show.
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <PillButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save show'}
            </PillButton>
            <PillButton variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </PillButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
