'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PillButton } from './PillButton'
import { Separator } from '@/components/ui/separator'

interface SignInDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    await signIn('resend', { email, redirect: false })
    setSent(true)
    setLoading(false)
  }

  async function handleGoogleSignIn() {
    await signIn('google', { callbackUrl: '/studio' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border-[var(--line-1)]"
        style={{ background: 'var(--bg-2)' }}
      >
        <DialogHeader>
          <DialogTitle className="display-sm text-[var(--ink-1)]">
            {sent ? 'Check your inbox' : 'Sign in to Ba-Studio'}
          </DialogTitle>
          <DialogDescription className="body text-[var(--ink-2)] mt-1">
            {sent
              ? `We sent a magic link to ${email}`
              : "No password needed — we'll email you a magic link."}
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <div className="flex flex-col gap-4 pt-2">
            <form onSubmit={handleEmailSignIn} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signin-email" className="body-sm text-[var(--ink-2)]">
                  Email
                </Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-[var(--line-2)] bg-[var(--bg-3)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]"
                  required
                  autoFocus
                />
              </div>
              <PillButton type="submit" disabled={loading} className="w-full">
                {loading ? 'Sending…' : 'Send magic link'}
              </PillButton>
            </form>

            <div className="flex items-center gap-3">
              <Separator className="flex-1 bg-[var(--line-1)]" />
              <span className="body-sm text-[var(--ink-3)]">or</span>
              <Separator className="flex-1 bg-[var(--line-1)]" />
            </div>

            <PillButton variant="secondary" onClick={handleGoogleSignIn} className="w-full">
              Continue with Google
            </PillButton>
          </div>
        ) : (
          <div className="pt-2">
            <PillButton
              variant="secondary"
              onClick={() => {
                setSent(false)
                setEmail('')
              }}
              className="w-full"
            >
              Use a different email
            </PillButton>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
