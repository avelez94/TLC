// Training materials for administrators (Admin → Training). The files live in the private
// storage bucket `admin-training` (no storage policies: only the server can read it) and are
// served through /api/admin/training/<key>, which checks for a signed-in administrator first.

export const TRAINING_BUCKET = 'admin-training'

export type TrainingKey = 'website-tour' | 'admin-training' | 'quick-start'

export const TRAINING_FILES: Record<TrainingKey, { path: string; filename: string; label: string }> = {
  'website-tour': { path: 'impact-lab-website-tour.mp4', filename: 'Impact Lab - Website tour.mp4', label: 'Website tour (MP4)' },
  'admin-training': { path: 'impact-lab-admin-training.mp4', filename: 'Impact Lab - Admin training.mp4', label: 'Admin training (MP4)' },
  'quick-start': { path: 'impact-lab-admin-quick-start.pdf', filename: 'Impact Lab - Admin quick-start guide.pdf', label: 'Quick-start guide (PDF)' },
}

export const isTrainingKey = (k: string): k is TrainingKey => Object.hasOwn(TRAINING_FILES, k)

/** Chapters of the admin training video: [number, title, start in seconds]. */
export const ADMIN_TRAINING_CHAPTERS: [number, string, number][] = [
  [1, 'Signing in and your dashboard', 0],
  [2, 'Reviewing Needs your attention', 34.1],
  [3, 'Managing the three pathways', 60.9],
  [4, 'Creating a new cohort', 104.1],
  [5, 'Completing the readiness checklist', 128.9],
  [6, 'Setting sessions and meeting links', 164.3],
  [7, 'Adding resources and assignments', 190.3],
  [8, 'Reviewing an inquiry', 232.1],
  [9, 'Converting an inquiry into an enrollment', 258.4],
  [10, 'Inviting a participant', 287.5],
  [11, 'Managing organizational enrollment', 316.8],
  [12, 'Payment and registration statuses', 360.2],
  [13, 'Reviewing participant progress', 388.8],
  [14, 'Completion and future certificates', 410.8],
  [15, 'Checking communications and failed emails', 454.3],
  [16, 'Viewing reports', 483.7],
  [17, 'Security and two-step verification', 501.7],
  [18, 'Getting help', 531.1],
]
