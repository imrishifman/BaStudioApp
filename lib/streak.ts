const WEEK = 7 * 24 * 60 * 60 * 1000

// Monday 00:00 of the given date, as a timestamp.
function weekStart(d: Date): number {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = (date.getDay() + 6) % 7 // Monday = 0
  date.setDate(date.getDate() - day)
  return date.getTime()
}

export interface StreakInfo {
  streak: number
  publishedThisWeek: boolean
  atRisk: boolean
  recent: boolean[] // last 6 weeks, oldest -> newest
}

export function computeStreak(dates: (string | Date | null)[]): StreakInfo {
  const weeks = new Set(
    dates.filter(Boolean).map((d) => weekStart(new Date(d as string | Date)))
  )
  const thisWeek = weekStart(new Date())

  // Count consecutive weeks. If nothing yet this week, a publish last week
  // still keeps the streak alive (but flags it at-risk).
  let cursor = thisWeek
  if (!weeks.has(cursor)) cursor -= WEEK
  let streak = 0
  while (weeks.has(cursor)) {
    streak++
    cursor -= WEEK
  }

  const publishedThisWeek = weeks.has(thisWeek)
  const recent: boolean[] = []
  for (let i = 5; i >= 0; i--) recent.push(weeks.has(thisWeek - i * WEEK))

  return { streak, publishedThisWeek, atRisk: streak > 0 && !publishedThisWeek, recent }
}
