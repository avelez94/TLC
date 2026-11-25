import Image from 'next/image'
import Link from 'next/link'
import type { Page } from './types'

interface NavItem { id: Page; label: string; icon: string }

export const navGroups: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: [{ id: 'dashboard', label: 'Dashboard', icon: '⊞' }] },
  {
    label: 'Current program',
    items: [
      { id: 'current', label: 'My Current Program', icon: '📅' },
      { id: 'reps', label: 'Weekly Reps', icon: '⚡' },
      { id: 'journal', label: 'Reflection Journal', icon: '📓' },
      { id: 'community', label: 'Community', icon: '💬' },
      { id: 'announcements', label: 'Announcements', icon: '📢' },
      { id: 'library', label: 'Resource Library', icon: '📚' },
      { id: 'progress', label: 'My Progress', icon: '📈' },
    ],
  },
  {
    label: 'History',
    items: [
      { id: 'completed', label: 'My Completed Programs', icon: '🗂' },
      { id: 'certificates', label: 'My Certificates', icon: '🏆' },
      { id: 'history', label: 'My Learning History', icon: '🕘' },
    ],
  },
  { label: null, items: [{ id: 'profile', label: 'Profile', icon: '👤' }] },
]

function NavList({ page, onNavigate, mobile }: { page: Page; onNavigate: (p: Page) => void; mobile?: boolean }) {
  return (
    <>
      {navGroups.map((group, gi) => (
        <div key={gi} style={{ marginTop: gi === 0 ? 0 : '0.5rem' }}>
          {group.label && (
            <p style={{ padding: mobile ? '0.75rem 1.5rem 0.25rem' : '0.6rem 1.25rem 0.25rem', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)' }}>{group.label}</p>
          )}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {group.items.map(({ id, label, icon }) => {
              const active = page === id
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(id)}
                    aria-current={active ? 'page' : undefined}
                    className="ip-nav-item"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: mobile ? '0.85rem' : '0.65rem',
                      padding: mobile ? '0.85rem 1.5rem' : '0.55rem 1.25rem', minHeight: '44px',
                      background: active ? 'rgba(200,136,32,0.12)' : 'transparent', border: 'none',
                      borderLeft: `3px solid ${active ? 'var(--gold)' : 'transparent'}`,
                      borderBottom: mobile ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      color: active ? 'var(--gold)' : 'rgba(255,255,255,0.7)', fontSize: mobile ? '1rem' : '0.78rem', fontWeight: 600,
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'var(--font-montserrat), sans-serif',
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: mobile ? undefined : '0.82rem', width: '1.1rem', textAlign: 'center' }}>{icon}</span>{label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}

export function Sidebar({ page, onNavigate, name, subtitle, initials, onSignOut }: {
  page: Page; onNavigate: (p: Page) => void; name: string; subtitle: string; initials: string; onSignOut: () => void
}) {
  return (
    <div style={{ width: '240px', background: 'var(--navy3)', borderRight: '1px solid rgba(200,136,32,0.15)', display: 'flex', flexDirection: 'column', flexShrink: 0, height: 'calc(100vh - 64px)', position: 'sticky', top: '64px', overflowY: 'auto' }}>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(200,136,32,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div aria-hidden="true" style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600 }}>{name}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', fontFamily: 'var(--font-jetbrains), monospace', letterSpacing: '0.08em' }}>{subtitle}</div>
          </div>
        </div>
      </div>
      <nav aria-label="Portal" style={{ flex: 1, padding: '0.75rem 0' }}>
        <NavList page={page} onNavigate={onNavigate} />
      </nav>
      <div style={{ padding: '0.5rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button type="button" onClick={onSignOut} className="ip-nav-item" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', cursor: 'pointer', width: '100%', minHeight: '44px', textAlign: 'center', fontFamily: 'var(--font-montserrat), sans-serif' }}>Sign out</button>
      </div>
    </div>
  )
}

export function TopBar({ initials, mobileOpen, onToggle }: { initials: string; mobileOpen: boolean; onToggle: () => void }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: 'var(--navy3)', borderBottom: '1px solid rgba(200,136,32,0.15)', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem' }}>
      <Link href="/" style={{ display: 'block' }}>
        <Image src="/images/impact-lab-logo.png" alt="The Impact Lab — home" width={120} height={34} style={{ width: '120px', height: 'auto' }} />
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div aria-hidden="true" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.8rem' }}>{initials}</div>
        <button
          type="button"
          className="mobile-hamburger ip-nav-item"
          onClick={onToggle}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="ip-mobile-nav"
          style={{ background: 'none', border: 'none', cursor: 'pointer', width: '44px', height: '44px', color: 'white', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
        >
          <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', transition: 'transform 0.2s', transform: mobileOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
          <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', opacity: mobileOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
          <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', transition: 'transform 0.2s', transform: mobileOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
        </button>
      </div>
    </div>
  )
}

export function MobileNav({ page, onNavigate, onSignOut }: { page: Page; onNavigate: (p: Page) => void; onSignOut: () => void }) {
  return (
    <div id="ip-mobile-nav" style={{ position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0, background: 'var(--navy3)', zIndex: 199, overflowY: 'auto', borderTop: '2px solid var(--gold)' }}>
      <nav aria-label="Portal" style={{ padding: '0.5rem 0 1rem' }}>
        <NavList page={page} onNavigate={onNavigate} mobile />
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '0.5rem' }}>
          <button type="button" onClick={onSignOut} className="ip-nav-item" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', cursor: 'pointer', display: 'block', width: '100%', minHeight: '44px', textAlign: 'center', fontFamily: 'var(--font-montserrat), sans-serif' }}>Sign out</button>
        </div>
      </nav>
    </div>
  )
}
