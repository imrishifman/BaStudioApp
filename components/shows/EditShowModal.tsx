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
  hostName: z.string().optional(),
  targetAudience: z.string().optional(),
})
type FormData = z.infer<typeof schema>

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
    if (show) reset({ name: show.name, description: show.description ?? '', hostName: show.hostName ?? '', targetAudience: show.targetAudience ?? '' })
    else reset({ name: '', description: '', hostName: '', targetAudience: '' })
  }, [show, reset])

  async function onSubmit(data: FormData) {
    const url = show ? `/api/shows/${show.id}` : '/api/shows'
    const method = show ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (res.ok) { onOpenChange(false); onSaved() }
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
            <Input {...register('name')} className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" />
            {errors.name && <p className="body-sm text-[var(--error)]">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="body-sm text-[var(--ink-2)]">Description</Label>
            <Textarea {...register('description')} rows={3} className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="body-sm text-[var(--ink-2)]">Host name</Label>
            <Input {...register('hostName')} className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="body-sm text-[var(--ink-2)]">Target audience</Label>
            <Input {...register('targetAudience')} className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" />
          </div>
          <div className="flex gap-3 pt-2">
            <PillButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save show'}</PillButton>
            <PillButton variant="secondary" type="button" onClick={() => onOpenChange(false)}>Cancel</PillButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
