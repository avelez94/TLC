import type { Metadata } from 'next'
import { connection } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assertSafeEnvironment } from '@/lib/env-guard'
import { mergePathways, PATHWAY_SLUGS, type PathwayRow } from '@/lib/pathways'
import PathwaySelector from './PathwaySelector'
import InquiryForm from './InquiryForm'
import s from './impact.module.css'

const SITE = 'https://tramainecrawford.com'

export const metadata: Metadata = {
  title: 'The Impact Lab — Leadership Development Pathways | TLC Leadership',
  description: 'Cohort-based leadership development for emerging leaders, new supervisors and frontline managers. Three independent pathways: Emerging Leaders, New Leaders and Practicing Leaders.',
  alternates: { canonical: `${SITE}/impact` },
  openGraph: {
    title: 'The Impact Lab — Step Up. Solve Problems. Create Impact.',
    description: 'Three independent leadership development pathways from TLC Leadership Consulting & Coaching, for individuals and organizations.',
    url: `${SITE}/impact`,
    siteName: 'TLC Leadership Consulting & Coaching',
    type: 'website',
    images: [{ url: `${SITE}/images/impact-lab-banner.png`, width: 1140, height: 326, alt: 'The Impact Lab' }],
  },
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
    return mergePathways(error ? null : (data as PathwayRow[]))
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

      <section className={s.hero} aria-labelledby="hero-title">
        <div className={`${s.wrap} ${s.heroGrid}`}>
          <div>
            <span className={s.eyebrow}>The Impact Lab</span>
            <h1 id="hero-title" className={`${s.display} ${s.heroTitle}`}>
              <span>Step Up.</span><span>Solve Problems.</span><span className={s.gold}>Create Impact.</span>
            </h1>
            <p className={s.lede}>The Impact Lab is TLC Leadership Consulting &amp; Coaching&rsquo;s leadership development platform offering cohort-based programs for emerging leaders, new supervisors, and frontline managers.</p>
            <p className={s.more}>Through guided learning, meaningful discussion, deliberate practice, and real-world application, participants develop the skills, judgment, and confidence to navigate leadership responsibilities, solve workplace challenges, and lead others effectively.</p>
            <p className={s.more}>Whether preparing for your first leadership position, transitioning into supervision, or strengthening your effectiveness as a manager, The Impact Lab provides practical development experiences that help you turn learning into action and create meaningful impact in the workplace.</p>
            <div className={`${s.ctas} ${s.heroCtas}`}>
              <a className={`${s.btn} ${s.btnGold}`} href="#pathways">Explore the Pathways <span className={s.arrow} aria-hidden="true">&rarr;</span></a>
              <a className={`${s.btn} ${s.btnGhostLight}`} href="#inquire">Inquire About a Cohort</a>
            </div>
          </div>
          <dl className={s.audiences} aria-label="Who The Impact Lab is for">
            <div><dt>Preparing for a first leadership role</dt><dd>Emerging Leaders</dd></div>
            <div><dt>Transitioning into supervision</dt><dd>New Leaders</dd></div>
            <div><dt>Strengthening effectiveness as a manager</dt><dd>Practicing Leaders</dd></div>
          </dl>
        </div>
      </section>

      <section className={s.pathways} id="pathways" aria-labelledby="pathways-title">
        <div className={s.wrap}>
          <div className={s.sectionHead}>
            <div>
              <span className={s.eyebrow}>Leadership Development Pathways</span>
              <h2 id="pathways-title" className={`${s.display} ${s.sectionTitle}`}>Three Pathways.<br />One Purpose.</h2>
            </div>
            <p>Choose the pathway that matches your current role and development needs. Whether you are preparing for your first leadership position, transitioning into supervision, or strengthening your effectiveness as a manager, each pathway helps you turn learning into action.</p>
          </div>
          <p className={s.independent}>
            <span aria-hidden="true">&#9670;</span>
            <span><b>Independent pathways, not levels.</b> The numbers 01, 02 and 03 identify each pathway. There are no prerequisites and no required order: start with the one that fits where you are today.</span>
          </p>
          <PathwaySelector pathways={pathways} />
        </div>
      </section>

      <section className={s.how} aria-labelledby="how-title">
        <div className={s.wrap}>
          <span className={s.eyebrow}>How the Lab Works</span>
          <h2 id="how-title" className={`${s.display} ${s.howTitle}`}>Learning that turns into action</h2>
          <div className={s.howGrid}>
            <div className={s.howItem}><h3>Guided Learning</h3><p>Structured content and frameworks for the leadership responsibilities your role carries.</p></div>
            <div className={s.howItem}><h3>Meaningful Discussion</h3><p>Cohort conversations where participants test ideas against real workplace situations.</p></div>
            <div className={s.howItem}><h3>Deliberate Practice</h3><p>Specific skills rehearsed between sessions, so new behaviors become habits.</p></div>
            <div className={s.howItem}><h3>Real-World Application</h3><p>Every pathway connects learning to the challenges participants face at work.</p></div>
          </div>
        </div>
      </section>

      <section className={s.orgs} id="organizations" aria-labelledby="orgs-title">
        <div className={`${s.wrap} ${s.orgGrid}`}>
          <div>
            <span className={s.eyebrow}>For Organizations</span>
            <h2 id="orgs-title" className={`${s.display} ${s.orgTitle}`}><span>Develop Leaders.</span><span>Strengthen Teams.</span><span className={s.gold}>Improve Performance.</span></h2>
            <div className={s.orgCopy}>
              <p>Prepare your emerging leaders, strengthen new supervisors, and develop more effective frontline managers through practical, cohort-based leadership development.</p>
              <p>TLC Leadership Consulting &amp; Coaching offers opportunities for organizations to enroll employees in scheduled cohorts or explore dedicated programs aligned with their workforce development priorities.</p>
            </div>
            <div className={s.options} aria-label="Ways organizations can participate">
              <div><b>Scheduled</b><span>Enroll employees in an upcoming cohort alongside other organizations.</span></div>
              <div><b>Dedicated</b><span>Explore a program for your own team, aligned with your workforce priorities.</span></div>
            </div>
            <div className={s.ctas} style={{ marginTop: '2rem' }}>
              <a className={`${s.btn} ${s.btnGold}`} href="#inquire">Inquire About Organizational Programs <span className={s.arrow} aria-hidden="true">&rarr;</span></a>
            </div>
          </div>
          <div className={s.formCard} id="inquire">
            <h3 className={s.formTitle}>Start a Conversation</h3>
            <p className={s.formSub}>Tell us about your team or your goals. Tramaine will follow up personally.</p>
            <InquiryForm pathways={pathways} />
          </div>
        </div>
      </section>

      <section className={s.closing} aria-labelledby="closing-title">
        <div className={`${s.wrap} ${s.closingInner}`}>
          <div>
            <h2 id="closing-title" className={`${s.display} ${s.closingTitle}`}>Ready to <span className={s.gold}>step up?</span></h2>
            <p>Find the pathway that fits your role today, or talk with Tramaine about developing leaders across your organization.</p>
          </div>
          <div className={s.ctas}>
            <a className={`${s.btn} ${s.btnGold}`} href="#pathways">Explore the Pathways</a>
            <a className={`${s.btn} ${s.btnGhostDark}`} href="#inquire">Inquire About a Cohort</a>
          </div>
        </div>
      </section>
    </>
  )
}
