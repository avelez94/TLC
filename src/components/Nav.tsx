'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const dropdownRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDropdownOpen(false); setMenuOpen(false) }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  const closeAll = () => { setMenuOpen(false); setDropdownOpen(false) }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: 'var(--navy)',
      borderBottom: '1px solid rgba(200,136,32,0.18)',
      boxShadow: scrolled ? '0 2px 32px rgba(0,0,0,0.35)' : 'none',
      transition: 'box-shadow 0.25s',
      overflow: 'visible'
    }}>
      <div style={{
        maxWidth: '1140px', margin: '0 auto',
        padding: '0 clamp(1.25rem, 5vw, 2.75rem)',
        height: '115px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', gap: '1rem'
      }}>
        {/* Logo */}
        <Link href="/" onClick={closeAll} aria-label="TLC Leadership Home">
          <Image src="/images/tlc-logo.png" alt="TLC Leadership Consulting and Coaching" width={120} height={105} style={{ height: '105px', width: 'auto' }} priority />
        </Link>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label="Open navigation menu"
          style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: 'white', flexDirection: 'column', gap: '5px' }}
          className="nav-hamburger"
        >
          <span style={{ display: 'block', width: '24px', height: '2px', background: 'currentColor', borderRadius: '1px', transition: 'transform 0.2s, opacity 0.2s', transform: menuOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
          <span style={{ display: 'block', width: '24px', height: '2px', background: 'currentColor', borderRadius: '1px', opacity: menuOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
          <span style={{ display: 'block', width: '24px', height: '2px', background: 'currentColor', borderRadius: '1px', transition: 'transform 0.2s, opacity 0.2s', transform: menuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
        </button>

        {/* Links */}
        <ul className={`nav-links${menuOpen ? ' open' : ''}`} role="list">
          <li><Link href="/" onClick={closeAll}>Home</Link></li>
          <li><Link href="/about" onClick={closeAll}>About</Link></li>
          <li ref={dropdownRef} className="nav-dropdown" style={{ position: 'relative' }}>
            <button
              className="nav-dropdown-toggle"
              aria-expanded={dropdownOpen}
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen) }}
            >
              Services
              <span className="nav-dropdown-arrow" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} aria-hidden="true" />
            </button>
            {dropdownOpen && (
              <div className="nav-dropdown-menu" role="menu">
                <Link href="/consulting" onClick={closeAll} role="menuitem">Leadership Consulting</Link>
                <Link href="/coaching" onClick={closeAll} role="menuitem">Performance &amp; Success Coaching</Link>
                <div className="nav-dropdown-divider" aria-hidden="true" />
                <Link href="/impact" onClick={closeAll} role="menuitem">The Impact Lab</Link>
              </div>
            )}
          </li>
          <li><Link href="/resources" onClick={closeAll}>Resources</Link></li>
          <li><Link href="/contact" onClick={closeAll} style={{ color: 'var(--gold)' }}>Contact</Link></li>
          <li className="mobile-login-item">
            <Link href="/login" onClick={closeAll} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.2rem 2rem', color: 'rgba(255,255,255,0.5)', fontSize: '1rem' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }} aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Client Login
            </Link>
          </li>
        </ul>

        {/* Desktop CTA */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }} className="nav-cta-wrap">
          <Link href="/login" className="nav-login" aria-label="Client Login" title="Client Login">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: '16px', height: '16px' }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
        </div>
      </div>

      <style>{`
        .nav-hamburger { display: none; }
        .nav-links { display: flex; align-items: center; gap: 0.15rem; list-style: none; }
        .nav-links a { font-family: 'Montserrat', sans-serif; font-size: 0.92rem; font-weight: 600; letter-spacing: 0.04em; color: rgba(255,255,255,0.7); text-decoration: none; padding: 0.4rem 0.85rem; border-radius: 3px; transition: color 0.15s, background 0.15s; white-space: nowrap; cursor: pointer; }
        .nav-links a:hover { color: white; background: rgba(255,255,255,0.07); }
        .nav-dropdown-toggle { font-family: 'Montserrat', sans-serif; font-size: 0.92rem; font-weight: 600; letter-spacing: 0.04em; color: rgba(255,255,255,0.7); background: none; border: none; cursor: pointer; padding: 0.4rem 0.85rem; border-radius: 3px; display: flex; align-items: center; gap: 0.35rem; transition: color 0.15s, background 0.15s; white-space: nowrap; }
        .nav-dropdown-toggle:hover { color: white; background: rgba(255,255,255,0.07); }
        .nav-dropdown-arrow { width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid rgba(255,255,255,0.5); transition: transform 0.2s; flex-shrink: 0; }
        .nav-dropdown-menu { position: fixed; top: 115px; background: var(--navy2); border: 1px solid rgba(200,136,32,0.2); border-radius: 4px; min-width: 240px; padding: 0.5rem 0; box-shadow: 0 12px 32px rgba(0,0,0,0.35); z-index: 9999; }
        .nav-dropdown-menu a { display: block; padding: 0.65rem 1.25rem; font-size: 0.9rem; font-weight: 600; color: rgba(255,255,255,0.7); text-decoration: none; transition: color 0.15s, background 0.15s; }
        .nav-dropdown-menu a:hover { color: white; background: rgba(255,255,255,0.07); }
        .nav-dropdown-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 0.35rem 0; }
        .nav-login { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); text-decoration: none; transition: border-color 0.15s, color 0.15s; flex-shrink: 0; cursor: pointer; }
        .nav-login:hover { border-color: var(--gold); color: var(--gold); }
        .nav-cta-wrap { flex-shrink: 0; display: flex; align-items: center; gap: 0.75rem; }
        .mobile-login-item { display: none; border-top: 2px solid rgba(200,136,32,0.4); margin-top: 0.5rem; }
        @media (max-width: 900px) {
          .nav-hamburger { display: flex !important; }
          .nav-cta-wrap { display: none !important; }
          .nav-links { display: none; position: fixed; top: 115px; left: 0; right: 0; bottom: 0; background: var(--navy3); flex-direction: column; align-items: stretch; padding: 1.5rem 0; gap: 0; border-top: 2px solid var(--gold); overflow-y: auto; z-index: 9998; }
          .nav-links.open { display: flex; }
          .nav-links > li { width: 100%; }
          .nav-links a { font-size: 1.1rem; padding: 1.2rem 2rem; width: 100%; display: block; border-bottom: 1px solid rgba(255,255,255,0.05); }
          .nav-dropdown-toggle { font-size: 1.1rem; padding: 1.2rem 2rem; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.05); }
          .nav-dropdown-menu { position: static !important; background: rgba(255,255,255,0.03); box-shadow: none; border: none; padding: 0; }
          .nav-dropdown-menu a { font-size: 1rem; padding: 1rem 2.5rem; }
          .nav-dropdown-arrow { display: none; }
          .nav-dropdown-divider { display: none; }
          .mobile-login-item { display: block; }
          .nav-links > li:nth-child(2) { border-bottom: 2px solid rgba(200,136,32,0.4); }
          .nav-links > li:nth-child(4) { border-top: 2px solid rgba(200,136,32,0.4); }
        }
      `}</style>
    </nav>
  )
}