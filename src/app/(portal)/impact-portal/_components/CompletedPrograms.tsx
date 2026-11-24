import { formatDateET } from '@/lib/business-time'
import { programName, programStateLabel } from './logic'
import { AnnouncementsList, CertificateCard, ResourcesList } from './ContentLists'
import { CommunityPosts } from './CommunityPosts'
import { ProgramOverview } from './ProgramOverview'
import { RepsSection } from './RepsSection'
import { cardStyle, EmptyState, eyebrowStyle, FinishedNote, h1Style, h2Style, linkButtonStyle, mutedText, PageHeader, StatusBadge } from './ui'
import type { AnnouncementRow, AttendanceRow, CertificateRow, Membership, PostActions, PostRow, Rep, ResourceRow, SessionRow, Submission } from './types'

export function CompletedProgramsList({ past, certificateFor, today, onOpen }: {
  past: Membership[]
  certificateFor: (m: Membership) => CertificateRow | null
  today: string
  onOpen: (cohortId: string) => void
}) {
  return (
    <div>
      <PageHeader eyebrow="History" title="My Completed Programs" intro="Programs you were part of that have finished. Open one to see its schedule, your weekly reps, materials and community — your work is kept here." />
      {past.length === 0 && (
        <EmptyState>No completed programs yet. When a program you&rsquo;re in finishes, it moves here with your reps, materials and certificate.</EmptyState>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {past.map(m => {
          const c = m.cohort
          const cert = certificateFor(m)
          return (
            <li key={c.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <h2 style={{ ...h2Style, marginBottom: '0.25rem' }}>{programName(m)}</h2>
                <p style={{ ...mutedText, marginBottom: '0.5rem' }}>
                  {c.name}
                  {c.start_date ? ` · ${formatDateET(c.start_date)}` : ''}{c.end_date ? ` – ${formatDateET(c.end_date)}` : ''}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <StatusBadge kind={m.enrollmentStatus === 'completed' ? 'submitted' : 'info'}>{programStateLabel(m, today)}</StatusBadge>
                  {cert && <StatusBadge kind="submitted">Certificate issued</StatusBadge>}
                  {m.canWrite && m.reopenedUntil && <StatusBadge kind="info">Reopened until {formatDateET(m.reopenedUntil)}</StatusBadge>}
                </div>
              </div>
              <button type="button" onClick={() => onOpen(c.id)} className="btn btn-ghost-dark" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }} aria-label={`Open ${programName(m)}, ${c.name}`}>Open</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function CompletedProgramDetail({ membership, sessions, attendance, reps, submissions, resources, announcements, certificate, posts, postsError, postActions, profileId, busy, today, onSubmitRep, onBack, onRetryPosts }: {
  membership: Membership
  sessions: SessionRow[]
  attendance: AttendanceRow[]
  reps: Rep[]
  submissions: Map<string, Submission>
  resources: ResourceRow[]
  announcements: AnnouncementRow[]
  certificate: CertificateRow | null
  posts: PostRow[] | undefined
  postsError: string | null
  postActions: PostActions
  profileId: string | null
  busy: boolean
  today: string
  onSubmitRep: (repId: string, reflection: string) => Promise<boolean>
  onBack: () => void
  onRetryPosts: () => void
}) {
  const submittedCount = reps.filter(r => submissions.has(r.id)).length
  return (
    <div>
      <button type="button" onClick={onBack} style={{ ...linkButtonStyle, marginBottom: '0.75rem' }}><span aria-hidden="true">&#8592; </span>Back to completed programs</button>
      <span style={eyebrowStyle}>Completed program</span>
      <h1 style={h1Style}>{programName(membership)} — {membership.cohort.name}</h1>
      <FinishedNote membership={membership} />

      {certificate && (
        <section aria-labelledby="past-cert">
          <h2 id="past-cert" style={h2Style}>Your certificate</h2>
          <CertificateCard cert={certificate} headingLevel="h3" />
        </section>
      )}

      <ProgramOverview membership={membership} sessions={sessions} attendance={attendance} today={today} />

      <section aria-labelledby="past-reps" style={{ marginBottom: '1.25rem' }}>
        <h2 id="past-reps" style={h2Style}>Weekly reps</h2>
        {reps.length > 0 && <p style={{ ...mutedText, marginBottom: '0.75rem' }}>You submitted {submittedCount} of {reps.length}. Open a rep to read your reflection.</p>}
        <RepsSection
          membership={membership}
          reps={reps}
          submissions={submissions}
          today={today}
          onSubmit={onSubmitRep}
          busy={busy}
          headingLevel="h3"
          emptyText="No weekly reps were assigned in this program."
        />
      </section>

      <section aria-labelledby="past-materials" style={{ marginBottom: '1.25rem' }}>
        <h2 id="past-materials" style={h2Style}>Materials</h2>
        {resources.length === 0 ? <EmptyState compact>No materials were shared for this program.</EmptyState> : <ResourcesList resources={resources} headingLevel="h3" />}
      </section>

      <section aria-labelledby="past-announcements" style={{ marginBottom: '1.25rem' }}>
        <h2 id="past-announcements" style={h2Style}>Announcements</h2>
        {announcements.length === 0 ? <EmptyState compact>There were no announcements for this cohort.</EmptyState> : <AnnouncementsList items={announcements} profileId={profileId} headingLevel="h3" />}
      </section>

      <section aria-labelledby="past-community">
        <h2 id="past-community" style={h2Style}>Community posts</h2>
        {!membership.canWrite && <p style={{ ...mutedText, marginBottom: '0.75rem' }}>Read-only: posting, comments and likes are closed for this program.</p>}
        {postsError ? (
          <EmptyState compact>
            {postsError} <button type="button" onClick={onRetryPosts} style={{ ...linkButtonStyle, padding: '0 0.25rem' }}>Try again</button>
          </EmptyState>
        ) : posts === undefined ? (
          <p style={mutedText} role="status">Loading posts…</p>
        ) : (
          <CommunityPosts posts={posts} profileId={profileId} canWrite={membership.canWrite} actions={postActions} busy={busy} emptyText="No one posted in this program's community." />
        )}
      </section>
    </div>
  )
}
