// One-off founder research outreach to free signups from 2026-05-27..2026-06-10.
//
// This file intentionally references recipients by their opaque User id ONLY
// (no names or emails), because the GitHub repo is public. Names/emails are
// read from the database at send time by /api/admin/outreach.
//
// Sent From a verified-domain address with Reply-To set to Imri's real inbox so
// every reply goes straight to him. Plain text, no marketing template, no
// unsubscribe footer (1:1 founder mail), with a plain opt-out line.

export const OUTREACH_FROM = 'Imri at Ba Studio <hello@bastudiopodcast.com>'
export const OUTREACH_REPLY_TO = 'imri@babalata.com'

export type OutreachVariant = 'activated' | 'bounced'

// The approved cohort (31): opaque user ids + their segment. Not PII.
export const OUTREACH_COHORT: { id: string; variant: OutreachVariant }[] = [
  { id: 'cmq45yypa000004if2nd81pur', variant: 'activated' }, // Obai (full script)
  { id: 'cmppl5b5s000004jpmtzlfs7w', variant: 'bounced' },
  { id: 'cmpwvjv32000004i8n4i10s1v', variant: 'bounced' },
  { id: 'cmpwyd7gz000004lehrivyxmv', variant: 'bounced' },
  { id: 'cmpx11hl4000004l5rpdb9e3c', variant: 'bounced' },
  { id: 'cmpx5wnzr000004jolnsz4elt', variant: 'bounced' },
  { id: 'cmq00ws8h000004jscw5fqyyp', variant: 'bounced' },
  { id: 'cmq07lo4x000004js1dg8zopf', variant: 'bounced' },
  { id: 'cmq0c7yyo000004k1zpbu3wyx', variant: 'bounced' },
  { id: 'cmq0dk7ly000004jsr0cywp2q', variant: 'bounced' },
  { id: 'cmq0lyny5000004l2vfwv6ngh', variant: 'bounced' },
  { id: 'cmq18gmzt000004l5e2ef78g5', variant: 'bounced' },
  { id: 'cmq1t7hy4000004jp5fq9ggx6', variant: 'bounced' },
  { id: 'cmq3idks4000004jutpfq54qb', variant: 'bounced' },
  { id: 'cmq3x872p000004l48fzmagob', variant: 'bounced' },
  { id: 'cmq46rrqv000004l7ch6jeuro', variant: 'bounced' },
  { id: 'cmq4atd9n000004l7a9m00pch', variant: 'bounced' },
  { id: 'cmq4p7j4s000004l7jgbc59d5', variant: 'bounced' },
  { id: 'cmq4rnrxb000004jymes36at6', variant: 'bounced' },
  { id: 'cmq4tfdbs000004l4s82s7cfl', variant: 'bounced' },
  { id: 'cmq4wfk1w000004l0lngu4j22', variant: 'bounced' },
  { id: 'cmq50juqi000004jfk3apqdan', variant: 'bounced' },
  { id: 'cmq57pb45000004i5jj5gm8yi', variant: 'bounced' },
  { id: 'cmq58vzi0000004kwwf244w8v', variant: 'bounced' },
  { id: 'cmq5a0b5h000004l2rxmhlhqh', variant: 'bounced' },
  { id: 'cmq6533b0000004jxm7lcpafi', variant: 'bounced' },
  { id: 'cmq6eb3w3000004jfss4fggt5', variant: 'bounced' },
  { id: 'cmq6ejb07000004jo7ytuqz6s', variant: 'bounced' },
  { id: 'cmq6h7yw4000004k09lphzmny', variant: 'bounced' },
  { id: 'cmq6le1xu000004l46i6i3qvk', variant: 'bounced' },
  { id: 'cmq6u98xt000004lbaahy9iki', variant: 'bounced' },
]

// Ids whose signup "name" isn't a real first name (handles/brands); greet these
// as "there" instead of a botty first name. Opaque ids, not PII.
const GREET_THERE_IDS = new Set<string>([
  'cmpwyd7gz000004lehrivyxmv', // "Impact pro"
  'cmq4rnrxb000004jymes36at6', // arabic-script handle
  'cmq4wfk1w000004l0lngu4j22', // "itz Sahin"
  'cmq6533b0000004jxm7lcpafi', // "Edu Xbox"
  'cmq6h7yw4000004k09lphzmny', // "abhimanyudev101"
])

// Derive the greeting first name from a stored full name, with a "there"
// fallback for empty names, digit-bearing handles, or the explicit override set.
export function outreachGreeting(userId: string, fullName: string | null): string {
  if (GREET_THERE_IDS.has(userId)) return 'there'
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? ''
  if (!first) return 'there'
  if (/\d/.test(first)) return 'there'
  return first
}

export function buildOutreachEmail(opts: {
  variant: OutreachVariant
  greeting: string
  guestName?: string | null
}): { subject: string; text: string } {
  const { variant, greeting } = opts
  if (variant === 'activated') {
    const guest = (opts.guestName ?? '').trim()
    return {
      subject: 'A quick question from the founder',
      text: `Hi ${greeting},

I'm Imri, I built Ba Studio. I saw you tried it last week and actually created an episode${guest ? ` (for ${guest})` : ''}. That's amazing, and I want to learn from you.

I'm trying to understand two things:
1. What made you sign up in the first place?
2. What would have made you upgrade to Pro?

Even one-line answers would help me enormously.

Imri
Founder, Ba Studio

Reply 'stop' if you'd rather not hear from me.`,
    }
  }
  return {
    subject: 'What stopped you?',
    text: `Hi ${greeting},

I'm Imri, I built Ba Studio. I noticed you signed up last week but didn't finish an episode. Totally normal, but I'd love to know what stopped you. Was the product unclear? Wrong fit? Too much friction at a specific step?

Even a one-sentence reply would mean a lot. If you'd like, I'll personally walk you through creating your first episode, just reply.

Imri
Founder, Ba Studio

Reply 'stop' if you'd rather not hear from me.`,
  }
}
