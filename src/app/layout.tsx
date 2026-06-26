import type { Metadata } from 'next'
import { Bebas_Neue, Montserrat, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
})

const montserrat = Montserrat({
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Tramaine L. Crawford | TLC Leadership Consulting & Coaching',
  description: 'Helping people grow, lead, and create greater impact. Leadership consulting, coaching, and The Impact Lab.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${montserrat.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}