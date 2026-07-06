import 'server-only'
import { prisma } from '@/lib/prisma'

// Global, tunable commission parameters (single `CommissionConfig` row).
// Cached briefly; changes apply to FUTURE events only because each event
// snapshots the rate it used (see engine.ts / events.ts).

export interface CommissionConfigData {
  callerRate: number
  callerDurationMonths: number
  studioRate: number
  studioDurationMonths: number | null
  bonusAmount: number
  bonusPerNStudios: number
}

let cached: { data: CommissionConfigData; at: number } | null = null
const TTL_MS = 60_000

function toData(row: {
  callerRate: number
  callerDurationMonths: number
  studioRate: number
  studioDurationMonths: number | null
  bonusAmount: number
  bonusPerNStudios: number
}): CommissionConfigData {
  return {
    callerRate: row.callerRate,
    callerDurationMonths: row.callerDurationMonths,
    studioRate: row.studioRate,
    studioDurationMonths: row.studioDurationMonths,
    bonusAmount: row.bonusAmount,
    bonusPerNStudios: row.bonusPerNStudios,
  }
}

export async function getCommissionConfig(): Promise<CommissionConfigData> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data
  const row = await prisma.commissionConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  })
  const data = toData(row)
  cached = { data, at: Date.now() }
  return data
}

export function invalidateCommissionConfig(): void {
  cached = null
}

export async function updateCommissionConfig(
  patch: Partial<CommissionConfigData>,
): Promise<CommissionConfigData> {
  const row = await prisma.commissionConfig.upsert({
    where: { id: 'singleton' },
    update: patch,
    create: { id: 'singleton', ...patch },
  })
  invalidateCommissionConfig()
  const data = toData(row)
  cached = { data, at: Date.now() }
  return data
}
