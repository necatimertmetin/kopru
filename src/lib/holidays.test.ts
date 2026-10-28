import { describe, expect, it } from 'vitest'
import { addDays, holidaysOf } from './holidays'
import { blocksOf, buildYear } from './calendar'

describe('holidaysOf', () => {
  it('lists the 2026 holidays with Diyanet dates', () => {
    const h = holidaysOf(2026)
    const dates = h.map((x) => x.date)
    expect(dates).toContain('2026-03-19') // Ramazan arife
    expect(dates).toContain('2026-03-22')
    expect(dates).toContain('2026-05-26') // Kurban arife
    expect(dates).toContain('2026-05-30')
    expect(h.find((x) => x.date === '2026-10-28')?.half).toBe(true)
    // 8 fixed (incl. 28 Oct half) + 2 arife + 3 + 4
    expect(h).toHaveLength(17)
  })

  it('uses 9–11 March for Ramazan Bayramı 2027 (Diyanet), not 10–12', () => {
    const r = holidaysOf(2027).filter((x) => x.name.startsWith('Ramazan Bayramı') && !x.half)
    expect(r.map((x) => x.date)).toEqual(['2027-03-09', '2027-03-10', '2027-03-11'])
  })

  it('merges 19 May with the 4th day of Kurban Bayramı in 2027', () => {
    const d = holidaysOf(2027).filter((x) => x.date === '2027-05-19')
    expect(d).toHaveLength(1)
    expect(d[0].name).toContain('Kurban')
    expect(d[0].name).toContain('Atatürk')
  })

  it('adds days across month ends', () => {
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-03-09', -1)).toBe('2027-03-08')
  })
})

describe('buildYear', () => {
  const y26 = buildYear(2026, { saturdayWork: false })

  it('has the right number of days and weekdays', () => {
    expect(y26).toHaveLength(365)
    expect(buildYear(2028, { saturdayWork: false })).toHaveLength(366)
    expect(y26[0].dow).toBe(3) // 1 Jan 2026 is a Thursday
  })

  it('classifies days and leave cost', () => {
    const at = (iso: string) => y26.find((d) => d.date === iso)!
    expect(at('2026-01-01')).toMatchObject({ kind: 'holiday', cost: 0 })
    expect(at('2026-01-02')).toMatchObject({ kind: 'work', cost: 1 })
    expect(at('2026-01-03')).toMatchObject({ kind: 'weekend', cost: 0 })
    expect(at('2026-03-19')).toMatchObject({ kind: 'half', cost: 0.5 })
  })

  it('makes Saturday a work day for six-day weeks', () => {
    const six = buildYear(2026, { saturdayWork: true })
    expect(six.find((d) => d.date === '2026-01-03')!.kind).toBe('work')
    expect(six.find((d) => d.date === '2026-01-04')!.kind).toBe('weekend')
  })

  it('charges a full day for arife when half-day leave is not allowed', () => {
    const y = buildYear(2026, { saturdayWork: false, noHalfLeave: true })
    expect(y.find((d) => d.date === '2026-03-19')!.cost).toBe(1)
  })

  it('treats an arife that falls on a weekend as a weekend', () => {
    const y = buildYear(2027, { saturdayWork: false })
    expect(y.find((d) => d.date === '2027-05-15')!.kind).toBe('weekend')
  })
})

describe('blocksOf', () => {
  it('joins weekends, holidays and leave into one break', () => {
    const y = buildYear(2026, { saturdayWork: false })
    const i = (iso: string) => y.findIndex((d) => d.date === iso)
    // Kurban 2026: leave Mon 25 + arife Tue 26 -> Sat 23 .. Sun 31
    const blocks = blocksOf(y, new Set([i('2026-05-25'), i('2026-05-26')]))
    const b = blocks.find((x) => x.leave.length)!
    expect(y[b.start].date).toBe('2026-05-23')
    expect(y[b.end].date).toBe('2026-05-31')
    expect(b.length).toBe(9)
    expect(b.cost).toBe(1.5)
  })
})
