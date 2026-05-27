import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { BillingClient } from './billing-client'

export default async function BillingPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      plan: true,
      planStatus: true,
      billingPeriod: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripePriceId: true,
    },
  })

  return (
    <BillingClient
      user={JSON.parse(JSON.stringify(user))}
    />
  )
}
