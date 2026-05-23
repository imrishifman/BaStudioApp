'use client'

import { Toaster as Sonner, type ToasterProps } from 'sonner'

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        style: {
          background: 'var(--bg-2)',
          border: '1px solid var(--line-1)',
          color: 'var(--ink-1)',
        },
      }}
      {...props}
    />
  )
}
