import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Ba-Studio — AI Podcast Production',
  description:
    'From the first idea to the final cut — in one studio that learns how you sound.',
  openGraph: {
    title: 'Ba-Studio',
    description: 'AI-powered podcast production studio',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-black text-[#f5f5f7] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
