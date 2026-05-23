'use client'

import { useEffect, useState } from 'react'
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
  initialError?: string
}

type Mode = 'signin' | 'signup'

const inputCls =
  'border-[var(--line-2)] bg-[var(--bg-3)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]'
const labelCls = 'body-sm text-[var(--ink-2)]'

export function SignInDialog({ open, onOpenChange, initialError }: SignInDialogProps) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Seed an error passed in from the page (e.g. after a failed redirect).
  useEffect(() => {
    if (open && initialError) setError(initialError)
  }, [open, initialError])

  function resetFields() {
    setPassword('')
    setConfirm('')
    setError(null)
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
      if (password !== confirm) {
        setError('Passwords do not match.')
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName: fullName || undefined }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data.error ?? 'Could not create your account.')
          setLoading(false)
          return
        }
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(
          mode === 'signup'
            ? 'Account created, but sign-in failed. Try signing in.'
            : 'Invalid email or password.'
        )
        setLoading(false)
        return
      }

      window.location.href = '/studio'
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    await signIn('google', { callbackUrl: '/studio' })
  }

  const isSignup = mode === 'signup'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border-[var(--line-1)]"
        style={{ background: 'var(--bg-2)' }}
      >
        <DialogHeader>
          <DialogTitle className="display-sm text-[var(--ink-1)]">
            {isSignup ? 'Create your account' : 'Sign in to Ba-Studio'}
          </DialogTitle>
          <DialogDescription className="body text-[var(--ink-2)] mt-1">
            {isSignup
              ? 'Start producing podcasts the way you imagine them.'
              : 'Welcome back. Sign in to continue.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
            {isSignup && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signin-name" className={labelCls}>
                  Name
                </Label>
                <Input
                  id="signin-name"
                  type="text"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signin-email" className={labelCls}>
                Email
              </Label>
              <Input
                id="signin-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                required
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signin-password" className={labelCls}>
                Password
              </Label>
              <Input
                id="signin-password"
                type="password"
                placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                required
                minLength={isSignup ? 8 : undefined}
              />
            </div>

            {isSignup && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signin-confirm" className={labelCls}>
                  Confirm password
                </Label>
                <Input
                  id="signin-confirm"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            )}

            {error && (
              <p className="body-sm text-[var(--error)]" role="alert">
                {error}
              </p>
            )}

            <PillButton type="submit" disabled={loading} className="w-full">
              {loading
                ? isSignup
                  ? 'Creating account…'
                  : 'Signing in…'
                : isSignup
                  ? 'Create account'
                  : 'Sign in'}
            </PillButton>
          </form>

          <div className="flex items-center gap-3">
            <Separator className="flex-1 bg-[var(--line-1)]" />
            <span className="body-sm text-[var(--ink-3)]">or</span>
            <Separator className="flex-1 bg-[var(--line-1)]" />
          </div>

          <PillButton
            variant="secondary"
            onClick={handleGoogleSignIn}
            className="w-full"
          >
            Continue with Google
          </PillButton>

          <p className="body-sm text-center text-[var(--ink-3)]">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? 'signin' : 'signup')
                resetFields()
              }}
              className="font-semibold text-[var(--accent-violet)] hover:underline"
            >
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
