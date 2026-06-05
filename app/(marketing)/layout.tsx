import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { LenisScroll } from '@/components/marketing/LenisScroll'
import { JsonLd } from '@/components/seo/JsonLd'
import { organizationJsonLd, softwareApplicationJsonLd } from '@/lib/structured-data'

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Site-wide structured data for the public marketing surface. */}
      <JsonLd data={[organizationJsonLd(), softwareApplicationJsonLd()]} />
      <LenisScroll />
      <MarketingNav />
      <main className="min-h-screen">{children}</main>
      <MarketingFooter />
    </>
  )
}
