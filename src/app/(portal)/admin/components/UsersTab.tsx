import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle, roleBadge, statusBadge } from './shared'

type UsersTabProps = Pick<AdminPanel,
  'users' | 'programs' | 'cohorts' | 'enrollments' |
  'userFilter' | 'setUserFilter' |
  'showInviteForm' | 'setShowInviteForm' |
  'inviteSuccess' | 'inviteError' | 'invite' | 'setInvite' | 'inviteLoading' | 'handleInvite' |
  'expandedUser' | 'setExpandedUser' |
  'billingRate' | 'setBillingRate' | 'billingHours' | 'setBillingHours' | 'billingSessions' | 'setBillingSessions' |
  'billingMinutesPerSession' | 'setBillingMinutesPerSession' | 'billingClientType' | 'setBillingClientType' |
  'paymentLinkUrl' | 'setPaymentLinkUrl' | 'paymentRequestLoading' | 'handleSendPaymentRequest' |
  'resetEmailLoading' | 'handleSendResetEmail' |
  'handleUpdateHourlyRate' | 'handleUpdateUserRole' | 'showSuccess'
>

export default function UsersTab({
  users, programs, cohorts, enrollments,
  userFilter, setUserFilter,
  showInviteForm, setShowInviteForm,
  inviteSuccess, inviteError, invite, setInvite, inviteLoading, handleInvite,
  expandedUser, setExpandedUser,
  billingRate, setBillingRate, billingHours, setBillingHours, billingSessions, setBillingSessions,
  billingMinutesPerSession, setBillingMinutesPerSession, billingClientType, setBillingClientType,
  paymentLinkUrl, setPaymentLinkUrl, paymentRequestLoading, handleSendPaymentRequest,
  resetEmailLoading, handleSendResetEmail,
  handleUpdateHourlyRate, handleUpdateUserRole, showSuccess,
}: UsersTabProps) {
  const impactUsers = users.filter(u => u.role === 'impact_participant')
  const coachingUsers = users.filter(u => u.role === 'coaching_client')
  const filteredUsers = userFilter === 'all' ? users : users.filter(u => u.role === userFilter)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Users</span>
          <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>All Users</h1>
        </div>
        <button onClick={() => setShowInviteForm(!showInviteForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
          {showInviteForm ? 'Cancel' : '+ Invite User'}
        </button>
      </div>

      {inviteSuccess && (
        <div style={{ background: 'rgba(200,136,32,0.1)', border: '1px solid rgba(200,136,32,0.3)', borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1.25rem', color: 'var(--gold)', fontSize: '0.85rem', lineHeight: 1.5 }}>
          {inviteSuccess}
        </div>
      )}

      {showInviteForm && (
        <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Invite a New User</h3>
          <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>They will receive an email to set their own password and will be automatically enrolled.</p>
          {inviteError && <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '4px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>{inviteError}</div>}
          <form onSubmit={handleInvite} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input value={invite.full_name} onChange={e => setInvite({ ...invite, full_name: e.target.value })} placeholder="Jane Smith" style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input type="email" value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} placeholder="jane@email.com" style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value, program_id: '', cohort_id: '' })} style={inputStyle}>
                <option value="impact_participant">Impact Lab Participant</option>
                <option value="coaching_client">Coaching Client</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {invite.role === 'impact_participant' && (
              <div>
                <label style={labelStyle}>Program</label>
                <select value={invite.program_id} onChange={e => setInvite({ ...invite, program_id: e.target.value, cohort_id: '' })} style={inputStyle} required>
                  <option value="">Select a program...</option>
                  {programs.filter(p => p.type === 'cohort').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {invite.role === 'coaching_client' && (
              <div>
                <label style={labelStyle}>Program</label>
                <select value={invite.program_id} onChange={e => setInvite({ ...invite, program_id: e.target.value })} style={inputStyle} required>
                  <option value="">Select a program...</option>
                  {programs.filter(p => p.type !== 'cohort').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {invite.role === 'impact_participant' && invite.program_id && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Cohort</label>
                <select value={invite.cohort_id} onChange={e => setInvite({ ...invite, cohort_id: e.target.value })} style={inputStyle} required>
                  <option value="">Select a cohort...</option>
                  {cohorts.filter(c => c.program_id === invite.program_id && (c.status === 'active' || c.status === 'upcoming')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={inviteLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', width: '100%' }}>
                {inviteLoading ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { value: 'all', label: `All (${users.length})` },
          { value: 'impact_participant', label: `Impact Lab (${impactUsers.length})` },
          { value: 'coaching_client', label: `Coaching (${coachingUsers.length})` },
          { value: 'admin', label: `Admins (${users.filter(u => u.role === 'admin').length})` },
        ].map(({ value, label }) => (
          <button key={value} onClick={() => setUserFilter(value)} style={{ padding: '0.45rem 1rem', borderRadius: '2px', border: `1.5px solid ${userFilter === value ? 'var(--gold)' : 'rgba(0,23,55,0.15)'}`, background: userFilter === value ? 'rgba(200,136,32,0.08)' : 'white', color: userFilter === value ? 'var(--gold)' : 'var(--slate)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {filteredUsers.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate)', fontSize: '0.88rem' }}>No users yet. Invite someone to get started.</div>
        ) : (
          <div>
            {filteredUsers.map(user => (
              <div key={user.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap', gap: '0.75rem', cursor: 'pointer' }} onClick={() => {
                  const next = expandedUser === user.id ? null : user.id
                  setExpandedUser(next)
                  setBillingRate(next && user.hourly_rate != null ? String(user.hourly_rate) : '')
                  setBillingHours('')
                  setBillingSessions('')
                  setBillingMinutesPerSession('')
                  setBillingClientType('existing')
                  setPaymentLinkUrl('')
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                      {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.88rem' }}>{user.full_name || 'No name'}</p>
                      <p style={{ color: 'var(--slate)', fontSize: '0.78rem' }}>{user.email}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {roleBadge(user.role)}
                    <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{expandedUser === user.id ? '▲' : '▼'}</span>
                  </div>
                </div>
                {expandedUser === user.id && (
                  <div style={{ padding: '1.25rem 1.5rem', background: 'var(--paper)', borderBottom: '1px solid var(--mist)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                      <div>
                        <span style={labelStyle}>Joined</span>
                        <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}>{new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      <div>
                        <span style={labelStyle}>Timezone</span>
                        <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}>{user.timezone || 'Not set'}</p>
                      </div>
                      <div>
                        <span style={labelStyle}>Last Login</span>
                        <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}>
                          {user.last_sign_in_at
                            ? `Last login: ${new Date(user.last_sign_in_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                            : 'Never logged in'}
                        </p>
                      </div>
                      {user.role === 'impact_participant' && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={labelStyle}>Enrollments</span>
                          {enrollments.filter(e => e.user_id === user.id).length === 0 ? (
                            <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>Not enrolled in any cohort yet.</p>
                          ) : enrollments.filter(e => e.user_id === user.id).map(e => (
                            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--mist)' }}>
                              <span style={{ color: 'var(--ink)', fontSize: '0.85rem' }}>{(e.cohorts as any)?.name || 'Unknown cohort'}</span>
                              {statusBadge(e.status)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {user.role === 'coaching_client' && (() => {
                      const isNew = billingClientType === 'new'
                      const rate = parseFloat(billingRate) || 0
                      const totalHours = isNew
                        ? ((parseFloat(billingSessions) || 0) * (parseFloat(billingMinutesPerSession) || 0)) / 60
                        : (parseFloat(billingHours) || 0)
                      const total = rate * totalHours
                      const canSend = isNew
                        ? !!billingRate && !!billingSessions && !!billingMinutesPerSession
                        : !!billingRate && !!billingHours
                      return (
                      <div style={{ ...cardStyle, background: 'var(--paper)' }}>
                        <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Coaching Billing</h3>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={labelStyle}>Invoice Type</label>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {[
                              { value: 'new' as const, label: 'New Client — First Invoice' },
                              { value: 'existing' as const, label: 'Existing Client — Follow-up Invoice' },
                            ].map(({ value, label }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setBillingClientType(value)}
                                style={{ padding: '0.45rem 1rem', borderRadius: '2px', border: `1.5px solid ${billingClientType === value ? 'var(--gold)' : 'rgba(0,23,55,0.15)'}`, background: billingClientType === value ? 'rgba(200,136,32,0.08)' : 'white', color: billingClientType === value ? 'var(--gold)' : 'var(--slate)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isNew ? '1fr 1fr 1fr' : '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div>
                            <label style={labelStyle}>Hourly Rate ($)</label>
                            <input
                              type="number"
                              value={billingRate}
                              onChange={e => setBillingRate(e.target.value)}
                              onBlur={e => handleUpdateHourlyRate(user.id, e.target.value)}
                              placeholder="e.g. 150"
                              style={inputStyle}
                              min="0"
                              step="0.01"
                            />
                          </div>
                          {isNew ? (
                            <>
                              <div>
                                <label style={labelStyle}>Number of Sessions</label>
                                <input
                                  type="number"
                                  value={billingSessions}
                                  onChange={e => setBillingSessions(e.target.value)}
                                  placeholder="e.g. 3"
                                  style={inputStyle}
                                  min="1"
                                  step="1"
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Minutes per Session</label>
                                <input
                                  type="number"
                                  value={billingMinutesPerSession}
                                  onChange={e => setBillingMinutesPerSession(e.target.value)}
                                  placeholder="e.g. 60"
                                  style={inputStyle}
                                  min="1"
                                  step="1"
                                />
                              </div>
                            </>
                          ) : (
                            <div>
                              <label style={labelStyle}>Hours to Bill</label>
                              <input
                                type="number"
                                value={billingHours}
                                onChange={e => setBillingHours(e.target.value)}
                                placeholder="e.g. 2"
                                style={inputStyle}
                                min="0"
                                step="0.25"
                              />
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                          <div>
                            <span style={labelStyle}>Total</span>
                            <p style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>
                              ${total.toFixed(2)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleSendPaymentRequest(user)}
                            disabled={paymentRequestLoading || !canSend}
                            className="btn btn-primary"
                            style={{ fontSize: '0.8rem', padding: '0.6rem 1.1rem' }}
                          >
                            {paymentRequestLoading ? 'Sending...' : 'Send Payment Request'}
                          </button>
                        </div>
                        {paymentLinkUrl && (
                          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--mist)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span style={labelStyle}>Payment Link</span>
                            <a href={paymentLinkUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', fontSize: '0.8rem', wordBreak: 'break-all' }}>{paymentLinkUrl}</a>
                            <button
                              onClick={() => { navigator.clipboard.writeText(paymentLinkUrl); showSuccess('Link copied to clipboard.') }}
                              style={{ background: 'none', border: '1.5px solid rgba(0,23,55,0.15)', borderRadius: '2px', padding: '0.3rem 0.7rem', color: 'var(--slate)', fontSize: '0.72rem', cursor: 'pointer' }}
                            >
                              Copy
                            </button>
                          </div>
                        )}
                      </div>
                      )
                    })()}

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)' }}>Change role:</span>
                        <select value={user.role} onChange={e => handleUpdateUserRole(user.id, e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
                          <option value="impact_participant">Impact Lab</option>
                          <option value="coaching_client">Coaching</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <button
                        onClick={() => handleSendResetEmail(user.email || '')}
                        disabled={resetEmailLoading || !user.email}
                        className="btn btn-primary"
                        style={{ fontSize: '0.78rem', padding: '0.45rem 0.9rem' }}
                      >
                        {resetEmailLoading ? 'Sending...' : 'Send Reset Email'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
