import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, labelStyle, statusBadge } from './shared'

type RegistrationsTabProps = Pick<AdminPanel,
  'registrations' | 'expandedRegistration' | 'setExpandedRegistration' | 'registrationFilter' | 'setRegistrationFilter' |
  'actionLoading' | 'handleConfirmAndInvite' | 'handleUpdateRegistrationStatus'
>

export default function RegistrationsTab({ registrations, expandedRegistration, setExpandedRegistration, registrationFilter, setRegistrationFilter, actionLoading, handleConfirmAndInvite, handleUpdateRegistrationStatus }: RegistrationsTabProps) {
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Registrations</span>
        <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Registrations</h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginTop: '0.35rem' }}>Click a registration to confirm them and send their portal invite.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { value: 'all', label: `All (${registrations.length})` },
          { value: 'pending', label: `Pending (${registrations.filter(r => r.status === 'pending').length})` },
          { value: 'confirmed', label: `Confirmed (${registrations.filter(r => r.status === 'confirmed').length})` },
          { value: 'paid', label: `Paid, Unconfirmed (${registrations.filter(r => r.payment_status === 'paid' && r.status === 'pending').length})` },
        ].map(({ value, label }) => (
          <button key={value} onClick={() => setRegistrationFilter(value)} style={{ padding: '0.45rem 1rem', borderRadius: '2px', border: `1.5px solid ${registrationFilter === value ? 'var(--gold)' : 'rgba(0,23,55,0.15)'}`, background: registrationFilter === value ? 'rgba(200,136,32,0.08)' : 'white', color: registrationFilter === value ? 'var(--gold)' : 'var(--slate)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>
            {label}
          </button>
        ))}
      </div>

      {registrations.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No registrations yet.</p>
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          {registrations
            .filter(r => {
              if (registrationFilter === 'all') return true
              if (registrationFilter === 'paid') return r.payment_status === 'paid' && r.status === 'pending'
              return r.status === registrationFilter
            })
            .map(reg => (
            <div key={reg.id}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap', gap: '0.75rem', cursor: 'pointer' }}
                onClick={() => setExpandedRegistration(expandedRegistration === reg.id ? null : reg.id)}
              >
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.88rem' }}>{reg.full_name}</p>
                  <p style={{ color: 'var(--slate)', fontSize: '0.78rem' }}>{(reg.programs as any)?.name} — {(reg.cohorts as any)?.name}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '2px', background: reg.payment_status === 'paid' ? 'rgba(200,136,32,0.1)' : 'rgba(0,23,55,0.06)', color: reg.payment_status === 'paid' ? 'var(--gold)' : 'var(--slate)' }}>
                    {reg.payment_status === 'paid' ? 'Paid' : (reg.programs as any)?.price_label === 'Request a Quote' ? 'Quote Request' : 'Unpaid'}
                  </span>
                  {statusBadge(reg.status)}
                  <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{expandedRegistration === reg.id ? '▲' : '▼'}</span>
                </div>
              </div>
              {expandedRegistration === reg.id && (
                <div style={{ padding: '1.25rem 1.5rem', background: 'var(--paper)', borderBottom: '1px solid var(--mist)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                    <div>
                      <span style={labelStyle}>Email</span>
                      <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}><a href={`mailto:${reg.email}`} style={{ color: 'var(--gold)' }}>{reg.email}</a></p>
                    </div>
                    {reg.phone && (
                      <div>
                        <span style={labelStyle}>Phone</span>
                        <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}><a href={`tel:${reg.phone}`} style={{ color: 'var(--gold)' }}>{reg.phone}</a></p>
                      </div>
                    )}
                    {reg.organization && (
                      <div>
                        <span style={labelStyle}>Organization</span>
                        <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}>{reg.organization}</p>
                      </div>
                    )}
                    <div>
                      <span style={labelStyle}>Submitted</span>
                      <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}>{new Date(reg.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    {reg.amount_paid && (
                      <div>
                        <span style={labelStyle}>Amount Paid</span>
                        <p style={{ color: 'var(--ink)', fontSize: '0.85rem', fontWeight: 600 }}>${reg.amount_paid}</p>
                      </div>
                    )}
                    {reg.why && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={labelStyle}>Why they want to join</span>
                        <p style={{ color: 'var(--ink)', fontSize: '0.85rem', lineHeight: 1.6 }}>{reg.why}</p>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {reg.status === 'pending' && (
                      <button onClick={() => handleConfirmAndInvite(reg)} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.55rem 1.1rem' }}>
                        {actionLoading ? 'Processing...' : 'Confirm and Send Invite'}
                      </button>
                    )}
                    {reg.status !== 'waitlist' && (
                      <button onClick={() => handleUpdateRegistrationStatus(reg.id, 'waitlist')} style={{ background: 'none', border: '1px solid rgba(0,23,55,0.15)', color: 'var(--navy)', borderRadius: '2px', padding: '0.55rem 1.1rem', fontSize: '0.8rem', cursor: 'pointer' }}>Waitlist</button>
                    )}
                    {reg.status !== 'declined' && (
                      <button onClick={() => handleUpdateRegistrationStatus(reg.id, 'declined')} style={{ background: 'none', border: '1px solid rgba(255,59,48,0.3)', color: '#ff6b6b', borderRadius: '2px', padding: '0.55rem 1.1rem', fontSize: '0.8rem', cursor: 'pointer' }}>Decline</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
