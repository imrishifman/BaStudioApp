import { SITE_URL, absoluteUrl } from '@/lib/site'

// Shared JSON-LD builders. Keeping them here means the marketing layout and the
// paid landing page emit identical, consistent structured data.

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ba Studio',
    url: SITE_URL,
    logo: absoluteUrl('/logo.png'),
    description:
      'AI podcast production studio. From a guest’s name to a finished, on-brand episode in minutes.',
  }
}

// SoftwareApplication with an offer per pricing tier (Free / Studio Solo /
// Master). Prices are plain numbers in USD, matching the conversion values.
export function softwareApplicationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Ba Studio',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description:
      'AI podcast production studio: research guests, build episodes, and generate scripts and show notes in your voice.',
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: '0',
        priceCurrency: 'USD',
      },
      {
        '@type': 'Offer',
        name: 'Studio Solo',
        price: '19.99',
        priceCurrency: 'USD',
      },
      {
        '@type': 'Offer',
        name: 'Master',
        price: '29.99',
        priceCurrency: 'USD',
      },
    ],
  }
}

export interface FaqItem {
  question: string
  answer: string
}

export function faqPageJsonLd(items: FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}
