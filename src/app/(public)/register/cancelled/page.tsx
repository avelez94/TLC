'use client'

import Link from 'next/link'

export default function RegisterCancelled() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-montserrat), sans-serif', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.75rem' }}>Payment cancelled</span>
        <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 3rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '1rem' }}>No worries.</h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.75, marginBottom: '2rem' }}>
          Your registration was saved but payment was not completed. You can try again whenever you are ready, or reach out if you have any questions.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Try Again</Link>
          <Link href="/contact" className="btn btn-ghost-dark" style={{ fontSize: '0.85rem' }}>Contact Us</Link>
        </div>
      </div>
    </div>
  )
}
