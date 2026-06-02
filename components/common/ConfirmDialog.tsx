'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PillButton } from '@/components/common/PillButton'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

// App-styled replacement for window.confirm(). Returns a promise that resolves
// true/false, so call sites read `if (await confirm({ ... }))`.
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider')
  return ctx
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions>({ message: '' })
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = useCallback((v: boolean) => {
    setOpen(false)
    resolver.current?.(v)
    resolver.current = null
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(v) => { if (!v) settle(false) }}>
        <DialogContent
          showCloseButton={false}
          className="max-w-sm border-[var(--line-1)]"
          style={{ background: 'var(--bg-2)' }}
        >
          <DialogHeader>
            <DialogTitle className="display-sm text-[var(--ink-1)]">
              {opts.title ?? 'Are you sure?'}
            </DialogTitle>
          </DialogHeader>
          <p className="body text-[var(--ink-2)]">{opts.message}</p>
          <div className="flex justify-end gap-3 pt-2">
            <PillButton variant="secondary" size="sm" onClick={() => settle(false)}>
              {opts.cancelLabel ?? 'Cancel'}
            </PillButton>
            <PillButton
              size="sm"
              onClick={() => settle(true)}
              className={opts.destructive ? '!bg-[var(--error)] !text-white' : undefined}
            >
              {opts.confirmLabel ?? 'Confirm'}
            </PillButton>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
