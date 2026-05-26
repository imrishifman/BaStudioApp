import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { ScrollToTopOnNav } from '@/components/common/ScrollToTopOnNav'

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

// Set the saved theme before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('ba-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}`

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
        <Providers>
          <ScrollToTopOnNav />
          {children}
        </Providers>
      </body>
    </html>
  )
}
