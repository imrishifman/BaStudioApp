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

function SignInController() {
  const searchParams = useSearchParams()
  const [signInOpen, setSignInOpen] = useState(false)

  // NextAuth redirects failed sign-ins to the error page (/?autherror=1).
  // Surface that as a visible message instead of a silent bounce to home.
  const authError = searchParams.get('autherror') === '1'

  useEffect(() => {
    if (searchParams.get('signin') === '1' || searchParams.get('autherror') === '1') {
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
      window.history.replaceState({}, '', url.toString())
    }
  }

  return (
    <SignInDialog
      open={signInOpen}
      onOpenChange={handleSignInClose}
      initialError={
        authError
          ? "We couldn't sign you in. Please try again, or use a different method."
          : undefined
      }
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
