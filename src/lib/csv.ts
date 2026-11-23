// CSV exports that open cleanly in Excel, Numbers and Google Sheets.
//  - UTF-8 with a byte-order mark, so names with accents and dashes (—) display correctly.
//  - CRLF line endings; cells with commas, quotes or line breaks are quoted.
//  - Spreadsheet formula injection is neutralised: text that starts with = + - @ (or a tab /
//    carriage return) is prefixed with an apostrophe so it is shown, never executed. Inquiry
//    fields come from a public form, so this matters.
export type CsvValue = string | number | boolean | null | undefined

const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  let s = String(value)
  if (FORMULA_START.test(s)) s = `'${s}`
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map(r => r.map(csvCell).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}

/** Browser only: save the CSV as a file. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
