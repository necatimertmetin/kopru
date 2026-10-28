import type { Day } from './calendar'
import type { Holiday } from './holidays'

/**
 * A candidate vacation: days [start, end] all off, with leave taken on every
 * working day inside. The days just outside are working days you do not take,
 * so the window is exactly one block of time off.
 */
export interface Window {
  start: number
  end: number
  length: number
  /** Leave in half days (2 = one full day) */
  halves: number
}

const MAX_LEN = 30

export function candidates(days: Day[], from: number, maxHalves: number, minLen = 1): Window[] {
  const out: Window[] = []
  const n = days.length
  const working = (i: number) => i < from || i >= n || days[i].cost > 0
  for (let s = from; s < n; s++) {
    // the day before must not be free, or the block would really start earlier
    if (s > from && days[s - 1].cost === 0) continue
    let halves = 0
    for (let e = s; e < n && e - s < MAX_LEN; e++) {
      halves += days[e].cost * 2
      if (halves > maxHalves) break
      const len = e - s + 1
      if (halves === 0 || len < minLen) continue
      if (e + 1 < n && !working(e + 1)) continue
      out.push({ start: s, end: e, length: len, halves })
    }
  }
  return out
}

export interface Plan {
  windows: Window[]
  totalDays: number
  usedHalves: number
}

/**
 * Picks non-overlapping windows that give the most days off for the leave
 * budget (weighted interval scheduling with a knapsack on leave). A tiny
 * per-window penalty prefers fewer, longer breaks among equal totals.
 */
export function bestPlan(days: Day[], budgetDays: number, opts: { from?: number; minLen?: number } = {}): Plan {
  const from = opts.from ?? 0
  const B = Math.round(budgetDays * 2)
  if (B <= 0) return { windows: [], totalDays: 0, usedHalves: 0 }
  const cands = candidates(days, from, B, opts.minLen ?? 1).sort((a, b) => a.end - b.end || a.start - b.start)
  const K = cands.length
  const ends = cands.map((c) => c.end)
  // p[k]: number of windows that end at least two days before window k starts
  const p = cands.map((c) => {
    let lo = 0
    let hi = K
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (ends[mid] <= c.start - 2) lo = mid + 1
      else hi = mid
    }
    return lo
  })
  const W = B + 1
  const dp = new Float64Array((K + 1) * W)
  for (let k = 0; k < K; k++) {
    const c = cands[k]
    const v = c.length - 0.01
    const row = (k + 1) * W
    const prev = k * W
    const base = p[k] * W
    for (let b = 0; b <= B; b++) {
      let best = dp[prev + b]
      if (c.halves <= b) {
        const take = dp[base + b - c.halves] + v
        if (take > best + 1e-9) best = take
      }
      dp[row + b] = best
    }
  }
  // reconstruct
  const chosen: Window[] = []
  let k = K
  let b = B
  while (k > 0) {
    const c = cands[k - 1]
    if (Math.abs(dp[k * W + b] - dp[(k - 1) * W + b]) < 1e-9) {
      k--
      continue
    }
    chosen.push(c)
    b -= c.halves
    k = p[k - 1]
  }
  chosen.reverse()
  return {
    windows: chosen,
    totalDays: chosen.reduce((s, w) => s + w.length, 0),
    usedHalves: chosen.reduce((s, w) => s + w.halves, 0),
  }
}

export interface Opportunity {
  /** Index of the holiday period it extends */
  group: number
  start: number
  end: number
  length: number
  halves: number
  holidays: Holiday[]
  /** Days off per leave day */
  ratio: number
}

/**
 * For each holiday period, the best ways to stretch it: for every amount of
 * leave up to `maxDays`, the longest break that contains the holiday.
 * Only options that beat a smaller amount of leave are kept.
 */
export function opportunities(days: Day[], from = 0, maxDays = 5): Opportunity[] {
  const groups: { start: number; end: number }[] = []
  for (const d of days) {
    if (!d.holiday || d.i < from) continue
    const last = groups[groups.length - 1]
    if (last && d.i - last.end <= 1) last.end = d.i
    else groups.push({ start: d.i, end: d.i })
  }
  const all = candidates(days, from, maxDays * 2)
  const out: Opportunity[] = []
  groups.forEach((g, gi) => {
    const around = all.filter((w) => w.start <= g.start && w.end >= g.end)
    // natural length of the break with no leave (half days count as work)
    let s = g.start
    let e = g.end
    while (s > from && days[s - 1].cost === 0) s--
    while (e + 1 < days.length && days[e + 1].cost === 0) e++
    let bestLen = days.slice(s, e + 1).every((d) => d.cost === 0) ? e - s + 1 : 0
    const byHalves = new Map<number, Window>()
    for (const w of around) {
      const cur = byHalves.get(w.halves)
      if (!cur || w.length > cur.length) byHalves.set(w.halves, w)
    }
    for (const h of [...byHalves.keys()].sort((a, b) => a - b)) {
      const w = byHalves.get(h)!
      if (w.length <= bestLen) continue
      bestLen = w.length
      out.push({
        group: gi,
        start: w.start,
        end: w.end,
        length: w.length,
        halves: w.halves,
        holidays: days.slice(w.start, w.end + 1).flatMap((d) => (d.holiday ? [d.holiday] : [])),
        ratio: w.length / (w.halves / 2),
      })
    }
  })
  return out
}

/** How good a way to stretch a holiday is: days off, minus a price for each leave day. */
export function pickScore(o: Pick<Opportunity, 'length' | 'halves'>): number {
  return o.length - 0.75 * o.halves
}

/**
 * The best few opportunities of the year, one per holiday period, preferring
 * long breaks that still give at least 2.5 days off per leave day.
 */
export function topPicks(opps: Opportunity[], n = 6): Opportunity[] {
  const best = new Map<number, Opportunity>()
  for (const o of opps) {
    if (o.ratio < 2.5) continue
    const cur = best.get(o.group)
    if (!cur || pickScore(o) > pickScore(cur)) best.set(o.group, o)
  }
  const ranked = [...best.values()].sort((a, b) => pickScore(b) - pickScore(a) || a.start - b.start)
  // two holiday periods can share one break (e.g. 19 May next to a bayram): keep the better one
  const out: Opportunity[] = []
  for (const o of ranked) if (!out.some((x) => o.start <= x.end && o.end >= x.start)) out.push(o)
  return out.slice(0, n)
}
