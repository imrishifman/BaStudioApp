import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAdmin(session.user.email))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { plan } = await req.json()

  const user = await prisma.user.update({ where: { id }, data: { plan } })
  return NextResponse.json(user)
}
