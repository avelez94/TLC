// Row shapes the participant portal reads. Every query is limited by RLS to what this
// participant may see; these types only describe the columns the portal selects.

export type Page =
  | 'dashboard' | 'current' | 'reps' | 'journal' | 'community' | 'announcements' | 'library' | 'progress'
  | 'completed' | 'certificates' | 'history' | 'profile'

export type CommunityTab = 'posts' | 'members' | 'chat'

export interface ProfileRow { id: string; full_name: string | null; role: string | null; email: string | null }

export interface ProgramRow { id: string; name: string; description?: string | null }

export interface CohortRow {
  id: string
  program_id: string
  name: string
  start_date: string | null
  end_date: string | null
  status: string
  session_day?: string | null
  session_time?: string | null
  description?: string | null
  book_title?: string | null
  book_purchase_url?: string | null
  activity_open_until?: string | null
  programs: ProgramRow | null
}

export interface EnrollmentRow {
  id: string
  cohort_id: string
  status: string
  enrolled_at: string | null
  completed_at?: string | null
  cohorts: CohortRow | null
}

/** One cohort the participant is (or was) in, with what the database lets them do there. */
export interface Membership {
  enrollmentId: string
  enrollmentStatus: string
  completedAt: string | null
  cohort: CohortRow
  program: ProgramRow | null
  /** Active enrollment in a cohort that has not finished: shown under My Current Program. */
  isCurrent: boolean
  /** Mirrors app_private.can_participate: submit reps, post, comment, like, chat. */
  canWrite: boolean
  /** Set when an admin reopened activity on a finished cohort (ET date, today or later). */
  reopenedUntil: string | null
  zoomLink: string | null
}

export interface Rep {
  id: string
  cohort_id: string
  week_number: number | null
  title: string
  instructions: string | null
  why_it_matters: string | null
  due_date: string | null
  archived_at: string | null
}

export interface Submission { id: string; rep_id: string; reflection: string | null; completed_at: string | null }

export interface SessionRow {
  id: string
  cohort_id: string
  session_number: number
  title: string | null
  session_date: string | null
  description: string | null
}

export interface AttendanceRow { cohort_id: string; session_number: number; attended: boolean }

export interface AnnouncementRow {
  id: string
  cohort_id: string | null
  title: string
  body: string | null
  created_at: string
  target_user_id?: string | null
  target_role?: string | null
}

export interface ResourceRow {
  id: string
  title: string
  description: string | null
  type: string | null
  topic: string | null
  url: string | null
  program_id: string | null
  cohort_id: string | null
  portal_type: string | null
}

export interface CertificateRow {
  id: string
  program_id: string | null
  cohort_id: string | null
  issued_at: string | null
  certificate_number: string | null
  participant_name: string | null
  pathway_name: string | null
  cohort_name: string | null
  completion_date: string | null
  revoked_at: string | null
  programs?: { name: string } | null
}

export interface JournalEntryRow {
  id: string
  title: string | null
  body: string | null
  program_id: string | null
  prompt_used: string | null
  created_at: string
}

export interface JournalPromptRow { id: string; prompt: string; program_id: string | null; week_number: number | null; sort_order: number | null }

export interface CommentRow {
  id: string
  user_id: string
  body: string
  created_at: string
  profiles?: { full_name: string | null; role?: string | null } | null
}

export interface PostRow {
  id: string
  user_id: string
  cohort_id: string
  body: string
  created_at: string
  profiles?: { full_name: string | null } | null
  community_likes?: { user_id: string }[] | null
  community_comments?: CommentRow[] | null
}

export interface MemberRow { user_id: string; status: string; profiles?: { full_name: string | null } | null }

export interface MessageRow {
  id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { full_name: string | null } | null
}

/** Community actions for one cohort. Each resolves to true when the database accepted it. */
export interface PostActions {
  create: (body: string) => Promise<boolean>
  edit: (postId: string, body: string) => Promise<boolean>
  remove: (postId: string) => Promise<boolean>
  like: (postId: string, liked: boolean) => Promise<boolean>
  comment: (postId: string, body: string) => Promise<boolean>
}
