import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'imri@babalata.com'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (token) {
    const influencer = await prisma.influencer.findFirst({ where: { agreementSignatureToken: token } })
    if (!influencer) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    return NextResponse.json(influencer)
  }

  if (session.user.email !== ADMIN_EMAIL)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const influencers = await prisma.influencer.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(influencers)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.email !== ADMIN_EMAIL)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, handle, commissionValue } = await req.json()
  if (!name || !email) return NextResponse.json({ error: 'name and email required' }, { status: 400 })

  const token = crypto.randomUUID()
  const influencer = await prisma.influencer.create({
    data: {
      name,
      email,
      handle: handle ?? null,
      commissionType: 'percentage',
      commissionValue: commissionValue ?? 20,
      agreementSignatureToken: token,
    },
  })
  return NextResponse.json(influencer)
}
