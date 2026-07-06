import type { CommissionConfigData } from './config'

// Pure, config-driven commission math. No DB, no Stripe. Every function that
// produces money also returns the rate it used so the caller can snapshot it
// onto the CommissionEvent (config changes never touch past events).

const round2 = (n: number) => Math.round(n * 100) / 100

// YYYY-MM statement period for a date (UTC).
export function periodOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

// Studio: a flat percentage of collected gross. studioDurationMonths null =
// unlimited (lifetime); a value caps it from the user's first payment.
export function studioCommission(
  gross: number,
  cfg: CommissionConfigData,
  firstPaymentDate: Date | null,
  paidAt: Date,
): { amount: number; rate: number; eligible: boolean } {
  const eligible =
    cfg.studioDurationMonths == null ||
    firstPaymentDate == null ||
    paidAt.getTime() < addMonths(firstPaymentDate, cfg.studioDurationMonths).getTime()
  return { eligible, rate: cfg.studioRate, amount: eligible ? round2(gross * cfg.studioRate) : 0 }
}

// Caller: a percentage of collected gross, but only within callerDurationMonths
// of the user's FIRST successful payment. The first payment itself is month 0.
export function isWithinCallerWindow(
  firstPaymentDate: Date | null,
  paidAt: Date,
  cfg: CommissionConfigData,
): boolean {
  if (firstPaymentDate == null) return true
  return paidAt.getTime() < addMonths(firstPaymentDate, cfg.callerDurationMonths).getTime()
}

export function callerCommission(
  gross: number,
  cfg: CommissionConfigData,
  firstPaymentDate: Date | null,
  paidAt: Date,
): { amount: number; rate: number; eligible: boolean } {
  const eligible = isWithinCallerWindow(firstPaymentDate, paidAt, cfg)
  return { eligible, rate: cfg.callerRate, amount: eligible ? round2(gross * cfg.callerRate) : 0 }
}

// Bonus thresholds newly crossed moving from prevCount -> newCount activated
// studios. e.g. per=10, 9 -> 10 returns [10]; 19 -> 21 returns [20].
export function bonusCrossings(
  prevCount: number,
  newCount: number,
  cfg: CommissionConfigData,
): number[] {
  const per = cfg.bonusPerNStudios
  if (per <= 0 || newCount <= prevCount) return []
  const from = Math.floor(prevCount / per)
  const to = Math.floor(newCount / per)
  const crossed: number[] = []
  for (let t = from + 1; t <= to; t++) crossed.push(t * per)
  return crossed
}
