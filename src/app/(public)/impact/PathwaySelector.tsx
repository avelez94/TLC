'use client'

import { useEffect, useRef, useState } from 'react'
import type { Pathway } from '@/lib/pathways'
import { LEGACY_ANCHORS, PATHWAY_FOR_WHOM } from '@/lib/pathways'
import InquiryLink from './InquiryLink'
import s from './impact.module.css'

// Accessible tabs: all three panels are in the HTML (search engines and no-JS readers see
// everything); only the selected one is shown. Numbers identify pathways; they are not steps.
export default function PathwaySelector({ pathways }: { pathways: Pathway[] }) {
  const [active, setActive] = useState(pathways[0]?.slug)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Deep links: /impact#new-leaders, and old /impact#finders|#makers|#leaders.
  useEffect(() => {
    const pick = () => {
      const hash = window.location.hash.replace('#', '')
      const slug = LEGACY_ANCHORS[hash] ?? hash
      if (pathways.some(p => p.slug === slug)) {
        setActive(slug as Pathway['slug'])
        document.getElementById('pathway-selector')?.scrollIntoView({ block: 'start' })
      }
    }
    pick()
    window.addEventListener('hashchange', pick)
    return () => window.removeEventListener('hashchange', pick)
  }, [pathways])

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = pathways.length
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n
      : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
    if (next < 0) return
    e.preventDefault()
    setActive(pathways[next].slug)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className={s.selector} id="pathway-selector">
      <p className={s.selectorLabel} id="selector-label">Which describes you right now?</p>
      <div className={s.tabs} role="tablist" aria-labelledby="selector-label" style={{ ['--tab-count' as string]: pathways.length }}>
        {pathways.map((p, i) => (
          <button
            key={p.slug}
            ref={el => { tabRefs.current[i] = el }}
            className={s.tab}
            role="tab"
            type="button"
            id={`tab-${p.slug}`}
            aria-controls={`panel-${p.slug}`}
            aria-selected={active === p.slug}
            tabIndex={active === p.slug ? 0 : -1}
            onClick={() => setActive(p.slug)}
            onKeyDown={e => onKey(e, i)}
          >
            <span className={s.tabNum} aria-hidden="true">{p.number}</span>
            <span className={s.tabText}>
              <span className={s.tabName}>{p.name}</span>
              <span className={s.tabWho}>{PATHWAY_FOR_WHOM[p.slug]}</span>
            </span>
          </button>
        ))}
      </div>

      {pathways.map(p => (
        <article key={p.slug} className={s.panel} role="tabpanel" id={`panel-${p.slug}`} aria-labelledby={`tab-${p.slug}`} tabIndex={0} hidden={active !== p.slug}>
          <div className={s.panelMain}>
            <span className={s.panelLabel}><span aria-hidden="true">{p.number} · </span>{p.name} · {p.tagline}</span>
            <h3 className={s.opening}>{p.openingStatement}</h3>
            <div className={s.panelBlock}>
              <span className={s.blockLabel}>Who it&rsquo;s for</span>
              <p>{p.audience}</p>
            </div>
            <div className={s.panelBlock}>
              <span className={s.blockLabel}>How you&rsquo;ll grow</span>
              <p>{p.description}</p>
            </div>
          </div>
          <aside className={s.panelSide} aria-label={`${p.name} at a glance`}>
            <div>
              <span className={s.blockLabel}>Focus areas</span>
              <ul className={s.chips}>{p.focus.map(f => <li key={f}>{f}</li>)}</ul>
            </div>
            <div>
              <span className={s.blockLabel}>Development goal</span>
              <p className={s.goal}>{p.goal}</p>
            </div>
            {p.priceLabel && (
              <div>
                <span className={s.blockLabel}>Investment</span>
                <p className={s.investment}>{p.priceLabel}</p>
              </div>
            )}
            <div className={s.panelCtas}>
              <InquiryLink kind="individual" pathway={p.slug} className={`${s.btn} ${s.btnGold} ${s.btnBlock}`}>
                Inquire About {p.name} <span className={s.arrow} aria-hidden="true">&rarr;</span>
              </InquiryLink>
              <InquiryLink kind="organization" pathway={p.slug} className={s.textLink}>
                Enrolling a team? Inquire for your organization
              </InquiryLink>
            </div>
          </aside>
        </article>
      ))}
    </div>
  )
}
