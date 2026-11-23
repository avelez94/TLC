import { redirect } from 'next/navigation'
import { getSessionUserWithRole } from '@/lib/supabase-server'
import TwoStepSetup from '../admin/components/TwoStepSetup'

// Shown when two-step verification is required for administrators and this admin has not set
// it up yet. Nothing else in the admin area (or the database) is available until they do.
export default async function AdminSetupPage() {
  const session = await getSessionUserWithRole()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')
  if (!session.mfaEnrollRequired) redirect('/admin')
  return (
    <main style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', fontFamily: 'var(--font-montserrat), sans-serif' }}>
      <div style={{ background: 'white', maxWidth: '560px', width: '100%', borderRadius: '8px', padding: '2rem', borderTop: '4px solid var(--gold)', boxShadow: '0 10px 40px rgba(0,23,55,0.08)' }}>
        <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0 0 0.5rem' }}>Set up two-step verification</h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
          Two-step verification is now required for every administrator. It takes about five minutes and protects participant records if a password is ever stolen.
        </p>
        <TwoStepSetup redirectTo="/admin/dashboard" />
      </div>
    </main>
  )
}
