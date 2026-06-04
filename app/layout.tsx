import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from '@/components/providers'
import { ScrollToTopOnNav } from '@/components/common/ScrollToTopOnNav'
import { ReferralTracker } from '@/components/common/ReferralTracker'

// Google Ads (gtag.js) global site tag.
const GOOGLE_ADS_ID = 'AW-18210615432'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Ba Studio · AI Podcast Production',
  description:
    'From the first idea to the final cut, in one studio that learns how you sound.',
  openGraph: {
    title: 'Ba Studio',
    description: 'AI-powered podcast production studio',
    type: 'website',
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
          {children}
        </Providers>
      </body>
    </html>
  )
}
