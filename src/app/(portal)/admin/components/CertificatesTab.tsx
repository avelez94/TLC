import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle, thStyle, tdStyle } from './shared'

type CertificatesTabProps = Pick<AdminPanel,
  'certificates' | 'users' | 'programs' | 'handleIssueCertificate' | 'actionLoading'
>

export default function CertificatesTab({ certificates, users, programs, handleIssueCertificate, actionLoading }: CertificatesTabProps) {
  return (
    <div>
      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Certificates</span>
      <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Certificates</h1>
      <div style={cardStyle}>
        <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Issue a Certificate</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Participant</label>
            <select id="cert-user" style={inputStyle}>
              <option value="">Select participant...</option>
              {users.filter(u => u.role === 'impact_participant').map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Program</label>
            <select id="cert-program" style={inputStyle}>
              <option value="">Select program...</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => {
          const userId = (document.getElementById('cert-user') as HTMLSelectElement)?.value
          const programId = (document.getElementById('cert-program') as HTMLSelectElement)?.value
          if (userId && programId) handleIssueCertificate(userId, programId)
        }} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
          {actionLoading ? 'Issuing...' : 'Issue Certificate'}
        </button>
      </div>
      {certificates.length > 0 && (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Participant', 'Program', 'Issued'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {certificates.map(c => (
                  <tr key={c.id}>
                    <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{(c.profiles as any)?.full_name || (c.profiles as any)?.email || 'Unknown'}</span></td>
                    <td style={tdStyle}>{(c.programs as any)?.name || 'Unknown'}</td>
                    <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)' }}>{new Date(c.issued_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {certificates.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem' }}><p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No certificates issued yet.</p></div>}
    </div>
  )
}
