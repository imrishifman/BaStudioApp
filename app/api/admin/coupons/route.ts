import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'imri@babalata.com'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.email !== ADMIN_EMAIL)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { code, applicablePlan, discountValue, maxUses } = await req.json()
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  const coupon = await prisma.couponCode.create({
    data: {
      code: code.toUpperCase(),
      discountType: 'percentage',
      discountValue: discountValue ?? 100,
      applicablePlan: applicablePlan ?? null,
      maxUses: maxUses ?? 0,
    },
  })
  return NextResponse.json(coupon)
}
