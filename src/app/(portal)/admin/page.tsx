'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useAdminPanel } from './useAdminPanel'
import { navItems, type Page } from './components/shared'
import DashboardTab from './components/DashboardTab'
import RegistrationsTab from './components/RegistrationsTab'
import UsersTab from './components/UsersTab'
import ProgramsTab from './components/ProgramsTab'
import CohortsTab from './components/CohortsTab'
import WeeklyRepsTab from './components/WeeklyRepsTab'
import JournalPromptsTab from './components/JournalPromptsTab'
import CommunityTab from './components/CommunityTab'
import AnnouncementsTab from './components/AnnouncementsTab'
import ResourcesTab from './components/ResourcesTab'
import CertificatesTab from './components/CertificatesTab'
import ReportsTab from './components/ReportsTab'

export default function Admin() {
  const router = useRouter()
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const panel = useAdminPanel()

  const navigate = (id: Page) => { setPage(id); setMobileNavOpen(false) }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const Sidebar = () => (
    <div style={{ width: '240px', background: 'var(--navy3)', borderRight: '1px solid rgba(200,136,32,0.15)', display: 'flex', flexDirection: 'column', flexShrink: 0, height: 'calc(100vh - 64px)', position: 'sticky', top: '64px', overflowY: 'auto' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(200,136,32,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)' }} />
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Admin Panel</span>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '0.75rem 0' }}>
        {navItems.map(({ id, label, icon }) => (
          <button key={id} onClick={() => setPage(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 1.25rem', background: page === id ? 'rgba(200,136,32,0.12)' : 'transparent', border: 'none', borderLeft: `3px solid ${page === id ? 'var(--gold)' : 'transparent'}`, color: page === id ? 'var(--gold)' : 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'var(--font-montserrat), sans-serif' }}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href="/" style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', display: 'block', textAlign: 'center', marginBottom: '0.5rem' }}>View public site</Link>
        <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', cursor: 'pointer', width: '100%', textAlign: 'center', fontFamily: 'var(--font-montserrat), sans-serif' }}>Sign out</button>
      </div>
    </div>
  )

  if (panel.loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Loading...</div>
        <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Fetching your data</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'var(--font-montserrat), sans-serif', background: 'var(--paper)' }}>

      {/* TOP BAR */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: 'var(--navy3)', borderBottom: '1px solid rgba(200,136,32,0.15)', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.25rem', color: 'var(--gold)', letterSpacing: '0.08em' }}>TLC</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.8rem' }}>TC</div>
          <button className="mobile-hamburger" onClick={() => setMobileNavOpen(!mobileNavOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'white', flexDirection: 'column', gap: '5px' }}>
            <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', transition: 'transform 0.2s', transform: mobileNavOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
            <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', opacity: mobileNavOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
            <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', transition: 'transform 0.2s', transform: mobileNavOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <div style={{ position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0, background: 'var(--navy3)', zIndex: 199, overflowY: 'auto', borderTop: '2px solid var(--gold)' }}>
          <div style={{ padding: '1rem 0' }}>
            {navItems.map(({ id, label, icon }) => (
              <button key={id} onClick={() => navigate(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem 1.5rem', background: page === id ? 'rgba(200,136,32,0.12)' : 'transparent', border: 'none', borderLeft: `3px solid ${page === id ? 'var(--gold)' : 'transparent'}`, borderBottom: '1px solid rgba(255,255,255,0.05)', color: page === id ? 'var(--gold)' : 'rgba(255,255,255,0.65)', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                <span>{icon}</span>{label}
              </button>
            ))}
            <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '0.5rem' }}>
              <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center', fontFamily: 'var(--font-montserrat), sans-serif' }}>Sign out</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', paddingTop: '64px', minHeight: '100vh' }}>
        <div className="desktop-sidebar"><Sidebar /></div>

        <div style={{ flex: 1, padding: 'clamp(1.25rem, 3vw, 2rem)', minWidth: 0 }}>

          {/* GLOBAL SUCCESS */}
          {panel.successMsg && (
            <div style={{ background: 'rgba(200,136,32,0.1)', border: '1px solid rgba(200,136,32,0.3)', borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1.25rem', color: 'var(--gold)', fontSize: '0.85rem' }}>
              {panel.successMsg}
            </div>
          )}

          {page === 'dashboard' && <DashboardTab {...panel} setPage={setPage} />}
          {page === 'registrations' && <RegistrationsTab {...panel} />}
          {page === 'users' && <UsersTab {...panel} />}
          {page === 'programs' && <ProgramsTab {...panel} setPage={setPage} />}
          {page === 'cohorts' && <CohortsTab {...panel} />}
          {page === 'reps' && <WeeklyRepsTab {...panel} />}
          {page === 'prompts' && <JournalPromptsTab {...panel} />}
          {page === 'community' && <CommunityTab {...panel} />}
          {page === 'announcements' && <AnnouncementsTab {...panel} />}
          {page === 'resources' && <ResourcesTab {...panel} />}
          {page === 'certificates' && <CertificatesTab {...panel} />}
          {page === 'reports' && <ReportsTab {...panel} />}

        </div>
      </div>

      <style>{`
        .desktop-sidebar { display: flex; }
        .mobile-hamburger { display: none; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-hamburger { display: flex !important; }
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
          .two-col-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .stat-grid { grid-template-columns: 1fr !important; }
        }
        input:focus, textarea:focus, select:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,136,32,0.1); }
        tr:hover td { background: rgba(0,23,55,0.02); }
      `}</style>
    </div>
  )
}
