'use client'

import { useEffect, useRef, useState } from 'react'
import type { Pathway } from '@/lib/pathways'
import { LEGACY_ANCHORS } from '@/lib/pathways'
import s from './impact.module.css'

const WHO: Record<string, string> = {
  'emerging-leaders': 'I’m preparing for greater responsibility',
  'new-leaders': 'I’m newly responsible for others',
  'practicing-leaders': 'I already lead people and teams',
}

export const PATHWAY_SELECTED_EVENT = 'impact:pathway-inquire'

// Accessible tabs: all three panels are in the HTML (search engines and no-JS readers see
// everything); only the selected one is shown.
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
        document.getElementById(`panel-${slug}`)?.scrollIntoView({ block: 'start' })
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

  const inquire = (slug: string) => {
    window.dispatchEvent(new CustomEvent(PATHWAY_SELECTED_EVENT, { detail: slug }))
    document.getElementById('inquire')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <p className={s.selectorLabel} id="selector-label">Which describes you right now?</p>
      <div className={s.tabs} role="tablist" aria-labelledby="selector-label">
        {pathways.map((p, i) => (
          <button
            key={p.slug}
            ref={el => { tabRefs.current[i] = el }}
            className={s.tab}
            role="tab"
            id={`tab-${p.slug}`}
            aria-controls={`panel-${p.slug}`}
            aria-selected={active === p.slug}
            tabIndex={active === p.slug ? 0 : -1}
            onClick={() => setActive(p.slug)}
            onKeyDown={e => onKey(e, i)}
          >
            <span className={s.tabWho}>{WHO[p.slug]}</span>
            <span className={s.tabTop}><span className={s.tabNum} aria-hidden="true">{p.number}</span><span className={s.tabName}>{p.name}</span></span>
            <span className={s.tabTag}>{p.tagline}</span>
          </button>
        ))}
      </div>

      {pathways.map(p => (
        <article key={p.slug} className={s.panel} role="tabpanel" id={`panel-${p.slug}`} aria-labelledby={`tab-${p.slug}`} tabIndex={0} hidden={active !== p.slug}>
          <div>
            <span className={s.panelLabel}>{p.number} — {p.name} · {p.tagline}</span>
            <h3 className={s.opening}>{p.openingStatement}</h3>
            <div className={s.panelBody}>
              <p>{p.audience}</p>
              <p>{p.description}</p>
            </div>
          </div>
          <div className={s.side}>
            <div>
              <span className={s.blockLabel}>Focus</span>
              <ul className={s.chips}>{p.focus.map(f => <li key={f}>{f}</li>)}</ul>
            </div>
            <div>
              <span className={s.blockLabel}>Development Goal</span>
              <p className={s.goal}>{p.goal}</p>
            </div>
            {p.priceLabel && (
              <div>
                <span className={s.blockLabel}>Investment</span>
                <p className={s.investment}>{p.priceLabel}</p>
              </div>
            )}
            <div className={s.ctas}>
              <button type="button" className={`${s.btn} ${s.btnGold}`} onClick={() => inquire(p.slug)}>
                Inquire About {p.name} <span className={s.arrow} aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </article>
      ))}
    </>
  )
}
