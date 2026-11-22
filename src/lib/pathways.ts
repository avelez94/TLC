// The three Impact Lab pathways. Copy is owner-approved (2026-11-20). The database
// (programs rows with these slugs) is the source of truth once the 2c migration is applied;
// these values are the fallback so the public page never renders empty.

export type PathwaySlug = 'emerging-leaders' | 'new-leaders' | 'practicing-leaders'

export interface Pathway {
  id: string | null
  slug: PathwaySlug
  number: string // "01" — visual label only; pathways are independent, not sequential
  name: string
  tagline: string
  openingStatement: string
  audience: string
  description: string
  goal: string
  focus: string[]
  priceLabel: string | null
  enrollmentOpen: boolean
}

export const PATHWAY_SLUGS: PathwaySlug[] = ['emerging-leaders', 'new-leaders', 'practicing-leaders']

/** Old anchors and contact-form keys from the retired "levels" page. */
export const LEGACY_ANCHORS: Record<string, PathwaySlug> = {
  finders: 'emerging-leaders',
  makers: 'new-leaders',
  leaders: 'practicing-leaders',
}

export const DEFAULT_PATHWAYS: Pathway[] = [
  {
    id: null,
    slug: 'emerging-leaders',
    number: '01',
    name: 'Emerging Leaders',
    tagline: 'Prepare to Lead',
    openingStatement: 'Leadership begins before you receive a title.',
    audience: 'The Emerging Leaders pathway is designed for aspiring supervisors, high-potential employees, and professionals preparing for greater leadership responsibility.',
    description: 'Through guided learning, practical discussion, deliberate practice, and real-world application, participants develop the mindset, skills, and professional behaviors needed to lead themselves effectively, influence others, solve problems, and demonstrate readiness for leadership.',
    goal: 'Build the foundational leadership capabilities needed to take initiative, exercise sound judgment, communicate effectively, influence others, and prepare for greater responsibility.',
    focus: ['Self-Leadership', 'Communication', 'Accountability', 'Influence'],
    priceLabel: null,
    enrollmentOpen: false,
  },
  {
    id: null,
    slug: 'new-leaders',
    number: '02',
    name: 'New Leaders',
    tagline: 'Make the Transition to Leadership',
    openingStatement: 'Being good at your job does not automatically prepare you to lead others.',
    audience: 'The New Leaders pathway is designed for newly promoted supervisors, first-time managers, and professionals transitioning into formal leadership responsibilities.',
    description: 'Through practical learning, real-world scenarios, guided discussion, and deliberate practice, participants develop the foundational supervisory skills needed to establish expectations, communicate effectively, delegate responsibilities, address performance concerns, and build productive relationships with employees.',
    goal: 'Develop the knowledge, skills, and judgment needed to transition successfully into leadership and effectively manage the responsibilities of supervising others.',
    focus: ['Supervision', 'Communication', 'Accountability', 'Performance'],
    priceLabel: null,
    enrollmentOpen: false,
  },
  {
    id: null,
    slug: 'practicing-leaders',
    number: '03',
    name: 'Practicing Leaders',
    tagline: 'Strengthen Your Leadership Effectiveness',
    openingStatement: 'Leadership effectiveness is measured by more than what you accomplish personally.',
    audience: 'It is reflected in how well you lead, develop, and enable others to perform. The Practicing Leaders pathway is designed for established supervisors, team leaders, and frontline managers seeking to strengthen their effectiveness in leading people and teams.',
    description: 'Through guided learning, meaningful discussion, deliberate practice, and workplace application, participants strengthen the skills and judgment needed to coach and develop others, navigate complex workplace challenges, lead change, and create conditions where individuals and teams perform at a higher level.',
    goal: 'Strengthen the leadership capabilities needed to develop employees, navigate complex workplace challenges, improve team effectiveness, and achieve results through others.',
    focus: ['People Development', 'Team Performance', 'Influence', 'Results'],
    priceLabel: null,
    enrollmentOpen: false,
  },
]

export interface PathwayRow {
  id: string
  slug: string | null
  pathway_number: number | null
  name: string
  tagline: string | null
  opening_statement: string | null
  audience: string | null
  description: string | null
  leadership_goal: string | null
  keywords: string | null
  price_label: string | null
  enrollment_open: boolean | null
  is_public: boolean | null
}

/** Merge database rows over the approved defaults; unknown or hidden rows are ignored. */
export function mergePathways(rows: PathwayRow[] | null | undefined): Pathway[] {
  return DEFAULT_PATHWAYS.map(def => {
    const row = rows?.find(r => r.slug === def.slug && r.is_public !== false)
    if (!row) return def
    const focus = (row.keywords ?? '').split(',').map(s => s.trim()).filter(Boolean)
    return {
      id: row.id,
      slug: def.slug,
      number: row.pathway_number ? String(row.pathway_number).padStart(2, '0') : def.number,
      name: row.name || def.name,
      tagline: row.tagline || def.tagline,
      openingStatement: row.opening_statement || def.openingStatement,
      audience: row.audience || def.audience,
      description: row.description || def.description,
      goal: row.leadership_goal || def.goal,
      focus: focus.length ? focus : def.focus,
      // A price is shown only when the pathway is open for enrollment and a label is set.
      priceLabel: row.enrollment_open && row.price_label ? row.price_label : null,
      enrollmentOpen: !!row.enrollment_open,
    }
  })
}
