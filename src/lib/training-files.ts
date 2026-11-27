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
  [2, 'Reviewing Needs your attention', 35.0],
  [3, 'Managing the three pathways', 62.6],
  [4, 'Creating a new cohort', 107.2],
  [5, 'Completing the readiness checklist', 130.7],
  [6, 'Setting sessions and meeting links', 167.0],
  [7, 'Adding resources and assignments', 193.7],
  [8, 'Reviewing an inquiry', 235.9],
  [9, 'Converting an inquiry into an enrollment', 261.8],
  [10, 'Inviting a participant', 293.4],
  [11, 'Managing organizational enrollment', 322.4],
  [12, 'Payment and registration statuses', 366.3],
  [13, 'Reviewing participant progress', 396.4],
  [14, 'Completion and future certificates', 419.2],
  [15, 'Checking communications and failed emails', 463.6],
  [16, 'Viewing reports', 493.4],
  [17, 'Security and two-step verification', 511.8],
  [18, 'Getting help', 542.4],
]
