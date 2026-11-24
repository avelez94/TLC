// Parses a pasted list of people (organization enrollments): one per line, as
// "Name, email", "Name <email>" or "Name email". Lines without a valid email or a name are reported.
export interface PersonRow { name: string; email: string }
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Jane Smith, jane@x.com" or "Jane Smith <jane@x.com>" or "jane@x.com", one per line. */
export function parsePeople(text: string): { rows: PersonRow[]; problems: string[] } {
  const rows: PersonRow[] = []
  const problems: string[] = []
  text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach((line, i) => {
    const m = line.match(/<([^>]+)>/) ?? line.match(/([^\s,;<>]+@[^\s,;<>]+)/)
    const email = (m?.[1] ?? '').trim().toLowerCase()
    const name = line.replace(m?.[0] ?? '', '').replace(/[,;<>\t]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (!EMAIL_RE.test(email)) problems.push(`Line ${i + 1}: no valid email address (“${line.slice(0, 60)}”).`)
    else if (!name) problems.push(`Line ${i + 1}: add the person's name before ${email}.`)
    else rows.push({ name, email })
  })
  return { rows, problems }
}

