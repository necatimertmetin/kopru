import type { Day } from './calendar'

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export const DOW = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
export const DOW_SHORT = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

/** 1.5 -> "1,5" */
export function num(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',')
}

export function dayLabel(d: Day): string {
  return `${d.dom} ${MONTHS[d.month]}`
}

/** "23–31 Mayıs" or "28 Şubat – 3 Mart" */
export function rangeLabel(a: Day, b: Day): string {
  if (a.i === b.i) return dayLabel(a)
  if (a.month === b.month) return `${a.dom}–${b.dom} ${MONTHS[a.month]}`
  return `${dayLabel(a)} – ${dayLabel(b)}`
}

export function daysUntil(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86_400_000)
}

export function whenLabel(n: number): string {
  if (n === 0) return 'bugün'
  if (n === 1) return 'yarın'
  if (n < 7) return `${n} gün sonra`
  if (n < 60) return `${n} gün sonra (${Math.floor(n / 7)} hafta)`
  return `${n} gün sonra (yaklaşık ${Math.round(n / 30)} ay)`
}

/** Today in Türkiye (UTC+3), as YYYY-MM-DD. */
export function todayTR(now = Date.now()): string {
  return new Date(now + 3 * 3_600_000).toISOString().slice(0, 10)
}
