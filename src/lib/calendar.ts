import { holidaysOf, type Holiday } from './holidays'

export type Kind = 'work' | 'weekend' | 'holiday' | 'half'

export interface Day {
  /** Index within the year, 0 = 1 January */
  i: number
  date: string
  month: number
  dom: number
  /** 0 = Monday … 6 = Sunday */
  dow: number
  kind: Kind
  holiday?: Holiday
  /** Leave needed to have this day fully off: 1, 0.5 or 0 */
  cost: number
}

export interface Options {
  /** Saturday is a working day (6-day week) */
  saturdayWork: boolean
  /** Half-day leave is not possible, so an arife costs a full day */
  noHalfLeave?: boolean
}

export function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function buildYear(year: number, opts: Options): Day[] {
  const hol = new Map(holidaysOf(year).map((h) => [h.date, h]))
  const n = isLeap(year) ? 366 : 365
  const days: Day[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(year, 0, 1 + i))
    const date = d.toISOString().slice(0, 10)
    const dow = (d.getUTCDay() + 6) % 7
    const h = hol.get(date)
    const weekend = dow === 6 || (dow === 5 && !opts.saturdayWork)
    let kind: Kind = 'work'
    if (h && !h.half) kind = 'holiday'
    else if (weekend) kind = 'weekend'
    else if (h?.half) kind = 'half'
    const cost = kind === 'work' ? 1 : kind === 'half' ? (opts.noHalfLeave ? 1 : 0.5) : 0
    days.push({ i, date, month: d.getUTCMonth(), dom: d.getUTCDate(), dow, kind, holiday: h, cost })
  }
  return days
}

export interface Block {
  start: number
  end: number
  /** Total days in the block */
  length: number
  /** Leave days used */
  cost: number
  /** Indices of days you take leave on */
  leave: number[]
  holidays: Holiday[]
}

/** Contiguous runs of days off, given which days are taken as leave. */
export function blocksOf(days: Day[], leave: Set<number>): Block[] {
  const out: Block[] = []
  let cur: Block | null = null
  for (const d of days) {
    const off = d.cost === 0 || leave.has(d.i)
    if (off) {
      if (!cur) cur = { start: d.i, end: d.i, length: 0, cost: 0, leave: [], holidays: [] }
      cur.end = d.i
      cur.length++
      if (leave.has(d.i) && d.cost > 0) {
        cur.cost += d.cost
        cur.leave.push(d.i)
      }
      if (d.holiday) cur.holidays.push(d.holiday)
    } else if (cur) {
      out.push(cur)
      cur = null
    }
  }
  if (cur) out.push(cur)
  return out
}
