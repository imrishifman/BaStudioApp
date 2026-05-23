import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppPricingClient } from './pricing-client'

export default async function AppPricingPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  return <AppPricingClient currentPlan={session.user.plan} />
}
