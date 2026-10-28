import { describe, expect, it } from 'vitest'
import { decodePlan, encodePlan, toIcs } from './share'
import { blocksOf, buildYear } from './calendar'
import { daysUntil, num, rangeLabel, whenLabel } from './format'

describe('plan links', () => {
  it('round-trips leave days', () => {
    const enc = encodePlan(2027, [200, 3, 64, 3])
    expect(enc).toBe('2027:3.1s.5k')
    const dec = decodePlan('#' + enc)!
    expect(dec.year).toBe(2027)
    expect(dec.leave.sort((a, b) => a - b)).toEqual([3, 64, 200])
  })
  it('rejects junk', () => {
    expect(decodePlan('#hello')).toBeNull()
    expect(decodePlan('')).toBeNull()
    expect(decodePlan('#2027:')).toEqual({ year: 2027, leave: [] })
    expect(decodePlan('#2027:zzzz')!.leave).toEqual([])
  })
})

describe('toIcs', () => {
  it('writes one all-day event per break with leave', () => {
    const y = buildYear(2026, { saturdayWork: false })
    const i = (iso: string) => y.findIndex((d) => d.date === iso)
    const blocks = blocksOf(y, new Set([i('2026-05-25'), i('2026-05-26')])).filter((b) => b.leave.length)
    const ics = toIcs(y, blocks, new Date('2026-10-28T00:00:00Z'))
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260523')
    expect(ics).toContain('DTEND;VALUE=DATE:20260601')
    expect(ics).toContain('SUMMARY:Tatil: 9 gün (1,5 gün izin)')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})

describe('format', () => {
  const y = buildYear(2027, { saturdayWork: false })
  it('labels ranges in Turkish', () => {
    expect(rangeLabel(y[64], y[72])).toBe('6–14 Mart')
    expect(rangeLabel(y[58], y[61])).toBe('28 Şubat – 3 Mart')
  })
  it('formats numbers and countdowns', () => {
    expect(num(1.5)).toBe('1,5')
    expect(num(14)).toBe('14')
    expect(daysUntil('2026-10-28', '2026-10-29')).toBe(1)
    expect(whenLabel(0)).toBe('bugün')
    expect(whenLabel(1)).toBe('yarın')
    expect(whenLabel(14)).toBe('14 gün sonra (2 hafta)')
  })
})
