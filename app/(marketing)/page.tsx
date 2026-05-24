'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { Hero } from '@/components/marketing/Hero'
import { TheWayItWorks } from '@/components/marketing/TheWayItWorks'
import { DNASection } from '@/components/marketing/DNASection'
import { Numbers } from '@/components/marketing/Numbers'
import { Quotes } from '@/components/marketing/Quotes'
import { PricingSection } from '@/components/marketing/PricingSection'
import { FinalCTA } from '@/components/marketing/FinalCTA'
import { SignInDialog } from '@/components/common/SignInDialog'

function authErrorMessage(code: string | null): string {
  switch (code) {
    case 'OAuthAccountNotLinked':
      return 'That email is already registered with a password. Sign in with your email and password instead.'
    case 'AccessDenied':
      return 'Access was denied. Try a different account.'
    case 'Configuration':
      return 'Sign-in is temporarily misconfigured. Please try again shortly.'
    case 'Verification':
      return 'That sign-in link has expired. Please try again.'
    default:
      return code
        ? `We couldn't sign you in (error: ${code}). Please try again.`
        : "We couldn't sign you in. Please try again, or use a different method."
  }
}

function SignInController() {
  const searchParams = useSearchParams()
  const [signInOpen, setSignInOpen] = useState(false)

  // NextAuth redirects failed sign-ins to the error page (/?autherror=1) and
  // appends ?error=<Code>. Surface the specific reason instead of a silent bounce.
  const errorCode = searchParams.get('error')
  const authError = searchParams.get('autherror') === '1' || !!errorCode

  useEffect(() => {
    if (
      searchParams.get('signin') === '1' ||
      searchParams.get('autherror') === '1' ||
      searchParams.get('error')
    ) {
      setSignInOpen(true)
    }
  }, [searchParams])

  function handleSignInClose(open: boolean) {
    setSignInOpen(open)
    if (!open) {
      // Remove sign-in params without navigating
      const url = new URL(window.location.href)
      url.searchParams.delete('signin')
      url.searchParams.delete('autherror')
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
    }
  }

  return (
    <SignInDialog
      open={signInOpen}
      onOpenChange={handleSignInClose}
      initialError={authError ? authErrorMessage(errorCode) : undefined}
    />
  )
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <TheWayItWorks />
      <DNASection />
      <Numbers />
      <Quotes />
      <PricingSection />
      <FinalCTA />
      <Suspense fallback={null}>
        <SignInController />
      </Suspense>
    </>
  )
}
