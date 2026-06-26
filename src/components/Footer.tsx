import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer role="contentinfo" style={{ background: 'var(--navy3)', borderTop: '3px solid var(--gold)', padding: 'clamp(3.5rem, 7vw, 5.5rem) 0 2rem' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: '3rem', marginBottom: '3rem' }} className="footer-grid">
          <div>
            <Image src="/images/tlc-logo.png" alt="TLC Leadership Consulting and Coaching" width={200} height={168} style={{ height: '168px', width: 'auto', marginBottom: '0.75rem' }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', lineHeight: 1.75, marginTop: '1rem' }}>
              Helping people grow, lead, and create greater impact. Individuals and organizations, from the front line to the executive suite.
            </p>
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <a href="mailto:tramaine@tramainecrawford.com" style={{ color: 'var(--gold)', fontSize: '0.82rem' }}>tramaine@tramainecrawford.com</a>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem' }}>(301) 793-3680</span>
            </div>
          </div>
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: 'var(--gold)', marginBottom: '1.1rem', display: 'block' }}>Services</span>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><Link href="/consulting" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Leadership Consulting</Link></li>
              <li><Link href="/coaching" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Performance &amp; Success Coaching</Link></li>
              <li><Link href="/impact" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>The Impact Lab</Link></li>
              <li style={{ paddingLeft: '0.75rem' }}><Link href="/impact#finders" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', opacity: 0.7 }}>Impact Finders</Link></li>
              <li style={{ paddingLeft: '0.75rem' }}><Link href="/impact#makers" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', opacity: 0.7 }}>Impact Makers</Link></li>
              <li style={{ paddingLeft: '0.75rem' }}><Link href="/impact#leaders" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', opacity: 0.7 }}>Impact Leaders</Link></li>
            </ul>
          </div>
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: 'var(--gold)', marginBottom: '1.1rem', display: 'block' }}>TLC</span>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><Link href="/about" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>About Tramaine</Link></li>
              <li><Link href="/resources" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Resources</Link></li>
              <li><Link href="/contact" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Contact</Link></li>
              <li><a href="https://www.linkedin.com/in/mrcrawfordceo/" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>LinkedIn</a></li>
            </ul>
            <div style={{ marginTop: '2rem' }}>
              <Link href="/contact" className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.7rem 1.35rem' }}>Schedule a Conversation</Link>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' as const }}>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>&copy; 2025 TLC Leadership Consulting &amp; Coaching. All rights reserved.</p>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.2)' }}>Develop Leaders. Solve Problems. Create Impact.</span>
        </div>
      </div>
      <style>{`
        @media (max-width: 720px) { .footer-grid { grid-template-columns: 1fr !important; gap: 2.25rem !important; } }
        .skip { position: absolute; top: -100%; left: 1rem; background: var(--gold); color: var(--navy); padding: .5rem 1rem; font-weight: 700; z-index: 9999; border-radius: 0 0 4px 4px; font-family: 'Montserrat', sans-serif; }
        .skip:focus { top: 0; }
      `}</style>
    </footer>
  )
}