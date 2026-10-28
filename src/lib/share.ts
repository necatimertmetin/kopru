import type { Block, Day } from './calendar'
import { addDays } from './holidays'
import { num } from './format'

/** Leave days <-> compact URL fragment: "2027:1a.1b.2f" (day-of-year in base 36). */
export function encodePlan(year: number, leave: Iterable<number>): string {
  const list = [...new Set(leave)].sort((a, b) => a - b).map((i) => i.toString(36))
  return `${year}:${list.join('.')}`
}

export function decodePlan(hash: string): { year: number; leave: number[] } | null {
  const m = /^#?(\d{4}):([0-9a-z.]*)$/.exec(hash.trim())
  if (!m) return null
  const year = Number(m[1])
  const leave = m[2]
    ? m[2]
        .split('.')
        .map((s) => parseInt(s, 36))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < 366)
    : []
  return { year, leave: [...new Set(leave)] }
}

const icsDate = (iso: string) => iso.replace(/-/g, '')

/** An iCalendar file with one all-day event per break that uses leave. */
export function toIcs(days: Day[], blocks: Block[], stamp = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kopru//Izin Planlayici//TR', 'CALSCALE:GREGORIAN']
  for (const b of blocks) {
    if (!b.leave.length) continue
    const start = days[b.start].date
    const end = days[b.end].date
    lines.push(
      'BEGIN:VEVENT',
      `UID:kopru-${start}-${end}@kopru`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${icsDate(start)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(end, 1))}`,
      `SUMMARY:Tatil: ${b.length} gün (${num(b.cost)} gün izin)`,
      `DESCRIPTION:İzin günleri: ${b.leave.map((i) => days[i].date).join(', ')}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
