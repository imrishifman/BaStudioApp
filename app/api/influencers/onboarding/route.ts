import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { influencerId } = await req.json()

  const influencer = await prisma.influencer.findUnique({ where: { id: influencerId } })
  if (!influencer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let accountId = influencer.stripeAccountId
  if (!accountId) {
    const account = await stripe.accounts.create({ type: 'express', email: influencer.email ?? undefined })
    accountId = account.id
    await prisma.influencer.update({ where: { id: influencerId }, data: { stripeAccountId: accountId, stripeOnboardingSent: true } })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bastudio.app'
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/influencer-onboarding?refresh=1`,
    return_url: `${appUrl}/influencer-onboarding?success=1`,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: link.url })
}
