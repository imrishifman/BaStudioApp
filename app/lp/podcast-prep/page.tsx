import type { Metadata } from 'next'
import { LpCta } from './LpCta'
import { BaLogo } from '@/components/brand/BaLogo'
import { JsonLd } from '@/components/seo/JsonLd'
import { absoluteUrl } from '@/lib/site'
import {
  softwareApplicationJsonLd,
  faqPageJsonLd,
  type FaqItem,
} from '@/lib/structured-data'

// Per-page SEO. Self-referencing canonical so paid URLs with ad params don't
// fragment indexing.
export const metadata: Metadata = {
  title: 'Podcast prep, from a name to a full episode',
  description:
    'Ba Studio turns a guest’s name into a full, on-brand podcast episode in minutes. Research, script, and show notes in your voice. Try it free.',
  alternates: { canonical: absoluteUrl('/lp/podcast-prep') },
  openGraph: {
    title: 'From a guest’s name to a full episode, in minutes',
    description:
      'Ba Studio turns a guest’s name into a full, on-brand podcast episode in minutes. Try it free.',
    url: absoluteUrl('/lp/podcast-prep'),
    type: 'website',
  },
}

const PROOF_POINTS = [
  {
    title: 'Minutes, not days',
    body: 'Go from a guest’s name to a recording-ready episode while your coffee is still hot.',
  },
  {
    title: 'Sounds like you',
    body: 'The studio learns your show’s voice and format, so every draft stays on-brand.',
  },
  {
    title: 'One place, end to end',
    body: 'Research, questions, script, and show notes all live together. No more tab juggling.',
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Drop in a guest',
    body: 'Type a name. Ba Studio pulls together a briefing and the angles worth covering.',
  },
  {
    n: '2',
    title: 'Shape the episode',
    body: 'Pick the format and focus. A guided flow builds the structure with you.',
  },
  {
    n: '3',
    title: 'Generate in your voice',
    body: 'Get a script, questions, and show notes written the way your show actually sounds.',
  },
  {
    n: '4',
    title: 'Record and publish',
    body: 'Walk in with everything prepped, hit record, and ship the episode.',
  },
]

const TESTIMONIALS = [
  {
    quote:
      'I prep a full interview in the time it used to take me to write the intro. It actually sounds like my show.',
    name: 'Maya R.',
    role: 'Host, weekly interview podcast',
  },
  {
    quote:
      'The guest research alone is worth it. I show up knowing exactly what to ask.',
    name: 'Daniel K.',
    role: 'Producer, business show',
  },
  {
    quote:
      'We went from two episodes a month to one a week without adding headcount.',
    name: 'Priya S.',
    role: 'Founder, media studio',
  },
]

const PRICING = [
  { name: 'Free', price: '$0', note: 'Start producing today' },
  { name: 'Studio Solo', price: '$19.99', note: 'per month, for solo creators' },
  { name: 'Master', price: '$29.99', note: 'per month, for power users and teams' },
]

const FAQS: FaqItem[] = [
  {
    question: 'How fast can I really prep an episode?',
    answer:
      'Most hosts go from a guest’s name to a recording-ready episode in a few minutes. You review and tweak; Ba Studio does the heavy lifting.',
  },
  {
    question: 'Will the output sound like my show?',
    answer:
      'Yes. Ba Studio learns your show’s voice, tone, and format over time, so scripts and show notes stay on-brand rather than generic.',
  },
  {
    question: 'Do I need a credit card to try it?',
    answer:
      'No. The Free plan lets you start producing right away. Upgrade to Studio Solo or Master when you want more.',
  },
  {
    question: 'What does it cost?',
    answer:
      'Free is $0. Studio Solo is $19.99 per month and Master is $29.99 per month, with annual billing available on paid plans.',
  },
]

export default function PodcastPrepLandingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-0)' }}>
      <JsonLd data={[softwareApplicationJsonLd(), faqPageJsonLd(FAQS)]} />

      {/* Minimal nav: brand + single CTA. */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-5 py-4 sm:px-8"
        style={{
          background: 'color-mix(in srgb, var(--bg-0) 80%, transparent)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--line-1)',
        }}
      >
        <BaLogo size={28} className="text-[var(--ink-1)]" />
        <LpCta className="pill-primary pill-primary-sm">Try Ba Studio Free</LpCta>
      </header>

      {/* Hero (above the fold, server-rendered for a fast LCP). */}
      <section className="mx-auto max-w-[1100px] px-5 pb-16 pt-20 text-center sm:px-8 sm:pt-28">
        <p className="eyebrow mb-6 text-[var(--ink-3)]">AI podcast production</p>
        <h1 className="display-xl text-gradient mx-auto mb-6" style={{ maxWidth: '18ch' }}>
          From a guest’s name to a full episode, in minutes
        </h1>
        <p className="body-lg mx-auto mb-10 text-[var(--ink-2)]" style={{ maxWidth: '52ch' }}>
          Ba Studio researches your guest, builds the episode, and writes the
          script and show notes in your voice. You review, record, and publish.
        </p>
        <LpCta className="pill-primary pill-primary-lg">Try Ba Studio Free</LpCta>
        <p className="body-sm mt-4 text-[var(--ink-3)]">No credit card required.</p>
      </section>

      {/* Proof points */}
      <section className="mx-auto max-w-[1100px] px-5 pb-20 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-3">
          {PROOF_POINTS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl p-6"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
            >
              <h3 className="display-sm mb-2 text-[var(--ink-1)]">{p.title}</h3>
              <p className="body text-[var(--ink-2)]">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1100px] px-5 pb-20 sm:px-8">
        <h2 className="display-md mb-10 text-center text-[var(--ink-1)]">How it works</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl p-6"
              style={{ background: 'var(--bg-1)', border: '1px solid var(--line-1)' }}
            >
              <div
                className="mb-4 flex h-9 w-9 items-center justify-center rounded-full font-semibold"
                style={{ background: 'var(--accent-violet)', color: 'var(--bg-0)' }}
              >
                {s.n}
              </div>
              <h3 className="body font-semibold text-[var(--ink-1)]">{s.title}</h3>
              <p className="body-sm mt-2 text-[var(--ink-2)]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-[1100px] px-5 pb-20 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-2xl p-6"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
            >
              <blockquote className="body flex-1 text-[var(--ink-1)]">“{t.quote}”</blockquote>
              <figcaption className="body-sm mt-4 text-[var(--ink-3)]">
                <span className="font-semibold text-[var(--ink-2)]">{t.name}</span>, {t.role}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Pricing snapshot */}
      <section className="mx-auto max-w-[1100px] px-5 pb-20 sm:px-8">
        <h2 className="display-md mb-10 text-center text-[var(--ink-1)]">Simple pricing</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {PRICING.map((tier) => (
            <div
              key={tier.name}
              className="rounded-2xl p-6 text-center"
              style={{ background: 'var(--bg-1)', border: '1px solid var(--line-1)' }}
            >
              <p className="eyebrow text-[var(--ink-3)]">{tier.name}</p>
              <p className="display-md mt-2 text-[var(--ink-1)]">{tier.price}</p>
              <p className="body-sm mt-2 text-[var(--ink-2)]">{tier.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <LpCta className="pill-primary pill-primary-lg">Try Ba Studio Free</LpCta>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[760px] px-5 pb-24 sm:px-8">
        <h2 className="display-md mb-10 text-center text-[var(--ink-1)]">Questions</h2>
        <div className="space-y-4">
          {FAQS.map((f) => (
            <details
              key={f.question}
              className="rounded-2xl p-5"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
            >
              <summary className="body cursor-pointer font-semibold text-[var(--ink-1)]">
                {f.question}
              </summary>
              <p className="body mt-3 text-[var(--ink-2)]">{f.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer
        className="px-5 py-8 text-center sm:px-8"
        style={{ borderTop: '1px solid var(--line-1)' }}
      >
        <p className="body-sm text-[var(--ink-3)]">© Ba Studio. All rights reserved.</p>
      </footer>
    </div>
  )
}
