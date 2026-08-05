'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

interface Cohort {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  status: string
  program_id: string
  book_title: string | null
  book_image_url: string | null
  book_purchase_url: string | null
  programs?: { name: string } | null
}

const PROGRAM_LABELS: Record<string, string> = {
  finders: 'Impact Finders',
  makers: 'Impact Makers',
  leaders: 'Impact Leaders',
}

function ReadingContent() {
  const searchParams = useSearchParams()
  const programSlug = searchParams.get('program') // e.g. "finders", "makers", "leaders"

  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('cohorts')
        .select('id, name, start_date, end_date, status, program_id, book_title, book_image_url, book_purchase_url, programs(name)')
        .in('status', ['active', 'upcoming'])
        .not('book_title', 'is', null)
        .order('start_date')
      if (data) setCohorts(data as unknown as Cohort[])
      setLoading(false)
    }
    fetchData()
  }, [])

  const programLabel = programSlug ? PROGRAM_LABELS[programSlug] : null

  const filteredCohorts = programLabel
    ? cohorts.filter(c => c.programs?.name === programLabel)
    : cohorts

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'white', letterSpacing: '0.08em' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', fontFamily: 'var(--font-montserrat), sans-serif' }}>

      {/* HEADER */}
      <div style={{ background: 'var(--navy)', padding: 'clamp(1.25rem, 3vw, 1.75rem) clamp(1.25rem, 5vw, 2.75rem)', borderBottom: '1px solid rgba(200,136,32,0.15)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/">
            <Image src="/images/tlc-logo.png" alt="TLC Leadership" width={80} height={68} style={{ height: '68px', width: 'auto' }} />
          </Link>
          <Link href="/impact" style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
            &#8592; Back to Impact Lab
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: 'clamp(2.5rem, 6vw, 5rem) clamp(1.25rem, 5vw, 2.75rem)' }}>
        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.75rem' }}>
          {programLabel || 'The Impact Lab'}
        </span>
        <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.75rem' }}>What We Are Reading</h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.75, marginBottom: '2.5rem', maxWidth: '640px' }}>
          {programLabel
            ? `Here is what current and upcoming ${programLabel} cohorts are reading together.`
            : 'Each cohort centers around a book. Here is what current and upcoming cohorts are reading together.'}
        </p>

        {filteredCohorts.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid rgba(0,23,55,0.08)', borderRadius: '6px', padding: '3rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7 }}>
              {programLabel
                ? `No reading selections have been posted yet for ${programLabel}. Check back soon.`
                : 'No reading selections have been posted yet. Check back soon.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
            {filteredCohorts.map(cohort => (
              <div key={cohort.id} style={{ background: 'white', border: '1px solid rgba(0,23,55,0.1)', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {cohort.book_image_url ? (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '2/3', background: 'var(--mist)' }}>
                    <Image src={cohort.book_image_url} alt={cohort.book_title || 'Book cover'} fill style={{ objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: '100%', aspectRatio: '2/3', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em', padding: '1rem', textAlign: 'center' }}>{cohort.book_title}</span>
                  </div>
                )}
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)' }}>{cohort.programs?.name || 'Cohort'}</span>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.25rem', color: 'var(--navy)', letterSpacing: '0.03em', lineHeight: 1.15 }}>{cohort.book_title}</h3>
                  <p style={{ color: 'var(--slate)', fontSize: '0.82rem' }}>{cohort.name}</p>
                  {cohort.start_date && cohort.end_date && (
                    <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {formatDate(cohort.start_date)} to {formatDate(cohort.end_date)}
                    </p>
                  )}
                  {cohort.book_purchase_url && (
                    <a
                      href={cohort.book_purchase_url.startsWith('http') ? cohort.book_purchase_url : `https://${cohort.book_purchase_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{ fontSize: '0.78rem', padding: '0.65rem 1.1rem', marginTop: 'auto', textAlign: 'center' }}
                    >
                      Buy the Book
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Reading() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'white', letterSpacing: '0.08em' }}>Loading...</div>
      </div>
    }>
      <ReadingContent />
    </Suspense>
  )
}