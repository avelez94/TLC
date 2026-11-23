'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { AdminPanel } from '../useAdminPanel'
import { enrollmentOutcome } from '@/lib/admin-metrics'
import { cardStyle, helpStyle, inputStyle, labelStyle, pageTitleStyle, roleBadge } from './shared'
import InviteForm from './people/InviteForm'
import PersonDetail from './people/PersonDetail'
import { FilterBar, personLabel } from './people/common'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function UsersTab(panel: AdminPanel) {
  const { users, enrollments, cohorts } = panel
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [invite, setInvite] = useState<{ open: boolean; cohortId?: string; key: number }>({ open: false, key: 0 })

  // A link such as /admin/users?invite=1&cohort=<id> opens the invite form for that cohort.
  useEffect(() => {
    void Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('invite') !== '1') return
      const cohort = params.get('cohort')
      setInvite(i => ({ open: true, cohortId: cohort && UUID_RE.test(cohort) ? cohort : undefined, key: i.key + 1 }))
    })
  }, [])

  const counts = useMemo(() => ({
    all: users.length,
    impact_participant: users.filter(u => u.role === 'impact_participant').length,
    coaching_client: users.filter(u => u.role === 'coaching_client').length,
    admin: users.filter(u => u.role === 'admin').length,
  }), [users])

  const q = search.trim().toLowerCase()
  const visible = users
    .filter(u => filter === 'all' || u.role === filter)
    .filter(u => !q || (u.full_name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q))
    .sort((a, b) => personLabel(a).localeCompare(personLabel(b)))

  /** Short summary for the collapsed row, e.g. "Spring 2026 cohort · in progress". */
  const summary = (userId: string) => {
    const mine = enrollments.filter(e => e.user_id === userId)
    const current = mine.filter(e => {
      const o = enrollmentOutcome(e.status, cohorts.find(c => c.id === e.cohort_id)?.status ?? null)
      return o === 'in_progress' || o === 'starting'
    })
    if (current.length) return current.map(e => cohorts.find(c => c.id === e.cohort_id)?.name ?? 'Cohort').join(', ')
    if (mine.length) return `${mine.length} past cohort${mine.length === 1 ? '' : 's'}`
    return null
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
        <div>
          <span style={labelStyle}>People</span>
          <h1 style={pageTitleStyle}>Participants</h1>
        </div>
        {!invite.open && (
          <button type="button" onClick={() => setInvite(i => ({ open: true, key: i.key + 1 }))} className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.7rem 1.25rem' }}>
            + Invite someone
          </button>
        )}
      </div>
      <p style={helpStyle}>
        Everyone with an account: Impact Lab participants, coaching clients and administrators. Select a person to manage their cohorts, certificates, role and sign-in.{' '}
        <Link href="/admin/certificates" style={{ color: '#8a5a10', fontWeight: 600 }}>All certificates →</Link>
      </p>

      {invite.open && <InviteForm key={invite.key} panel={panel} initialCohortId={invite.cohortId} onClose={() => setInvite(i => ({ open: false, key: i.key }))} />}

      <FilterBar label="Show" value={filter} onChange={setFilter} options={[
        { value: 'all', label: `All (${counts.all})` },
        { value: 'impact_participant', label: `Impact Lab (${counts.impact_participant})` },
        { value: 'coaching_client', label: `Coaching (${counts.coaching_client})` },
        { value: 'admin', label: `Admins (${counts.admin})` },
      ]} />
      <div style={{ marginBottom: '1.25rem', maxWidth: '420px' }}>
        <label htmlFor="people-search" style={labelStyle}>Search by name or email</label>
        <input id="people-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or email" style={inputStyle} />
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {visible.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate)', fontSize: '0.92rem', margin: 0 }}>
            {users.length === 0 ? 'No one yet. Invite someone to get started.' : 'No one matches this search or filter.'}
          </p>
        ) : visible.map(user => {
          const open = expanded === user.id
          const line = summary(user.id)
          return (
            <div key={user.id}>
              <button type="button" aria-expanded={open} aria-controls={`person-${user.id}`} onClick={() => setExpanded(open ? null : user.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '1rem 1.25rem', background: open ? 'var(--paper)' : 'white', border: 'none', borderBottom: '1px solid var(--mist)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: '1 1 220px' }}>
                  <span aria-hidden="true" style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                    {personLabel(user).charAt(0).toUpperCase()}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>
                      {user.full_name || 'No name'}{user.id === panel.me.id && <span style={{ fontWeight: 400, color: 'var(--slate)' }}> (you)</span>}
                    </span>
                    <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.85rem', overflowWrap: 'anywhere' }}>{user.email}</span>
                    {line && <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.82rem', marginTop: '0.15rem' }}>{line}</span>}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {roleBadge(user.role)}
                  <span aria-hidden="true" style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
                </span>
              </button>
              {open && <div id={`person-${user.id}`}><PersonDetail panel={panel} user={user} /></div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
