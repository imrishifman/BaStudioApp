import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'
import { faqPageJsonLd, type FaqItem } from '@/lib/structured-data'
import { absoluteUrl } from '@/lib/site'
import { NameGeneratorClient } from './NameGeneratorClient'

const PATH = '/tools/podcast-name-generator'

export const metadata: Metadata = {
  title: 'Free AI Podcast Name Generator',
  description:
    'Generate dozens of catchy, brandable podcast name ideas in seconds with this free AI podcast name generator. No signup needed. Built by Ba Studio.',
  alternates: { canonical: absoluteUrl(PATH) },
  openGraph: {
    title: 'Free AI Podcast Name Generator',
    description:
      'Describe your show and get 12 brandable podcast name ideas in seconds. Free, no signup. Built by Ba Studio.',
    url: absoluteUrl(PATH),
    type: 'website',
  },
}

// Question-led sections, each opening with a short direct answer, plus an FAQ
// with FAQPage structured data. This is the Answer Engine Optimization (AEO)
// pattern: it helps AI assistants (ChatGPT, Perplexity, Gemini) quote the page.
const FAQ: FaqItem[] = [
  {
    question: 'Is this podcast name generator free?',
    answer:
      'Yes. The Ba Studio AI podcast name generator is completely free and needs no signup. Describe your show and it returns twelve brandable name ideas in seconds. You can generate as many batches as you like.',
  },
  {
    question: 'How does the AI podcast name generator work?',
    answer:
      'You type a short description of your podcast (topic, vibe, and audience) and the AI returns twelve short, brandable name ideas, each with a one line reason. It is the same kind of AI that powers the full Ba Studio production tool.',
  },
  {
    question: 'What makes a good podcast name?',
    answer:
      'A good podcast name is short, easy to say and spell, and hints at the topic or feeling of the show. Aim for one to four words, make sure the matching domain and social handles are available, and pick something you will still like after a hundred episodes.',
  },
  {
    question: 'Can I use these podcast names commercially?',
    answer:
      'Yes, the names are yours to use. Before you launch, search to confirm no other active show uses the same name, and check that the domain and podcast directories are available so listeners can find you.',
  },
]

export default function PodcastNameGeneratorPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 lg:py-24">
      <JsonLd data={faqPageJsonLd(FAQ)} />

      <header className="mb-8 text-center">
        <p className="eyebrow mb-3 text-[var(--accent-violet)]">Free tool</p>
        <h1 className="display-md text-[var(--ink-1)]">Free AI Podcast Name Generator</h1>
        <p className="body-lg mx-auto mt-3 max-w-xl text-[var(--ink-2)]">
          Describe your show and get twelve catchy, brandable podcast name ideas in seconds. No signup, no limits to get started.
        </p>
      </header>

      <NameGeneratorClient />

      {/* AEO content: each heading opens with a short, direct, factual answer. */}
      <section className="mt-16 space-y-10">
        <div>
          <h2 className="display-sm text-[var(--ink-1)]">How do you come up with a podcast name?</h2>
          <p className="body mt-2 text-[var(--ink-2)]">
            Start from your show's topic, audience, and tone, then brainstorm short names that capture one of those. A fast way is to describe the show in a sentence and let an AI generator produce a batch of ideas, then shortlist the ones that are easy to say, easy to spell, and still available as a domain.
          </p>
        </div>
        <div>
          <h2 className="display-sm text-[var(--ink-1)]">What makes a good podcast name?</h2>
          <p className="body mt-2 text-[var(--ink-2)]">
            A good podcast name is one to four words, memorable, and easy to search for. It hints at the subject or the feeling of the show without being so literal that it limits you later. Before committing, check that the domain and the handles on the major platforms are free.
          </p>
        </div>
        <div>
          <h2 className="display-sm text-[var(--ink-1)]">From name to finished episode</h2>
          <p className="body mt-2 text-[var(--ink-2)]">
            Naming the show is step one. Ba Studio is an AI podcast production tool that takes it from there: it helps you plan episodes, prepare interview questions, write show notes and descriptions, and produce your podcast with AI that learns how you sound. Solo plans start at 19.99 dollars per month, with a Master tier for agencies and producers running multiple shows.
          </p>
        </div>
      </section>

      {/* Visible FAQ, mirrored by the FAQPage structured data above. */}
      <section className="mt-16">
        <h2 className="display-sm mb-6 text-[var(--ink-1)]">Frequently asked questions</h2>
        <div className="space-y-6">
          {FAQ.map((item) => (
            <div key={item.question}>
              <h3 className="body font-semibold text-[var(--ink-1)]">{item.question}</h3>
              <p className="body-sm mt-1 text-[var(--ink-2)]">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
