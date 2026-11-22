'use client'

import type { ReactNode } from 'react'
import { openInquiry, type OpenInquiryDetail } from './inquiry-events'

// A real link to #inquire (works without JavaScript); with JavaScript it also sets the form
// to the right audience and focuses the first field.
export default function InquiryLink({ kind, pathway, className, children }: OpenInquiryDetail & { className?: string; children: ReactNode }) {
  return (
    <a
      href="#inquire"
      className={className}
      onClick={e => {
        e.preventDefault()
        openInquiry({ kind, pathway })
        history.replaceState(null, '', '#inquire')
      }}
    >
      {children}
    </a>
  )
}
