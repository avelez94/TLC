// Date convention for everything the business sees (admin screens, CSV exports):
//  - Moments (created_at, sign-ins, activity) are shown in America/New_York, labelled "ET".
//  - Calendar dates stored without a time (start_date, due_date, follow_up_on) are shown
//    exactly as stored; they are never shifted by a time zone.
//  - "Today" (follow-ups due, schedules) is today's date in America/New_York.
export const BUSINESS_TZ = 'America/New_York'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Today's calendar date in New York, as YYYY-MM-DD. */
export function todayET(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** "Nov 22, 2026, 8:13 PM ET" */
export function formatDateTimeET(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return `${new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)} ET`
}

/** "Nov 22, 2026". Date-only values are shown as stored; timestamps in New York time. */
export function formatDateET(value: string | Date | null | undefined, style: 'short' | 'long' = 'short'): string {
  if (!value) return ''
  const opts: Intl.DateTimeFormatOptions = { month: style, day: 'numeric', year: 'numeric' }
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
  }
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: BUSINESS_TZ }).format(d)
}

/** For CSV files: "2026-11-22 20:13" in New York time (column headers say "(ET)"). */
export function csvDateTimeET(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

/** Days from today (New York) to a YYYY-MM-DD date; negative when it is in the past. */
export function daysFromTodayET(date: string, now: Date = new Date()): number {
  const a = Date.parse(`${todayET(now)}T00:00:00Z`)
  const b = Date.parse(`${date}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}
