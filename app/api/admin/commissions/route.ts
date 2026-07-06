import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { updateCommissionConfig } from '@/lib/commission/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Admin-only mutations for the commissions dashboard. Single action-dispatch
// endpoint to keep the surface small.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const action = body?.action as string | undefined

  try {
    switch (action) {
      case 'create-caller': {
        const name = String(body.name ?? '').trim()
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!name || !email) return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
        const caller = await prisma.caller.create({ data: { name, email, contact: body.contact ? String(body.contact) : null } })
        return NextResponse.json(caller)
      }
      case 'update-caller': {
        const id = String(body.id ?? '')
        const data: { name?: string; status?: 'active' | 'inactive' } = {}
        if (typeof body.name === 'string') data.name = body.name.trim()
        if (body.status === 'active' || body.status === 'inactive') data.status = body.status
        const caller = await prisma.caller.update({ where: { id }, data })
        return NextResponse.json(caller)
      }
      case 'assign': {
        const studioId = String(body.studioId ?? '')
        const callerId = body.callerId ? String(body.callerId) : null
        const studio = await prisma.influencer.update({ where: { id: studioId }, data: { callerId } })
        return NextResponse.json({ id: studio.id, callerId: studio.callerId })
      }
      case 'mark-paid': {
        const recipientType = body.recipientType === 'caller' ? 'caller' : 'studio'
        const recipientId = String(body.recipientId ?? '')
        const period = String(body.period ?? '')
        if (!recipientId || !period) return NextResponse.json({ error: 'Missing recipient or period' }, { status: 400 })
        const r = await prisma.commissionEvent.updateMany({
          where: { recipientType, recipientId, period, status: 'pending' },
          data: { status: 'paid' },
        })
        return NextResponse.json({ marked: r.count })
      }
      case 'update-config': {
        const c = body.config ?? {}
        const patch: Record<string, number | null> = {}
        const nums = ['callerRate', 'callerDurationMonths', 'studioRate', 'bonusAmount', 'bonusPerNStudios'] as const
        for (const k of nums) if (typeof c[k] === 'number' && !Number.isNaN(c[k])) patch[k] = c[k]
        if (c.studioDurationMonths === null) patch.studioDurationMonths = null
        else if (typeof c.studioDurationMonths === 'number') patch.studioDurationMonths = c.studioDurationMonths
        const updated = await updateCommissionConfig(patch)
        return NextResponse.json(updated)
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    console.error('Commissions admin action error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Action failed' }, { status: 500 })
  }
}
