import { describe, expect, it } from 'vitest'
import { blocksOf, buildYear, type Day } from './calendar'
import { bestPlan, candidates, opportunities, topPicks } from './optimize'

const y26 = buildYear(2026, { saturdayWork: false })
const y27 = buildYear(2027, { saturdayWork: false })
const label = (days: Day[], s: number, e: number) => `${days[s].date}..${days[e].date}`

/** Brute force for small budgets: try every set of leave days in a short range. */
function bruteBest(days: Day[], from: number, to: number, budgetHalves: number): number {
  const work = days.slice(from, to + 1).filter((d) => d.cost > 0)
  let best = 0
  const n = work.length
  for (let mask = 0; mask < 1 << n; mask++) {
    let halves = 0
    const leave = new Set<number>()
    for (let k = 0; k < n; k++)
      if (mask & (1 << k)) {
        halves += work[k].cost * 2
        leave.add(work[k].i)
      }
    if (halves > budgetHalves) continue
    const total = blocksOf(days.slice(0, to + 1), leave)
      .filter((b) => b.leave.length && b.start >= from)
      .reduce((s, b) => s + b.length, 0)
    best = Math.max(best, total)
  }
  return best
}

describe('candidates', () => {
  it('only returns windows bounded by working days', () => {
    for (const w of candidates(y26, 0, 6)) {
      if (w.start > 0) expect(y26[w.start - 1].cost).toBeGreaterThan(0)
      if (w.end < y26.length - 1) expect(y26[w.end + 1].cost).toBeGreaterThan(0)
      expect(w.halves).toBeGreaterThan(0)
      expect(w.halves).toBeLessThanOrEqual(6)
    }
  })
})

describe('bestPlan', () => {
  it('stays within the budget', () => {
    for (const budget of [1, 5, 14, 20]) {
      const p = bestPlan(y27, budget)
      expect(p.usedHalves).toBeLessThanOrEqual(budget * 2)
      expect(p.totalDays).toBeGreaterThan(budget)
    }
  })

  it('never overlaps or touches two breaks', () => {
    const p = bestPlan(y27, 20)
    for (let k = 1; k < p.windows.length; k++) expect(p.windows[k].start).toBeGreaterThanOrEqual(p.windows[k - 1].end + 2)
  })

  it('finds the 9-day Kurban Bayramı 2026 break for 1.5 days', () => {
    const p = bestPlan(y26, 1.5, { minLen: 9 })
    expect(p.windows.map((w) => label(y26, w.start, w.end))).toEqual(['2026-05-23..2026-05-31'])
    expect(p.usedHalves).toBe(3)
  })

  it('respects the minimum break length', () => {
    const p = bestPlan(y27, 14, { minLen: 9 })
    for (const w of p.windows) expect(w.length).toBeGreaterThanOrEqual(9)
  })

  it('ignores days before `from`', () => {
    const from = y26.findIndex((d) => d.date === '2026-10-28') + 1
    const p = bestPlan(y26, 5, { from })
    for (const w of p.windows) expect(w.start).toBeGreaterThanOrEqual(from)
  })

  it('matches brute force on a small range', () => {
    // March 2027 (Ramazan Bayramı) with up to 3 days of leave
    const from = y27.findIndex((d) => d.date === '2027-03-02')
    const to = y27.findIndex((d) => d.date === '2027-03-19')
    const slice = y27.slice(0, to + 1)
    for (const budget of [0.5, 1, 2, 3]) {
      const p = bestPlan(slice, budget, { from })
      expect(p.totalDays).toBe(bruteBest(y27, from, to, budget * 2))
    }
  })
})

describe('opportunities / topPicks', () => {
  it('suggests 1.5 days of leave for 9 days off at Ramazan Bayramı 2027', () => {
    const top = topPicks(opportunities(y27))
    const r = top.find((o) => o.holidays.some((h) => h.name.startsWith('Ramazan')))!
    expect(label(y27, r.start, r.end)).toBe('2027-03-06..2027-03-14')
    expect(r.halves).toBe(3)
    expect(r.length).toBe(9)
  })

  it('does not return overlapping picks', () => {
    const top = topPicks(opportunities(y26), 10)
    for (const a of top) for (const b of top) if (a !== b) expect(a.start > b.end || a.end < b.start).toBe(true)
  })

  it('gives each step more days for more leave', () => {
    const opps = opportunities(y26).filter((o) => o.group === 0)
    for (let k = 1; k < opps.length; k++) {
      expect(opps[k].halves).toBeGreaterThan(opps[k - 1].halves)
      expect(opps[k].length).toBeGreaterThan(opps[k - 1].length)
    }
  })
})
