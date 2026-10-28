// Official public holidays of Türkiye (Law No. 2429).
// Religious holidays follow the Diyanet calendar. Arife (eve) days and
// 28 October are half days: offices close at 13:00.

export interface Holiday {
  /** ISO date, YYYY-MM-DD */
  date: string
  name: string
  half?: boolean
  religious?: boolean
}

interface Religious {
  ramazan: string // first day of Ramazan Bayramı (3 days)
  kurban: string // first day of Kurban Bayramı (4 days)
  /** Dates not yet confirmed by Diyanet */
  tentative?: boolean
}

export const RELIGIOUS: Record<number, Religious> = {
  2025: { ramazan: '2025-03-30', kurban: '2025-06-06' },
  2026: { ramazan: '2026-03-20', kurban: '2026-05-27' },
  2027: { ramazan: '2027-03-09', kurban: '2027-05-16' },
  2028: { ramazan: '2028-02-27', kurban: '2028-05-05', tentative: true },
}

export const YEARS = Object.keys(RELIGIOUS).map(Number)

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}

export function holidaysOf(year: number): Holiday[] {
  const r = RELIGIOUS[year]
  const list: Holiday[] = [
    { date: `${year}-01-01`, name: 'Yılbaşı' },
    { date: `${year}-04-23`, name: 'Ulusal Egemenlik ve Çocuk Bayramı' },
    { date: `${year}-05-01`, name: 'Emek ve Dayanışma Günü' },
    { date: `${year}-05-19`, name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı" },
    { date: `${year}-07-15`, name: 'Demokrasi ve Millî Birlik Günü' },
    { date: `${year}-08-30`, name: 'Zafer Bayramı' },
    { date: `${year}-10-28`, name: 'Cumhuriyet Bayramı arifesi', half: true },
    { date: `${year}-10-29`, name: 'Cumhuriyet Bayramı' },
  ]
  if (r) {
    list.push({ date: addDays(r.ramazan, -1), name: 'Ramazan Bayramı arifesi', half: true, religious: true })
    for (let i = 0; i < 3; i++) list.push({ date: addDays(r.ramazan, i), name: `Ramazan Bayramı ${i + 1}. gün`, religious: true })
    list.push({ date: addDays(r.kurban, -1), name: 'Kurban Bayramı arifesi', half: true, religious: true })
    for (let i = 0; i < 4; i++) list.push({ date: addDays(r.kurban, i), name: `Kurban Bayramı ${i + 1}. gün`, religious: true })
  }
  // A full holiday wins over a half day on the same date (e.g. arife on 19 May).
  const byDate = new Map<string, Holiday>()
  for (const h of list) {
    if (!h.date.startsWith(String(year))) continue
    const prev = byDate.get(h.date)
    if (!prev) byDate.set(h.date, h)
    else if (prev.half && !h.half) byDate.set(h.date, { ...h, name: `${h.name} · ${prev.name}` })
    else byDate.set(h.date, { ...prev, name: `${prev.name} · ${h.name}` })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}
