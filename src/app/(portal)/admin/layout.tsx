import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUserWithRole } from '@/lib/supabase-server'
import { homeForRole } from '@/lib/access'
import AdminClientLayout from './AdminClientLayout'

// Server-side gate for every /admin page. Middleware also redirects, but that check is
// only a first line; this runs on the server before any admin UI or data is sent.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUserWithRole()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect(homeForRole(session.role))
  if (!session.mfaSatisfied) redirect('/login?mfa=1')
  return <AdminClientLayout>{children}</AdminClientLayout>
}
