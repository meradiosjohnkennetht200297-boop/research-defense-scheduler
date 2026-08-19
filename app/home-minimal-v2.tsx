import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import styles from './home-calendar.module.css'

type DefenseType = 'title' | 'proposal' | 'final'
type FacultyName = { full_name: string }
type PanelAssignment = { panel_role: 'chair' | 'member'; sort_order: number; faculty: FacultyName | FacultyName[] | null }
type ResearchDefense = { defense_type: DefenseType | null; status: string; title_snapshot: string; program_snapshot: string | null; major_snapshot: string | null }
type ScheduleRow = { id: string; defense_date: string; start_time: string; end_time: string; venue: string; research_defenses: ResearchDefense | ResearchDefense[] | null; panel_assignments: PanelAssignment[] | null }
type CalendarRow = { defense_date: string }
type HomeParams = { month?: string }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function one<T>(value: T | T[] | null | undefined): T | null {
  return !value ? null : Array.isArray(value) ? value[0] ?? null : value
}

function manilaTodayKey() {
  const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Manila' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function currentManilaMonth() { return manilaTodayKey().slice(0, 7) }

function normalizeMonth(value: string | undefined) {
  if (!/^\d{4}-\d{2}$/.test(value ?? '')) return currentManilaMonth()
  const [, month] = String(value).split('-').map(Number)
  return month >= 1 && month <= 12 ? String(value) : currentManilaMonth()
}

function shiftMonth(monthKey: string, amount: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + amount, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function monthMeta(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const startWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const lastDate = `${monthKey}-${String(days).padStart(2, '0')}`
  return { days, startWeekday, firstDate: `${monthKey}-01`, lastDate }
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatTime(value: string) {
  const [h, m] = value.split(':')
  let hour = Number(h)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (!hour) hour = 12
  return `${hour}:${m ?? '00'} ${suffix}`
}

function defenseLabel(value: DefenseType | null) {
  return value === 'title' ? 'Title Defense' : value === 'proposal' ? 'Proposal Defense' : value === 'final' ? 'Final Defense' : 'Research Defense'
}

function programLabel(stage: ResearchDefense) {
  return stage.program_snapshot ? `${stage.program_snapshot}${stage.major_snapshot ? ` - ${stage.major_snapshot}` : ''}` : 'Program not recorded'
}

export default async function MinimalHomeV2({ searchParams }: { searchParams: Promise<HomeParams> }) {
  const params = await searchParams
  const today = manilaTodayKey()
  const selectedMonth = normalizeMonth(params.month)
  const { days, startWeekday, firstDate, lastDate } = monthMeta(selectedMonth)
  const supabase = await createClient()

  const [todayResult, calendarResult] = await Promise.all([
    supabase
      .from('defense_schedules')
      .select(`id, defense_date, start_time, end_time, venue, research_defenses!inner (defense_type, status, title_snapshot, program_snapshot, major_snapshot), panel_assignments (panel_role, sort_order, faculty (full_name))`)
      .eq('is_published', true)
      .eq('defense_date', today)
      .eq('research_defenses.status', 'scheduled')
      .order('start_time', { ascending: true }),
    supabase
      .from('defense_schedules')
      .select('defense_date, research_defenses!inner(status)')
      .eq('is_published', true)
      .eq('research_defenses.status', 'scheduled')
      .gte('defense_date', firstDate)
      .lte('defense_date', lastDate)
      .order('defense_date', { ascending: true }),
  ])

  const schedules = (todayResult.data ?? []) as ScheduleRow[]
  const calendarRows = (calendarResult.data ?? []) as CalendarRow[]
  const scheduleCounts = new Map<string, number>()
  for (const row of calendarRows) scheduleCounts.set(row.defense_date, (scheduleCounts.get(row.defense_date) ?? 0) + 1)

  const cells: Array<{ day: number; dateKey: string } | null> = Array.from({ length: startWeekday }, () => null)
  for (let day = 1; day <= days; day += 1) cells.push({ day, dateKey: `${selectedMonth}-${String(day).padStart(2, '0')}` })
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <>
      <section className="minimal-home-hero">
        <div className="container minimal-home-inner">
          <h1>Submit your research. Track your defense.</h1>
          <div className="minimal-home-actions">
            <Link className="button" href="/submit">Submit Research</Link>
            <Link className="button button-secondary" href="/status">Check Status</Link>
          </div>
        </div>
      </section>

      <section className={styles.calendarSection}>
        <div className={`container ${styles.calendarWrap}`}>
          <div className={styles.calendarHeading}><div><p className="eyebrow">Defense Calendar</p><h2>Scheduled defenses</h2><p>Select a marked date to view the published defenses scheduled that day.</p></div></div>
          <div className={`card ${styles.calendarCard}`}>
            <div className={styles.monthNav}>
              <Link className={styles.monthButton} href={`/?month=${shiftMonth(selectedMonth, -1)}`} aria-label="Previous month">←</Link>
              <strong>{monthLabel(selectedMonth)}</strong>
              <Link className={styles.monthButton} href={`/?month=${shiftMonth(selectedMonth, 1)}`} aria-label="Next month">→</Link>
            </div>
            <div className={styles.weekdays} aria-hidden="true">{WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
            <div className={styles.calendarGrid}>
              {cells.map((cell, index) => {
                if (!cell) return <span className={styles.emptyCell} key={`empty-${index}`} />
                const count = scheduleCounts.get(cell.dateKey) ?? 0
                const isToday = cell.dateKey === today
                if (count > 0) return <Link className={`${styles.day} ${styles.activeDay}${isToday ? ` ${styles.today}` : ''}`} href={`/schedule?date=${cell.dateKey}`} key={cell.dateKey} title={`${count} published ${count === 1 ? 'defense' : 'defenses'}`} aria-label={`${formatDate(cell.dateKey)}, ${count} published ${count === 1 ? 'defense' : 'defenses'}`}><span>{cell.day}</span><i aria-hidden="true" /></Link>
                return <span className={`${styles.day} ${styles.inactiveDay}${isToday ? ` ${styles.today}` : ''}`} key={cell.dateKey}><span>{cell.day}</span></span>
              })}
            </div>
            <div className={styles.calendarNote}><span className={styles.legendDot} aria-hidden="true" /><span>Marked dates have published defenses.</span></div>
          </div>
        </div>
      </section>

      <section className="section minimal-today-section">
        <div className="container">
          <div className="minimal-section-heading"><div><p className="eyebrow">Defense Today</p><h2>{formatDate(today)}</h2></div>{!todayResult.error ? <span>{schedules.length} {schedules.length === 1 ? 'defense' : 'defenses'}</span> : null}</div>
          {todayResult.error ? (
            <div className="minimal-empty"><h3>Today&apos;s defenses are temporarily unavailable.</h3><p>Please try again later.</p></div>
          ) : schedules.length === 0 ? (
            <div className="minimal-empty"><h3>No defenses scheduled today.</h3><p>Use the calendar above to select another marked date, or check your Research Code for your group&apos;s status.</p></div>
          ) : (
            <div className="minimal-today-list">
              {schedules.map((schedule) => {
                const stage = one(schedule.research_defenses)
                if (!stage) return null
                const panel = [...(schedule.panel_assignments ?? [])].sort((a, b) => a.sort_order - b.sort_order)
                const chair = panel.find((item) => item.panel_role === 'chair')
                const chairName = one(chair?.faculty)?.full_name ?? null
                const members = panel.filter((item) => item.panel_role === 'member').map((item) => one(item.faculty)?.full_name).filter((name): name is string => Boolean(name))
                return <article className="minimal-defense-card" key={schedule.id}><div className="minimal-defense-time"><strong>{formatTime(schedule.start_time)}</strong><span>– {formatTime(schedule.end_time)}</span></div><div className="minimal-defense-content"><div className="minimal-defense-labels"><span className={`public-defense-badge type-${stage.defense_type ?? 'general'}`}>{defenseLabel(stage.defense_type)}</span><span className="public-program-badge">{programLabel(stage)}</span></div><h3>{stage.title_snapshot}</h3><p className="minimal-venue">{schedule.venue}</p></div><div className="minimal-panel"><div><span>Panel Chair</span><strong>{chairName ?? 'Not listed'}</strong></div><div><span>Panel Members</span><p>{members.length ? members.join(', ') : 'Not listed'}</p></div></div></article>
              })}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
