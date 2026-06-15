import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { getResend, RESEND_FROM } from '@/lib/email/client'
import { emailLayout } from '@/lib/email/layout'
import { rangeDates } from './range'
import { getTotals as gscTotals, getTopQueries, getTopPages } from './search-console'
import { getSessionsOverTime, getTrafficBySourceMedium, getAiAssistantTraffic } from './ga4-data'

// Daily SEO report: pulls Search Console + GA4 + AI-referral data for the last
// 7 and 28 days plus the prior 7 for comparison, asks Claude for a concise,
// number-grounded report with prioritized actions, stores it, and optionally
// emails it. Each data source is wrapped so a missing one (e.g. Search Console
// not yet verified) degrades gracefully instead of failing the whole run.

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn()
  } catch (e) {
    return { error: `${label}: ${e instanceof Error ? e.message : 'failed'}` }
  }
}

async function buildSummary() {
  const w = rangeDates('7d')
  const m = rangeDates('28d')
  const [
    gsc7, gsc7prev, gsc28, topQueries, topPages,
    ga7, ga7prev, sources28, ai7, ai28,
  ] = await Promise.all([
    safe('gsc', () => gscTotals(w.startDate, w.endDate)),
    safe('gsc', () => gscTotals(w.prevStartDate, w.prevEndDate)),
    safe('gsc', () => gscTotals(m.startDate, m.endDate)),
    safe('gsc', () => getTopQueries(m.startDate, m.endDate, 10)),
    safe('gsc', () => getTopPages(m.startDate, m.endDate, 10)),
    safe('ga4', async () => (await getSessionsOverTime(w.startDate, w.endDate)).reduce((s, d) => s + d.sessions, 0)),
    safe('ga4', async () => (await getSessionsOverTime(w.prevStartDate, w.prevEndDate)).reduce((s, d) => s + d.sessions, 0)),
    safe('ga4', () => getTrafficBySourceMedium(m.startDate, m.endDate, 10)),
    safe('ga4', () => getAiAssistantTraffic(w.startDate, w.endDate)),
    safe('ga4', () => getAiAssistantTraffic(m.startDate, m.endDate)),
  ])
  return {
    periods: { week: w, month: m },
    searchConsole: { last7: gsc7, prev7: gsc7prev, last28: gsc28, topQueries, topPages },
    analytics: { sessions7: ga7, prevSessions7: ga7prev, sourcesMedium28: sources28 },
    aiAssistants: { last7: ai7, last28: ai28 },
  }
}

const SYSTEM = `You are an SEO analyst writing a concise daily report for the founder of bastudiopodcast.com (an AI podcast-prep tool). You are given JSON with Search Console and GA4 numbers for the last 7 days, the prior 7 days, and the last 28 days, plus AI-assistant referral traffic.

Write a short report in plain markdown with exactly these sections:
## Headline
2-3 sentences on what changed vs the prior period. Cite the actual numbers.
## Wins and warnings
A few bullets. Wins first, then warning signs.
## Do this next
3-5 SPECIFIC, prioritized actions the founder can execute immediately (e.g. "Query X ranks #11 with 40 impressions and 0 clicks: rewrite the title tag on page Y"). Each action must cite the number it is reasoning from.

Rules: Be concrete and cite numbers from the data. NEVER invent data. If a source shows an "error" field or all-zero values, say so plainly (e.g. "Search Console isn't connected yet" or "GA4 is recording almost no traffic, the tag may not be firing") and focus the actions on fixing that. No em dashes. Keep it under 350 words.`

export async function generateSeoReport(): Promise<{ id: string; content: string; emailed: boolean }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured')
  const summary = await buildSummary()

  const anthropic = new Anthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Here is today's data as JSON:\n\n${JSON.stringify(summary, null, 2)}` }],
  })
  const content = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n')
    .trim()

  // Optional email (on when SEO_REPORT_EMAIL_TO is set).
  let emailed = false
  const to = process.env.SEO_REPORT_EMAIL_TO
  const resend = getResend()
  if (to && resend) {
    try {
      const html = content
        .replace(/^### (.*)$/gm, '<h3 style="margin:16px 0 6px 0;color:#eaeaf0;font-size:15px;">$1</h3>')
        .replace(/^## (.*)$/gm, '<h2 style="margin:18px 0 8px 0;color:#eaeaf0;font-size:17px;">$1</h2>')
        .replace(/^- (.*)$/gm, '<li style="margin:2px 0;color:#c7c7cf;">$1</li>')
        .replace(/\n{2,}/g, '<br/><br/>')
      await resend.emails.send({
        from: RESEND_FROM,
        to,
        subject: 'Ba Studio SEO daily report',
        html: emailLayout({ preheader: 'Your daily SEO and traffic summary', body: html }),
      })
      emailed = true
    } catch {
      /* email is best-effort; the stored report is the source of truth */
    }
  }

  const row = await prisma.seoReport.create({ data: { content, data: summary as object, emailed } })
  return { id: row.id, content, emailed }
}
