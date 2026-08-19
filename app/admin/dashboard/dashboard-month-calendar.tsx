import Link from 'next/link'

type DefenseStatus = 'pending' | 'scheduled' | 'completed' | string
type DefenseRef = { status: DefenseStatus } | Array<{ status: DefenseStatus }> | null
type CalendarRow = { defense_date: string; end_time: string; research_defenses: DefenseRef }

type DayCounts = {
  scheduled: number
  completed: number
  action: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function one<T>(value: T | T[] | null | undefined): T | null {
  return !value ? null : Array.isArray(value) ? value[0] ?? null : value
}

function stamp(date: string, time: string) {
  return new Date(`${date}T${String(time).slice(0, 8)}+08:00`).getTime()
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))
}

function dayLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function describeCounts(counts: DayCounts) {
  const parts: string[] = []
  if (counts.scheduled) parts.push(`${counts.scheduled} scheduled`)
  if (counts.completed) parts.push(`${counts.completed} completed`)
  if (counts.action) parts.push(`${counts.action} action required`)
  return parts.join(', ')
}

export default function MonthCalendar({ month, rows, today, now, pending }: {
  month: string
  rows: CalendarRow[]
  today: string
  now: number
  pending: number
}) {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const counts = new Map<string, DayCounts>()

  for (const row of rows) {
    if (!row.defense_date.startsWith(`${month}-`)) continue
    const defense = one(row.research_defenses)
    if (!defense) continue
    const current = counts.get(row.defense_date) ?? { scheduled: 0, completed: 0, action: 0 }
    if (defense.status === 'completed') current.completed += 1
    else if (defense.status === 'scheduled' && stamp(row.defense_date, row.end_time) <= now) current.action += 1
    else if (defense.status === 'scheduled') current.scheduled += 1
    else continue
    counts.set(row.defense_date, current)
  }

  const monthTotals = [...counts.values()].reduce((total, item) => ({
    scheduled: total.scheduled + item.scheduled,
    completed: total.completed + item.completed,
    action: total.action + item.action,
  }), { scheduled: 0, completed: 0, action: 0 })
  const total = monthTotals.scheduled + monthTotals.completed + monthTotals.action
  const previousMonth = shiftMonth(month, -1)
  const nextMonth = shiftMonth(month, 1)
  const cells = []

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(<div aria-hidden="true" className="dashboard-calendar-empty" key={`empty-start-${index}`} role="gridcell" />)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${month}-${String(day).padStart(2, '0')}`
    const dayCounts = counts.get(dateKey) ?? { scheduled: 0, completed: 0, action: 0 }
    const count = dayCounts.scheduled + dayCounts.completed + dayCounts.action
    const isToday = dateKey === today
    const className = `dashboard-calendar-day${count ? ' has-defense' : ''}${dayCounts.action ? ' has-action' : ''}${dayCounts.completed && !dayCounts.scheduled && !dayCounts.action ? ' completed-only' : ''}${isToday ? ' is-today' : ''}`
    const description = describeCounts(dayCounts)
    const content = (
      <>
        <span className="dashboard-calendar-date">{day}</span>
        {count ? (
          <span className="dashboard-calendar-statuses" aria-hidden="true">
            {dayCounts.scheduled ? <span className="calendar-state scheduled"><i />{dayCounts.scheduled}</span> : null}
            {dayCounts.completed ? <span className="calendar-state completed">✓{dayCounts.completed}</span> : null}
            {dayCounts.action ? <span className="calendar-state action">!{dayCounts.action}</span> : null}
          </span>
        ) : null}
      </>
    )

    cells.push(count ? (
      <Link
        aria-label={`${dayLabel(dateKey)}, ${description}`}
        className={className}
        href={`/admin/schedule?date=${dateKey}`}
        key={dateKey}
        role="gridcell"
      >
        {content}
      </Link>
    ) : (
      <div aria-label={dayLabel(dateKey)} className={className} key={dateKey} role="gridcell">{content}</div>
    ))
  }

  const trailing = (7 - ((firstWeekday + daysInMonth) % 7)) % 7
  for (let index = 0; index < trailing; index += 1) {
    cells.push(<div aria-hidden="true" className="dashboard-calendar-empty" key={`empty-end-${index}`} role="gridcell" />)
  }

  return (
    <section aria-labelledby="dashboard-calendar-title" className="card dashboard-calendar">
      <div className="dashboard-calendar-header">
        <div>
          <p className="eyebrow">Defense Calendar</p>
          <h3 id="dashboard-calendar-title">{monthLabel(month)}</h3>
          <p>{total} dated {total === 1 ? 'defense' : 'defenses'} this month · {pending} pending unscheduled.</p>
        </div>
        <nav aria-label="Calendar month navigation" className="dashboard-calendar-controls">
          <Link aria-label="Previous month" href={`/admin/dashboard?month=${previousMonth}`}>‹</Link>
          <Link href="/admin/dashboard">Today</Link>
          <Link aria-label="Next month" href={`/admin/dashboard?month=${nextMonth}`}>›</Link>
        </nav>
      </div>

      <div className="dashboard-calendar-legend" aria-label="Calendar status legend">
        <span><i className="legend-dot" />Scheduled <b>{monthTotals.scheduled}</b></span>
        <span><i className="legend-check">✓</i>Completed <b>{monthTotals.completed}</b></span>
        <span><i className="legend-action">!</i>Action Required <b>{monthTotals.action}</b></span>
      </div>

      <div className="dashboard-calendar-weekdays" role="row">
        {WEEKDAYS.map((weekday) => <span key={weekday} role="columnheader">{weekday}</span>)}
      </div>
      <div aria-label={`${monthLabel(month)} defense calendar`} className="dashboard-calendar-grid" role="grid">
        {cells}
      </div>
    </section>
  )
}
