import type { Metadata } from 'next'
import { connection } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assertSafeEnvironment } from '@/lib/env-guard'
import { visiblePathwayLinks } from '@/lib/public-pathways'
import { countWord, mergePathways, PATHWAY_FOR_WHOM, PATHWAY_SLUGS, type PathwayRow } from '@/lib/pathways'
import PathwaySelector from './PathwaySelector'
import { loadLaunchReadiness } from '@/lib/launch-server'
import InquiryForm from './InquiryForm'
import InquiryLink from './InquiryLink'
import s from './impact.module.css'

const SITE = 'https://tramainecrawford.com'

export async function generateMetadata(): Promise<Metadata> {
  // Built from the pathways visitors can see, so a hidden pathway is not advertised here either.
  const visible = await visiblePathwayLinks()
  const names = visible.map(p => p.name)
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? ''
  const count = countWord(names.length)
  return {
    title: 'The Impact Lab — Leadership Development Pathways | TLC Leadership',
    description: `Cohort-based leadership development for emerging leaders, new supervisors and frontline managers. ${count} independent pathway${names.length === 1 ? '' : 's'}: ${list}.`,
    alternates: { canonical: `${SITE}/impact` },
    openGraph: {
      title: 'The Impact Lab — Step Up. Solve Problems. Create Impact.',
      description: `${count} independent leadership development pathway${names.length === 1 ? '' : 's'} from TLC Leadership Consulting & Coaching, for individuals and organizations.`,
      url: `${SITE}/impact`,
      siteName: 'TLC Leadership Consulting & Coaching',
      type: 'website',
      images: [{ url: `${SITE}/images/impact-lab-banner.png`, width: 1140, height: 326, alt: 'The Impact Lab' }],
    },
  }
}

async function loadPathways() {
  assertSafeEnvironment(process.env)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return mergePathways(null)
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const { data, error } = await supabase
      .from('programs')
      .select('id, slug, pathway_number, name, tagline, opening_statement, audience, description, leadership_goal, keywords, price_label, enrollment_open, is_public')
      .in('slug', PATHWAY_SLUGS)
      .abortSignal(AbortSignal.timeout(3000))
    // Price and registration appear only for pathways with a cohort the launch gate has opened.
    const readiness = await loadLaunchReadiness().catch(() => null)
    const openProgramIds = new Set(readiness?.pathways.filter(p => p.open).map(p => p.id) ?? [])
    return mergePathways(error ? null : (data as PathwayRow[]), { openProgramIds })
  } catch {
    return mergePathways(null) // approved copy if the database is unreachable
  }
}

export default async function ImpactLabPage() {
  await connection() // render per request so admin edits appear immediately
  const pathways = await loadPathways()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        '@id': `${SITE}/#organization`,
        name: 'TLC Leadership Consulting & Coaching',
        url: SITE,
        founder: { '@type': 'Person', name: 'Tramaine L. Crawford' },
      },
      ...pathways.map(p => ({
        '@type': 'Course',
        name: `${p.name} — ${p.tagline}`,
        description: `${p.openingStatement} ${p.audience}`,
        url: `${SITE}/impact#${p.slug}`,
        provider: { '@id': `${SITE}/#organization` },
        educationalLevel: 'Professional',
        teaches: p.focus,
      })),
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      {/* ------------------------------------------------------------------ hero */}
      <section className={s.hero} aria-labelledby="hero-title">
        <div className={`${s.wrap} ${s.heroGrid}`}>
          <div className={s.heroMain}>
            <span className={s.eyebrow}>The Impact Lab</span>
            <h1 id="hero-title" className={s.heroTitle}>
              <span>Step Up.</span> <span>Solve Problems.</span> <span className={s.gold}>Create Impact.</span>
            </h1>
            <p className={s.lede}>The Impact Lab is TLC Leadership Consulting &amp; Coaching&rsquo;s leadership development platform offering cohort-based programs for emerging leaders, new supervisors, and frontline managers.</p>
            <div className={s.ctas}>
              <a className={`${s.btn} ${s.btnGold}`} href="#pathways">Explore the Pathways <span className={s.arrow} aria-hidden="true">&rarr;</span></a>
              <a className={`${s.btn} ${s.btnGhostLight}`} href="#organizations">Organizational Programs</a>
            </div>
          </div>

          <nav className={s.heroPathways} aria-label={`The ${countWord(pathways.length).toLowerCase()} pathways`}>
            <span className={s.heroPathwaysLabel}>{`${countWord(pathways.length)} independent pathway${pathways.length === 1 ? '' : 's'}`}</span>
            <ul>
              {pathways.map(p => (
                <li key={p.slug}>
                  <a href={`#${p.slug}`} className={s.heroPathway}>
                    <span className={s.heroNum} aria-hidden="true">{p.number}</span>
                    <span className={s.heroPathwayText}>
                      <span className={s.heroPathwayName}>{p.name}</span>
                      <span className={s.heroPathwayWho}>{PATHWAY_FOR_WHOM[p.slug]}</span>
                    </span>
                    <span className={s.heroChevron} aria-hidden="true">&rsaquo;</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {/* ------------------------------------------------------------------ pathways */}
      <section className={s.pathways} id="pathways" aria-labelledby="pathways-title">
        <div className={s.wrap}>
          <div className={s.sectionHead}>
            <div>
              <span className={s.eyebrowDark}>Leadership Development Pathways</span>
              <h2 id="pathways-title" className={s.sectionTitle}>{`${countWord(pathways.length)} Pathway${pathways.length === 1 ? '' : 's'}. One Purpose.`}</h2>
            </div>
            <div className={s.sectionIntro}>
              <p>Whether preparing for your first leadership position, transitioning into supervision, or strengthening your effectiveness as a manager, The Impact Lab provides practical development experiences that help you turn learning into action and create meaningful impact in the workplace.</p>
              <p className={s.independent}><b>Independent pathways, not levels.</b> The numbers 01, 02 and 03 identify each pathway. There are no prerequisites and no required order: start with the one that fits your role today.</p>
            </div>
          </div>
          {pathways.length > 0 && <PathwaySelector pathways={pathways} />}
        </div>
      </section>

      {/* ------------------------------------------------------------------ how it works */}
      <section className={s.how} aria-labelledby="how-title">
        <div className={s.wrap}>
          <div className={s.sectionHead}>
            <div>
              <span className={s.eyebrowDark}>How the Lab Works</span>
              <h2 id="how-title" className={s.sectionTitle}>Learning that turns into action.</h2>
            </div>
            <div className={s.sectionIntro}>
              <p>Through guided learning, meaningful discussion, deliberate practice, and real-world application, participants develop the skills, judgment, and confidence to navigate leadership responsibilities, solve workplace challenges, and lead others effectively.</p>
            </div>
          </div>
          <ol className={s.howGrid}>
            <li className={s.howItem}><h3>Guided Learning</h3><p>Structured content and frameworks for the leadership responsibilities your role carries.</p></li>
            <li className={s.howItem}><h3>Meaningful Discussion</h3><p>Cohort conversations where participants test ideas against real workplace situations.</p></li>
            <li className={s.howItem}><h3>Deliberate Practice</h3><p>Specific skills rehearsed between sessions, so new behaviors become habits.</p></li>
            <li className={s.howItem}><h3>Real-World Application</h3><p>Every pathway connects learning to the challenges participants face at work.</p></li>
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------ organizations */}
      <section className={s.orgs} id="organizations" aria-labelledby="orgs-title">
        <div className={`${s.wrap} ${s.orgGrid}`}>
          <div className={s.orgIntro}>
            <span className={s.eyebrow}>For Organizations</span>
            <h2 id="orgs-title" className={s.orgTitle}><span>Develop Leaders.</span> <span>Strengthen Teams.</span> <span className={s.gold}>Improve Performance.</span></h2>
            <p className={s.orgLede}>Prepare your emerging leaders, strengthen new supervisors, and develop more effective frontline managers through practical, cohort-based leadership development.</p>
            <p className={s.orgCopy}>TLC Leadership Consulting &amp; Coaching offers opportunities for organizations to enroll employees in scheduled cohorts or explore dedicated programs aligned with their workforce development priorities.</p>
            <ul className={s.options} aria-label="Ways organizations can participate">
              <li>
                <span className={s.optionLabel}>Scheduled cohorts</span>
                <span>Enroll employees in an upcoming cohort for the pathway that fits their role.</span>
              </li>
              <li>
                <span className={s.optionLabel}>Dedicated programs</span>
                <span>Explore a program for your own team, aligned with your workforce development priorities.</span>
              </li>
            </ul>
            <p className={s.orgAudience}>For HR leaders, department heads, organizational development teams and other decision-makers responsible for developing leaders.</p>
            <div className={s.ctas}>
              <InquiryLink kind="organization" className={`${s.btn} ${s.btnGold}`}>Inquire About Organizational Programs <span className={s.arrow} aria-hidden="true">&rarr;</span></InquiryLink>
            </div>
          </div>
          <div className={s.formCard} id="inquire" tabIndex={-1} aria-labelledby="inquire-title">
            <h3 id="inquire-title" className={s.formTitle}>Start a Conversation</h3>
            <p className={s.formSub}>Tell us about your team or your goals. Tramaine will follow up personally.</p>
            <InquiryForm pathways={pathways} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ closing */}
      <section className={s.closing} aria-labelledby="closing-title">
        <div className={`${s.wrap} ${s.closingInner}`}>
          <div>
            <h2 id="closing-title" className={s.closingTitle}>Ready to <span className={s.goldDark}>step up?</span></h2>
            <p>Find the pathway that fits your role today, or talk with Tramaine about developing leaders across your organization.</p>
          </div>
          <div className={s.ctas}>
            <a className={`${s.btn} ${s.btnNavy}`} href="#pathways">Explore the Pathways</a>
            <InquiryLink kind="individual" className={`${s.btn} ${s.btnGhostDark}`}>Inquire About a Cohort</InquiryLink>
          </div>
        </div>
      </section>
    </>
  )
}
