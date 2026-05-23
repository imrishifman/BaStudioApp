'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Hero } from '@/components/marketing/Hero'
import { TheWayItWorks } from '@/components/marketing/TheWayItWorks'
import { DNASection } from '@/components/marketing/DNASection'
import { Numbers } from '@/components/marketing/Numbers'
import { Quotes } from '@/components/marketing/Quotes'
import { PricingSection } from '@/components/marketing/PricingSection'
import { FinalCTA } from '@/components/marketing/FinalCTA'
import { SignInDialog } from '@/components/common/SignInDialog'

export default function LandingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [signInOpen, setSignInOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get('signin') === '1') {
      setSignInOpen(true)
    }
  }, [searchParams])

  function handleSignInClose(open: boolean) {
    setSignInOpen(open)
    if (!open) {
      // Remove ?signin=1 without navigate
      const url = new URL(window.location.href)
      url.searchParams.delete('signin')
      window.history.replaceState({}, '', url.toString())
    }
  }

  return (
    <>
      <Hero />
      <TheWayItWorks />
      <DNASection />
      <Numbers />
      <Quotes />
      <PricingSection />
      <FinalCTA />
      <SignInDialog open={signInOpen} onOpenChange={handleSignInClose} />
    </>
  )
}
