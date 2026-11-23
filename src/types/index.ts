export type Role = 'admin' | 'coaching_client' | 'impact_participant'
export type CohortStatus = 'draft' | 'upcoming' | 'active' | 'completed' | 'archived' | 'cancelled'
export type EnrollmentStatus = 'active' | 'completed' | 'withdrawn'
export type SessionStatus = 'upcoming' | 'completed' | 'cancelled'

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  organization: string | null
  role: Role
  avatar_url: string | null
  timezone: string | null
  hourly_rate: number | null
  created_at: string
  last_sign_in_at?: string | null
}

export interface Program {
  id: string
  name: string
  description: string | null
  type: string
  created_at: string
  slug?: string | null
  pathway_number?: number | null
  tagline?: string | null
  opening_statement?: string | null
  audience?: string | null
  leadership_goal?: string | null
  keywords?: string | null
  is_public?: boolean
  enrollment_open?: boolean
  price?: number | null
  price_label?: string | null
  session_day?: string | null
  session_time?: string | null
  duration_weeks?: number | null
  sort_order?: number | null
}

export interface Cohort {
  id: string
  program_id: string
  name: string
  start_date: string | null
  end_date: string | null
  zoom_link: string | null
  capacity?: number | null
  status: CohortStatus
  created_at: string
  programs?: { name: string }
  cohort_enrollments?: { count: number }[]
  session_day?: string | null
  session_time?: string | null
  description?: string | null
  includes?: string | null
  expectations?: string | null
  book_title?: string | null
  book_image_url?: string | null
  book_purchase_url?: string | null
}

export interface CohortEnrollment {
  id: string
  cohort_id: string
  user_id: string
  enrolled_at: string
  status: EnrollmentStatus
  profiles?: Profile
  cohorts?: Cohort
}

export interface WeeklyRep {
  id: string
  cohort_id: string
  week_number: number
  title: string
  instructions: string | null
  why_it_matters: string | null
  due_date: string | null
  created_at: string
  archived_at?: string | null
  cohorts?: { name: string }
  weekly_rep_submissions?: { count: number }[]
}

export interface JournalPrompt {
  id: string
  prompt: string
  program_id: string | null
  week_number: number | null
  sort_order: number
  programs?: { name: string }
}

export interface Announcement {
  id: string
  cohort_id: string | null
  title: string
  body: string | null
  created_by: string | null
  created_at: string
  cohorts?: { name: string } | null
}

export interface Resource {
  id: string
  title: string
  description: string | null
  type: string | null
  url: string | null
  program_id: string | null
  cohort_id: string | null
  topic: string | null
  life_domain: string | null
  portal_type: string | null
  created_at: string
  programs?: { name: string } | null
}

export interface Certificate {
  id: string
  user_id: string
  program_id: string
  cohort_id: string | null
  issued_at: string
  profiles?: Profile
  programs?: { name: string }
}
