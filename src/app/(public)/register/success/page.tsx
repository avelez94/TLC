'use client'

import { Suspense } from 'react'
import Link from 'next/link'

function SuccessContent() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-montserrat), sans-serif', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '520px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.5rem' }}>✓</div>
        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.75rem' }}>Registration received</span>
        <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2.5rem, 6vw, 4rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '1.25rem' }}>You are in!</h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.8, marginBottom: '0.75rem' }}>
          Thank you for registering for The Impact Lab.
        </p>
        <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.8, marginBottom: '0.75rem' }}>
          Your registration has been received successfully. Please check your email for your confirmation.
        </p>
        <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.8, marginBottom: '2rem' }}>
          You will receive your Learning Hub invitation and program details shortly.
        </p>
        <Link href="/" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Back to Home</Link>
      </div>
    </div>
  )
}

export default function RegisterSuccess() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.08em' }}>Loading...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}