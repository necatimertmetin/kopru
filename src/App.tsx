import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import YearCalendar from './components/YearCalendar'
import { blocksOf, buildYear, type Day } from './lib/calendar'
import { holidaysOf, RELIGIOUS, YEARS } from './lib/holidays'
import { bestPlan, opportunities, topPicks, type Opportunity } from './lib/optimize'
import { DOW, daysUntil, dayLabel, num, rangeLabel, todayTR, whenLabel } from './lib/format'
import { decodePlan, encodePlan, toIcs } from './lib/share'
import { useStored } from './hooks/useStored'

type Strategy = 'long' | 'balanced' | 'max'
const STRATEGIES: { id: Strategy; label: string; hint: string; minLen: number }[] = [
  { id: 'long', label: 'Uzun tatiller', hint: 'En az 9 günlük aralar', minLen: 9 },
  { id: 'balanced', label: 'Dengeli', hint: 'En az 5 günlük aralar', minLen: 5 },
  { id: 'max', label: 'En çok gün', hint: 'Uzun hafta sonları dahil', minLen: 3 },
]

const TODAY = todayTR()
const THIS_YEAR = Number(TODAY.slice(0, 4))

function defaultYear(): number {
  const left = daysUntil(TODAY, `${THIS_YEAR}-12-31`)
  const y = left < 75 ? THIS_YEAR + 1 : THIS_YEAR
  return YEARS.includes(y) ? y : YEARS[YEARS.length - 1]
}

const shared = decodePlan(location.hash)
const NO_LEAVE: number[] = []

function leaveFromWindows(days: Day[], windows: { start: number; end: number }[]): number[] {
  const out: number[] = []
  for (const w of windows) for (let i = w.start; i <= w.end; i++) if (days[i].cost > 0) out.push(i)
  return out
}

export default function App() {
  const [year, setYear] = useState<number>(() => (shared && YEARS.includes(shared.year) ? shared.year : defaultYear()))
  const [budget, setBudget] = useStored('kopru.budget', 14)
  const [strategy, setStrategy] = useStored<Strategy>('kopru.strategy', 'balanced')
  const [saturdayWork, setSaturdayWork] = useStored('kopru.saturday', false)
  const [noHalfLeave, setNoHalfLeave] = useStored('kopru.noHalf', false)
  const [plans, setPlans] = useStored<Record<string, number[]>>('kopru.plans', {})
  const [fromShared, setFromShared] = useState(!!shared)
  const [flash, setFlash] = useState<string | null>(null)

  const days = useMemo(() => buildYear(year, { saturdayWork, noHalfLeave }), [year, saturdayWork, noHalfLeave])
  const todayIdx = year === THIS_YEAR ? days.findIndex((d) => d.date === TODAY) : -1
  const from = year === THIS_YEAR ? todayIdx + 1 : year < THIS_YEAR ? days.length : 0
  const minLen = STRATEGIES.find((s) => s.id === strategy)!.minLen

  const optimize = useCallback(
    () => leaveFromWindows(days, bestPlan(days, budget, { from, minLen }).windows),
    [days, budget, from, minLen],
  )

  const viewingShared = fromShared && shared?.year === year

  // No saved plan for the year yet: start with the best one.
  useEffect(() => {
    if (!plans[year] && !viewingShared) setPlans((p) => ({ ...p, [year]: optimize() }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  // Changing the budget or the rules re-plans the year.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    setFromShared(false)
    setPlans((p) => ({ ...p, [year]: optimize() }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget, strategy, saturdayWork, noHalfLeave])

  const leaveList = viewingShared ? shared!.leave : (plans[year] ?? NO_LEAVE)
  const leave = useMemo(() => new Set(leaveList.filter((i) => days[i] && days[i].cost > 0)), [leaveList, days])
  const setLeave = (list: number[]) => {
    setFromShared(false)
    setPlans((p) => ({ ...p, [year]: [...new Set(list)].sort((a, b) => a - b) }))
  }

  const blocks = useMemo(() => blocksOf(days, leave).filter((b) => b.leave.length > 0), [days, leave])
  const blockOf = useMemo(() => {
    const m = new Map<number, number>()
    for (const b of blocks) for (let i = b.start; i <= b.end; i++) m.set(i, b.length)
    return m
  }, [blocks])
  const used = blocks.reduce((s, b) => s + b.cost, 0)
  const offDays = blocks.reduce((s, b) => s + b.length, 0)
  const picks = useMemo(() => topPicks(opportunities(days, from), 6), [days, from])
  const holidays = useMemo(() => holidaysOf(year), [year])

  const next = useMemo(() => {
    const list = [...holidaysOf(THIS_YEAR), ...holidaysOf(THIS_YEAR + 1)]
    return list.find((h) => h.date >= TODAY)
  }, [])

  const notify = (m: string) => {
    setFlash(m)
    setTimeout(() => setFlash(null), 2200)
  }

  const toggle = useCallback(
    (i: number) => {
      const cur = new Set(leaveList)
      if (cur.has(i)) cur.delete(i)
      else cur.add(i)
      setFromShared(false)
      setPlans((p) => ({ ...p, [year]: [...cur].sort((a, b) => a - b) }))
    },
    [year, leaveList, setPlans],
  )

  const addPick = (o: Opportunity) => {
    setLeave([...leave, ...leaveFromWindows(days, [o])])
    notify(`${rangeLabel(days[o.start], days[o.end])} planına eklendi`)
  }

  const share = async () => {
    const url = `${location.origin}${location.pathname}#${encodePlan(year, leave)}`
    const text = `${year} için izin planım: ${num(used)} gün izinle ${offDays} gün tatil 🌴`
    if ('share' in navigator) {
      try {
        await navigator.share({ title: 'Köprü', text, url })
        return
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      notify('Bağlantı kopyalandı')
    } catch {
      prompt('Bağlantıyı kopyala:', url)
    }
  }

  const downloadIcs = () => {
    const blob = new Blob([toIcs(days, blocks)], { type: 'text/calendar;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `izin-plani-${year}.ics`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const over = used > budget
  const weekdayHolidays = holidays.filter((h) => {
    const d = days.find((x) => x.date === h.date)
    return d && d.dow < 5 && !h.half
  }).length

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="./" aria-label="Köprü ana sayfa">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <rect width="32" height="32" rx="8" className="brand-bg" />
            <path d="M5 21c4-8 18-8 22 0M5 21h22M10 21v-3.5M16 21v-5M22 21v-3.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <span>Köprü</span>
        </a>
        <nav className="years" aria-label="Yıl">
          {YEARS.filter((y) => y >= THIS_YEAR).map((y) => (
            <button key={y} className={'chip' + (y === year ? ' on' : '')} onClick={() => setYear(y)}>
              {y}
              {RELIGIOUS[y]?.tentative ? '*' : ''}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <section className="hero">
          <div>
            <h1>
              {year} izin planı: <span className="accent">{num(used)} gün izinle {offDays} gün tatil</span>
            </h1>
            <p className="lead">
              Resmî tatilleri hafta sonlarıyla birleştiren en verimli izin günlerini bulur. Takvimde bir güne dokunarak izin ekleyip
              çıkarabilirsin.
            </p>
            {next && (
              <p className="next">
                <b>Sıradaki tatil:</b> {next.name}, {whenLabel(daysUntil(TODAY, next.date))}
                {next.half ? ' (yarım gün)' : ''}
              </p>
            )}
          </div>
          <div className="controls card">
            <label className="budget">
              <span>Yıllık izin hakkın</span>
              <span className="stepper">
                <button onClick={() => setBudget(Math.max(1, budget - 1))} aria-label="Azalt">
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={budget}
                  onChange={(e) => setBudget(Math.min(40, Math.max(1, Number(e.target.value) || 1)))}
                  aria-label="İzin günü"
                />
                <button onClick={() => setBudget(Math.min(40, budget + 1))} aria-label="Artır">
                  +
                </button>
              </span>
            </label>
            <div className="strategies" role="radiogroup" aria-label="Strateji">
              {STRATEGIES.map((s) => (
                <button key={s.id} role="radio" aria-checked={s.id === strategy} className={'strategy' + (s.id === strategy ? ' on' : '')} onClick={() => setStrategy(s.id)}>
                  <b>{s.label}</b>
                  <small>{s.hint}</small>
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={saturdayWork} onChange={(e) => setSaturdayWork(e.target.checked)} />
              Cumartesi de çalışıyorum
            </label>
            <label className="check">
              <input type="checkbox" checked={noHalfLeave} onChange={(e) => setNoHalfLeave(e.target.checked)} />
              Yarım gün izin kullanamıyorum
            </label>
            <div className="row">
              <button
                className="btn primary"
                onClick={() => {
                  setLeave(optimize())
                  notify('Plan yeniden hesaplandı')
                }}
              >
                Bana en iyi planı yap
              </button>
              <button className="btn ghost" onClick={() => setLeave([])}>
                Temizle
              </button>
            </div>
          </div>
        </section>

        {viewingShared && (
          <div className="notice">
            Paylaşılan bir planı görüntülüyorsun. Değiştirdiğin anda kendi planın olur.
          </div>
        )}

        <section className="summary">
          <div className="tile">
            <span className="k">{num(used)}</span>
            <span className="l">
              gün izin {over ? <b className="bad">(hakkını {num(used - budget)} gün aşıyor)</b> : `· ${num(budget - used)} gün kaldı`}
            </span>
          </div>
          <div className="tile">
            <span className="k">{offDays}</span>
            <span className="l">gün kesintisiz tatil</span>
          </div>
          <div className="tile">
            <span className="k">{used ? num(offDays / used) : '—'}×</span>
            <span className="l">her izin günü başına tatil</span>
          </div>
          <div className="tile">
            <span className="k">{blocks.length}</span>
            <span className="l">ayrı tatil</span>
          </div>
        </section>

        <div className="cols">
          <div className="main-col">
            <YearCalendar days={days} leave={leave} blockOf={blockOf} from={from} today={todayIdx} onToggle={toggle} />
            <div className="legend">
              <span>
                <i className="lg holiday" /> Resmî tatil
              </span>
              <span>
                <i className="lg half" /> Yarım gün (arife)
              </span>
              <span>
                <i className="lg weekend" /> Hafta sonu
              </span>
              <span>
                <i className="lg leave" /> İzin günün
              </span>
              <span>
                <i className="lg inblock" /> Tatil aralığı
              </span>
            </div>
          </div>

          <aside className="side-col">
            <section className="card">
              <h2>Planın</h2>
              {blocks.length === 0 ? (
                <p className="muted">Henüz izin günü yok. "Bana en iyi planı yap"a bas ya da takvimden gün seç.</p>
              ) : (
                <ol className="blocks">
                  {blocks.map((b) => (
                    <li key={b.start}>
                      <div className="b-main">
                        <b>{rangeLabel(days[b.start], days[b.end])}</b>
                        <span className="muted small">
                          {b.holidays.length ? b.holidays[0].name.replace(/ \d\. gün$/, '').replace(/ arifesi$/, '') : 'Hafta sonu'} ·{' '}
                          {DOW[days[b.start].dow]}–{DOW[days[b.end].dow]}
                        </span>
                      </div>
                      <span className="b-stat">
                        <b>{b.length} gün</b>
                        <small>{num(b.cost)} izin</small>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="row wrap">
                <button className="btn" onClick={share} disabled={!blocks.length}>
                  Paylaş
                </button>
                <button className="btn" onClick={downloadIcs} disabled={!blocks.length}>
                  Takvime ekle (.ics)
                </button>
              </div>
            </section>

            <section className="card">
              <h2>{year} yılının en iyi köprüleri</h2>
              <ul className="picks">
                {picks.map((o) => {
                  const added = leaveFromWindows(days, [o]).every((i) => leave.has(i))
                  return (
                    <li key={o.start}>
                      <div>
                        <b>
                          {num(o.halves / 2)} gün izinle {o.length} gün tatil
                        </b>
                        <span className="muted small">
                          {rangeLabel(days[o.start], days[o.end])} · {o.holidays[0].name.replace(/ \d\. gün$/, '').replace(/ arifesi$/, '')}
                        </span>
                      </div>
                      <button className="btn small-btn" onClick={() => addPick(o)} disabled={added}>
                        {added ? 'Planda' : 'Ekle'}
                      </button>
                    </li>
                  )
                })}
                {!picks.length && <li className="muted">Bu yıl için kalan köprü fırsatı yok.</li>}
              </ul>
            </section>

            <section className="card">
              <h2>{year} yılı resmî tatilleri</h2>
              <p className="muted small">
                {weekdayHolidays} tam gün tatil hafta içine denk geliyor.
                {RELIGIOUS[year]?.tentative && ' * Dinî bayram tarihleri henüz Diyanet tarafından kesinleşmedi.'}
              </p>
              <table className="hol">
                <tbody>
                  {holidays.map((h) => {
                    const d = days.find((x) => x.date === h.date)!
                    return (
                      <tr key={h.date} className={h.half ? 'half-row' : ''}>
                        <td>{dayLabel(d)}</td>
                        <td className="muted">{DOW[d.dow]}</td>
                        <td>
                          {h.name}
                          {h.half && <small className="muted"> · yarım gün</small>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          </aside>
        </div>
      </main>

      <footer className="foot">
        <p>
          Resmî tatiller 2429 sayılı Kanun'a, dinî bayram tarihleri Diyanet takvimine göredir. Hükûmetin sonradan ilan ettiği idari
          izinler dahil değildir. Planın sadece bu cihazda saklanır.
        </p>
        <p>
          <a href="https://github.com/necatimertmetin/kopru" target="_blank" rel="noreferrer">
            Açık kaynak · GitHub
          </a>
        </p>
      </footer>
      {flash && <div className="toast">{flash}</div>}
    </div>
  )
}
