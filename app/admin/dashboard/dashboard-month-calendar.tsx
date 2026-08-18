import Link from 'next/link'

type CalendarRow = { defense_date: string }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

export default function MonthCalendar({ month, rows, today }: {
  month: string
  rows: CalendarRow[]
  today: string
}) {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const counts = new Map<string, number>()

  for (const row of rows) {
    if (!row.defense_date.startsWith(`${month}-`)) continue
    counts.set(row.defense_date, (counts.get(row.defense_date) ?? 0) + 1)
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
  const previousMonth = shiftMonth(month, -1)
  const nextMonth = shiftMonth(month, 1)
  const cells = []

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(<div aria-hidden="true" className="dashboard-calendar-empty" key={`empty-start-${index}`} role="gridcell" />)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${month}-${String(day).padStart(2, '0')}`
    const count = counts.get(dateKey) ?? 0
    const isToday = dateKey === today
    const className = `dashboard-calendar-day${count ? ' has-defense' : ''}${isToday ? ' is-today' : ''}`
    const content = (
      <>
        <span className="dashboard-calendar-date">{day}</span>
        {count ? (
          <span className="dashboard-calendar-count">
            <strong>{count}</strong>
            <span className="dashboard-calendar-count-label"> {count === 1 ? 'defense' : 'defenses'}</span>
          </span>
        ) : null}
      </>
    )

    cells.push(count ? (
      <Link
        aria-label={`${dayLabel(dateKey)}, ${count} scheduled ${count === 1 ? 'defense' : 'defenses'}`}
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
          <p className="eyebrow">Monthly Schedule</p>
          <h3 id="dashboard-calendar-title">{monthLabel(month)}</h3>
          <p>{total} scheduled {total === 1 ? 'defense' : 'defenses'} this month.</p>
        </div>
        <nav aria-label="Calendar month navigation" className="dashboard-calendar-controls">
          <Link aria-label="Previous month" href={`/admin/dashboard?month=${previousMonth}`}>‹</Link>
          <Link href="/admin/dashboard">Today</Link>
          <Link aria-label="Next month" href={`/admin/dashboard?month=${nextMonth}`}>›</Link>
        </nav>
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
