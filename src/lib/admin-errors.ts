// Plain-language messages for database errors shown in the admin portal.
export interface DbError { code?: string; message?: string; details?: string | null; hint?: string | null }

export function friendlyError(error: DbError | null | undefined, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback
  const { code, message = '', details } = error
  if (details === 'cohort_full' || details === 'self_demotion' || details === 'last_admin') return message
  if (code === '23505') return 'That already exists (for example, the person is already enrolled in this cohort).'
  if (code === '23503') return 'Other records depend on this one, so it cannot be removed. Archive it instead to keep its history.'
  if (code === '23514') return message.includes('violates check constraint') ? 'One of the values is not allowed (too long, or outside the allowed range).' : message
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return 'You do not have permission to do that. Sign out and sign in again (with your two-step code if you use one).'
  }
  if (/Failed to fetch|NetworkError|network/i.test(message)) return 'The site could not reach the database. Check your connection and try again.'
  return message || fallback
}
