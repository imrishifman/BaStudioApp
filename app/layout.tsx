import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import { Suspense } from 'react'
import './globals.css'
import { Providers } from '@/components/providers'
import { ScrollToTopOnNav } from '@/components/common/ScrollToTopOnNav'
import { ReferralTracker } from '@/components/common/ReferralTracker'
import { GtmRouteTracker } from '@/components/analytics/GtmRouteTracker'
import { GtmSignupTracker } from '@/components/analytics/GtmSignupTracker'
import { AttributionTracker } from '@/components/analytics/AttributionTracker'
import { CookieBanner } from '@/components/analytics/CookieBanner'
import { GTM_ID, gtmEnabled } from '@/lib/gtm'
import { SITE_URL } from '@/lib/site'

// Google Ads (gtag.js) global site tag.
// NOTE: This is the one remaining hardcoded ad tag. Going forward all tags
// (GA4, Google Ads, Meta Pixel) are managed in the GTM container below. Once the
// Google Ads conversion is rebuilt as a tag inside GTM, this block can be removed
// so there is a single source of truth.
const GOOGLE_ADS_ID = 'AW-18210615432'

// Consent Mode v2 defaults. Everything starts denied (US-targeted, but this is
// best practice and required for any EEA visitor). The cookie banner flips these
// to granted via gtag('consent','update', ...) when the visitor accepts. This
// inline script runs at HTML parse time, BEFORE GTM loads (afterInteractive), so
// the defaults are always in place before any tag fires.
const consentDefaultScript = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{
  ad_storage:'denied',
  analytics_storage:'denied',
  ad_user_data:'denied',
  ad_personalization:'denied',
  wait_for_update:500
});
`

// Standard GTM container loader (injected only when NEXT_PUBLIC_GTM_ID is set).
const gtmLoaderScript = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Ba Studio · AI Podcast Production',
    template: '%s · Ba Studio',
  },
  description:
    'From the first idea to the final cut, in one studio that learns how you sound.',
  openGraph: {
    title: 'Ba Studio',
    description: 'AI-powered podcast production studio',
    type: 'website',
    url: SITE_URL,
    siteName: 'Ba Studio',
  },
  // Google Search Console site verification (HTML-tag method) for the
  // bastudiopodcast.com URL-prefix property. Renders a
  // <meta name="google-site-verification"> tag in <head> on every page.
  verification: {
    google: 'DTGH6aH9EIRM2v_a9wzCWJNn4nhfzh3mopDOS5Tor6c',
  },
}

// Set the saved theme before paint to avoid a flash. The landing page ('/') is
// always dark — there is no light mode there. Every other route respects the
// user's saved preference (defaulting to dark).
const themeScript = `try{var p=location.pathname;var t=(p==='/')?'dark':(localStorage.getItem('ba-theme')||'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){}`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
        {/* GTM noscript fallback, as high in <body> as possible. */}
        {gtmEnabled && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}

        {/* Consent Mode v2 defaults + dataLayer init. Runs before GTM loads. */}
        <script dangerouslySetInnerHTML={{ __html: consentDefaultScript }} />

        {/* GTM container loader. afterInteractive so it never blocks rendering. */}
        {gtmEnabled && (
          <Script
            id="gtm-loader"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: gtmLoaderScript }}
          />
        )}

        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-ads-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_ID}');
          `}
        </Script>
        <Providers>
          <ScrollToTopOnNav />
          <ReferralTracker />
          <Suspense fallback={null}>
            <GtmRouteTracker />
          </Suspense>
          <GtmSignupTracker />
          <AttributionTracker />
          {children}
          <CookieBanner />
        </Providers>
      </body>
    </html>
  )
}
