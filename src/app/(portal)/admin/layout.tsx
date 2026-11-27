import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUserWithRole } from '@/lib/supabase-server'
import { homeForRole } from '@/lib/access'
import { loadLaunchReadiness } from '@/lib/launch-server'
import AdminClientLayout from './AdminClientLayout'

// Server-side gate for every /admin page. Middleware also redirects, but that check is
// only a first line; this runs on the server before any admin UI or data is sent. The
// database applies the same two-step rule to every admin read and write (is_admin()).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUserWithRole()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect(homeForRole(session.role))
  if (session.mfaEnrollRequired) redirect('/admin-setup')
  if (!session.mfaSatisfied) redirect('/login?mfa=1')
  // "Online registration is on" in the admin screens means every site-wide launch condition holds
  // (owner approval, Stripe verified, policies published); cohorts still need their own setup.
  const readiness = await loadLaunchReadiness()
  return (
    <AdminClientLayout me={{ id: session.user.id, name: session.name, email: session.email }} checkoutEnabled={readiness.blockers.length === 0}>
      {children}
    </AdminClientLayout>
  )
}
