import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUserWithRole } from '@/lib/supabase-server'
import { homeForRole } from '@/lib/access'
import { checkoutEnabled } from '@/lib/pathways'
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
  return (
    <AdminClientLayout me={{ id: session.user.id, name: session.name, email: session.email }} checkoutEnabled={checkoutEnabled()}>
      {children}
    </AdminClientLayout>
  )
}
