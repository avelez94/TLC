'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

interface TimeSlot {
  time: string
  label: string
  available: boolean
}

interface DaySlots {
  date: Date
  dateStr: string
  label: string
  slots: TimeSlot[]
}

const TIME_SLOTS = [
  '08:00', '08:15', '08:30', '08:45',
  '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30', '11:45',
  '12:00', '12:15', '12:30', '12:45',
  '13:00', '13:15', '13:30', '13:45',
  '14:00', '14:15', '14:30', '14:45',
  '15:00', '15:15', '15:30', '15:45',
  '16:00', '16:15', '16:30', '16:45',
]

const formatTime = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

const dateStr = (d: Date) => d.toISOString().split('T')[0]

function getNext14Weekdays(): Date[] {
  const days: Date[] = []
  const now = new Date()
  const today = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  today.setHours(0, 0, 0, 0)
  let current = new Date(today)
  while (days.length < 14) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return days
}

export default function Schedule() {
  const [days, setDays] = useState<DaySlots[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [step, setStep] = useState<'pick' | 'form' | 'success'>('pick')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', reason: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAvailability = async () => {
      setLoading(true)
      const weekdays = getNext14Weekdays()
      const startDate = dateStr(weekdays[0])
      const endDate = dateStr(weekdays[weekdays.length - 1])

      const [{ data: bookings }, { data: blocks }] = await Promise.all([
        supabase.from('bookings').select('booking_date, booking_time').gte('booking_date', startDate).lte('booking_date', endDate),
        supabase.from('availability_blocks').select('block_date, block_time').gte('block_date', startDate).lte('block_date', endDate),
      ])

      const bookedSet = new Set((bookings || []).map(b => `${b.booking_date}|${b.booking_time}`))
      const blockedSet = new Set((blocks || []).map(b => `${b.block_date}|${b.block_time}`))

      // Get current ET time for filtering past slots today
      const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
      const nowETDate = new Date(nowET)
      const todayStr = dateStr(nowETDate)
      const currentHour = nowETDate.getHours()
      const currentMinute = nowETDate.getMinutes()

      const result: DaySlots[] = weekdays.map(date => {
        const ds = dateStr(date)
        return {
          date,
          dateStr: ds,
          label: formatDate(date),
          slots: TIME_SLOTS.filter(time => {
            // For today, filter out slots that have already passed
            if (ds === todayStr) {
              const [slotHour, slotMinute] = time.split(':').map(Number)
              if (slotHour < currentHour) return false
              if (slotHour === currentHour && slotMinute <= currentMinute) return false
            }
            return true
          }).map(time => ({
            time,
            label: formatTime(time),
            available: !bookedSet.has(`${ds}|${time}`) && !blockedSet.has(`${ds}|${time}`),
          })),
        }
      })

      setDays(result)
      setLoading(false)
    }
    fetchAvailability()
  }, [])

  const selectedDay = days.find(d => d.dateStr === selectedDate)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate || !selectedTime) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          booking_date: selectedDate,
          booking_time: selectedTime,
          date_label: selectedDay?.label,
          time_label: formatTime(selectedTime),
        }),
      })
      const data = await res.json()
      if (!data.error) setStep('success')
    } catch (err) {
      console.error(err)
    }
    setSubmitting(false)
  }

  const inputStyle = {
    width: '100%', padding: '0.9rem 1rem',
    border: '1.5px solid rgba(0,23,55,0.15)',
    borderRadius: '3px', color: 'var(--ink)',
    fontFamily: 'var(--font-montserrat), sans-serif',
    fontSize: '0.94rem', outline: 'none', background: 'white',
  }

  const labelStyle = {
    fontFamily: 'var(--font-jetbrains), monospace',
    fontSize: '0.65rem', letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: 'var(--slate)', marginBottom: '0.4rem', display: 'block',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', fontFamily: 'var(--font-montserrat), sans-serif' }}>

      {/* HEADER */}
      <div style={{ background: 'var(--navy)', padding: 'clamp(1.25rem, 3vw, 1.75rem) clamp(1.25rem, 5vw, 2.75rem)', borderBottom: '1px solid rgba(200,136,32,0.15)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/">
            <Image src="/images/tlc-logo.png" alt="TLC Leadership" width={80} height={68} style={{ height: '68px', width: 'auto' }} />
          </Link>
          <Link href="/contact" style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
            &#8592; Back to Contact
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: 'clamp(2rem, 5vw, 4rem) clamp(1.25rem, 5vw, 2.75rem)' }}>

        {/* STEP 1 — PICK DATE AND TIME */}
        {step === 'pick' && (
          <div>
            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.75rem' }}>Schedule a Conversation</span>
            <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 3rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>Pick a time.</h1>
            <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.75, marginBottom: '2.5rem' }}>15 minute phone call. Monday through Friday, 8 AM to 5 PM ET. Select a day and time that works for you.</p>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--slate)' }}>Loading availability...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="schedule-grid">
                {/* DATE PICKER */}
                <div>
                  <span style={labelStyle}>Select a Date</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {days.map(day => {
                      const hasAvailable = day.slots.some(s => s.available)
                      const isSelected = selectedDate === day.dateStr
                      return (
                        <button
                          key={day.dateStr}
                          onClick={() => { setSelectedDate(day.dateStr); setSelectedTime(null) }}
                          disabled={!hasAvailable}
                          style={{
                            padding: '0.85rem 1.25rem',
                            background: isSelected ? 'var(--navy)' : 'white',
                            border: `1.5px solid ${isSelected ? 'var(--navy)' : 'rgba(0,23,55,0.1)'}`,
                            borderRadius: '4px', cursor: hasAvailable ? 'pointer' : 'not-allowed',
                            textAlign: 'left', opacity: hasAvailable ? 1 : 0.35,
                            transition: 'all 0.15s',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.88rem', fontWeight: 600, color: isSelected ? 'white' : 'var(--navy)', display: 'block' }}>
                            {day.label}
                          </span>
                          {hasAvailable && (
                            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: isSelected ? 'rgba(255,255,255,0.6)' : 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                              {day.slots.filter(s => s.available).length} slots available
                            </span>
                          )}
                          {!hasAvailable && (
                            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                              Fully booked
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* TIME PICKER */}
                <div>
                  <span style={labelStyle}>{selectedDate ? `Available Times` : 'Select a date first'}</span>
                  {!selectedDate ? (
                    <div style={{ background: 'white', border: '1.5px solid rgba(0,23,55,0.08)', borderRadius: '4px', padding: '2rem', textAlign: 'center', color: 'var(--slate)', fontSize: '0.88rem' }}>
                      Pick a date on the left to see available times.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '540px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                      {selectedDay?.slots.map(slot => (
                        <button
                          key={slot.time}
                          onClick={() => slot.available && setSelectedTime(slot.time)}
                          disabled={!slot.available}
                          style={{
                            padding: '0.65rem 0.5rem',
                            background: selectedTime === slot.time ? 'var(--gold)' : slot.available ? 'white' : 'var(--mist)',
                            border: `1.5px solid ${selectedTime === slot.time ? 'var(--gold)' : slot.available ? 'rgba(0,23,55,0.1)' : 'transparent'}`,
                            borderRadius: '3px', cursor: slot.available ? 'pointer' : 'not-allowed',
                            fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.82rem',
                            fontWeight: 600, color: selectedTime === slot.time ? 'var(--navy)' : slot.available ? 'var(--ink)' : 'var(--slate)',
                            opacity: slot.available ? 1 : 0.4, transition: 'all 0.15s',
                          }}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedDate && selectedTime && (
                    <button
                      onClick={() => setStep('form')}
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: '1rem', fontSize: '0.88rem' }}
                    >
                      Continue with {formatTime(selectedTime)} &#8594;
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — FORM */}
        {step === 'form' && selectedDate && selectedTime && (
          <div style={{ maxWidth: '520px' }}>
            <button onClick={() => setStep('pick')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, padding: 0 }}>
              &#8592; Back
            </button>
            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }}>Almost there</span>
            <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 2.75rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '1.5rem' }}>Your information</h1>

            <div style={{ background: 'var(--navy)', borderRadius: '6px', padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', fontFamily: 'var(--font-jetbrains), monospace', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.35rem' }}>Your appointment</p>
              <p style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.15rem' }}>{selectedDay?.label}</p>
              <p style={{ color: 'var(--gold)', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.15rem' }}>{formatTime(selectedTime)} ET</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem' }}>15 minute phone call</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Your full name" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(000) 000-0000" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>What would you like to discuss?</label>
                <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Give Tramaine a brief idea of what you are hoping to talk about." rows={3} style={{ ...inputStyle, resize: 'vertical' }} required />
              </div>
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', fontSize: '0.88rem' }}>
                {submitting ? 'Booking...' : 'Confirm Appointment'}
              </button>
              <p style={{ color: 'var(--slate)', fontSize: '0.78rem', textAlign: 'center', lineHeight: 1.6 }}>
                You will receive a confirmation email with your appointment details.
              </p>
            </form>
          </div>
        )}

        {/* STEP 3 — SUCCESS */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '3rem 0', maxWidth: '480px', margin: '0 auto' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.5rem' }}>✓</div>
            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.75rem' }}>You are on the calendar</span>
            <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 3rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '1rem' }}>See you soon.</h1>
            <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.75, marginBottom: '0.5rem' }}>
              Your appointment is confirmed for <strong>{selectedDay?.label}</strong> at <strong>{selectedTime ? formatTime(selectedTime) : ''} ET</strong>.
            </p>
            <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.75, marginBottom: '2rem' }}>
              Check your email for confirmation. Tramaine will call you at the number you provided.
            </p>
            <Link href="/" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Back to Home</Link>
          </div>
        )}
      </div>

      <style>{`
        input:focus, textarea:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,136,32,0.1); }
        @media (max-width: 640px) { .schedule-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}