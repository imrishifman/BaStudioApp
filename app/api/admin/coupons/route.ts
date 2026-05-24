import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || !isAdmin(session.user.email))
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
