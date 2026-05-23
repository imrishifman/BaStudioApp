import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  const coupon = await prisma.couponCode.findUnique({ where: { code: code.toUpperCase() } })
  if (!coupon) return NextResponse.json({ error: 'Invalid code' }, { status: 404 })
  if (coupon.maxUses > 0 && coupon.usesSoFar >= coupon.maxUses)
    return NextResponse.json({ error: 'Coupon exhausted' }, { status: 410 })

  const plan = (coupon.applicablePlan ?? 'solo') as 'solo' | 'master'
  await Promise.all([
    prisma.user.update({ where: { email: session.user.email }, data: { plan } }),
    prisma.couponCode.update({ where: { id: coupon.id }, data: { usesSoFar: { increment: 1 } } }),
  ])

  return NextResponse.json({ plan })
}
