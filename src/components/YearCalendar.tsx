import { memo } from 'react'
import type { Day } from '../lib/calendar'
import { DOW_SHORT, MONTHS, num } from '../lib/format'

interface Props {
  days: Day[]
  leave: Set<number>
  /** Day index -> length of the break it belongs to (only breaks with leave) */
  blockOf: Map<number, number>
  from: number
  today: number
  onToggle: (i: number) => void
}

function YearCalendar({ days, leave, blockOf, from, today, onToggle }: Props) {
  const months = Array.from({ length: 12 }, (_, m) => days.filter((d) => d.month === m))
  return (
    <div className="year">
      {months.map((md, m) => {
        const pad = md[0].dow
        const used = md.reduce((s, d) => s + (leave.has(d.i) ? d.cost : 0), 0)
        return (
          <section key={m} className="month" aria-label={MONTHS[m]}>
            <h3>
              {MONTHS[m]}
              {used > 0 && <span className="month-used">{num(used)} gün izin</span>}
            </h3>
            <div className="grid">
              {DOW_SHORT.map((d) => (
                <span key={d} className="dow">
                  {d}
                </span>
              ))}
              {Array.from({ length: pad }, (_, k) => (
                <span key={'p' + k} />
              ))}
              {md.map((d) => {
                const isLeave = leave.has(d.i)
                const inBlock = blockOf.has(d.i)
                const past = d.i < from
                const clickable = d.cost > 0 && !past
                const cls = [
                  'day',
                  d.kind,
                  isLeave && 'leave',
                  inBlock && 'inblock',
                  past && 'past',
                  d.i === today && 'today',
                ]
                  .filter(Boolean)
                  .join(' ')
                const title = [
                  `${d.dom} ${MONTHS[d.month]}`,
                  d.holiday?.name,
                  d.kind === 'half' && 'yarım gün (13:00’e kadar mesai)',
                  isLeave && 'izinli',
                  inBlock && `${blockOf.get(d.i)} günlük tatilin parçası`,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return clickable ? (
                  <button key={d.i} className={cls} title={title} aria-pressed={isLeave} aria-label={title} onClick={() => onToggle(d.i)}>
                    {d.dom}
                  </button>
                ) : (
                  <span key={d.i} className={cls} title={title}>
                    {d.dom}
                  </span>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default memo(YearCalendar)
