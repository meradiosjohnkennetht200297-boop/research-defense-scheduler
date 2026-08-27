import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import styles from './home-calendar.module.css'

type DefenseType = 'title' | 'proposal' | 'final'
type ResearchDefense = {
  defense_type: DefenseType | null
  status: string
  title_snapshot: string
  program_snapshot: string | null
  major_snapshot: string | null
}
type ScheduleRow = {
  id: string
  defense_date: string
  start_time: string
  end_time: string
  venue: string | null
  research_defenses: ResearchDefense | ResearchDefense[] | null
}
type CalendarStage = { status: string }
type CalendarRow = { defense_date: string; research_defenses: CalendarStage | CalendarStage[] | null }
type HomeParams = { month?: string }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function one<T>(value: T | T[] | null | undefined): T | null {
  return !value ? null : Array.isArray(value) ? value[0] ?? null : value
}

function manilaTodayKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Manila',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function currentManilaMonth() {
  return manilaTodayKey().slice(0, 7)
}

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
  return {
    days,
    startWeekday,
    firstDate: `${monthKey}-01`,
    lastDate: `${monthKey}-${String(days).padStart(2, '0')}`,
  }
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatCompactDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
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

  const [nextResult, calendarResult] = await Promise.all([
    supabase
      .from('defense_schedules')
      .select(`id, defense_date, start_time, end_time, venue, research_defenses!inner (defense_type, status, title_snapshot, program_snapshot, major_snapshot)`)
      .eq('is_published', true)
      .eq('research_defenses.status', 'scheduled')
      .gte('defense_date', today)
      .order('defense_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(1),
    supabase
      .from('defense_schedules')
      .select('defense_date, research_defenses!inner(status)')
      .eq('is_published', true)
      .in('research_defenses.status', ['scheduled', 'completed'])
      .gte('defense_date', firstDate)
      .lte('defense_date', lastDate)
      .order('defense_date', { ascending: true }),
  ])

  const nextSchedule = ((nextResult.data ?? []) as ScheduleRow[])[0] ?? null
  const nextStage = one(nextSchedule?.research_defenses)
  const calendarRows = (calendarResult.data ?? []) as CalendarRow[]
  const calendarDates = new Map<string, { count: number; hasScheduled: boolean; hasCompleted: boolean }>()

  for (const row of calendarRows) {
    const stage = one(row.research_defenses)
    if (!stage) continue
    const current = calendarDates.get(row.defense_date) ?? { count: 0, hasScheduled: false, hasCompleted: false }
    current.count += 1
    current.hasScheduled ||= stage.status === 'scheduled'
    current.hasCompleted ||= stage.status === 'completed'
    calendarDates.set(row.defense_date, current)
  }

  const cells: Array<{ day: number; dateKey: string } | null> = Array.from({ length: startWeekday }, () => null)
  for (let day = 1; day <= days; day += 1) {
    cells.push({ day, dateKey: `${selectedMonth}-${String(day).padStart(2, '0')}` })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <section className={styles.homeDashboard}>
      <div className={`container ${styles.dashboardGrid}`}>
        <div className={styles.homeIntro}>
          <p className={styles.homeLead}>Submit your research and view the defense schedule.</p>

          <div className={styles.nextDefenseBlock}>
            <div className={styles.nextDefenseHeading}>
              <span>Next Defense</span>
              <Link href="/schedule">View all →</Link>
            </div>

            {nextResult.error ? (
              <div className={styles.nextDefenseEmpty}>Upcoming defense information is temporarily unavailable.</div>
            ) : nextSchedule && nextStage ? (
              <Link className={styles.nextDefenseCard} href={`/schedule?date=${nextSchedule.defense_date}`}>
                <div className={styles.nextDefenseWhen}>
                  <strong>{formatCompactDate(nextSchedule.defense_date)}</strong>
                  <span>{formatTime(nextSchedule.start_time)} – {formatTime(nextSchedule.end_time)}</span>
                </div>
                <div className={styles.nextDefenseLabels}>
                  <span className="public-defense-badge">{defenseLabel(nextStage.defense_type)}</span>
                  <span className="public-program-badge">{programLabel(nextStage)}</span>
                </div>
                <h2>{nextStage.title_snapshot}</h2>
                <p>{nextSchedule.venue?.trim() || 'Venue not specified'}</p>
              </Link>
            ) : (
              <div className={styles.nextDefenseEmpty}>
                <strong>No upcoming published defense.</strong>
                <span>Marked calendar dates may still contain completed defenses.</span>
              </div>
            )}
          </div>
        </div>

        <div className={`card ${styles.calendarPanel}`}>
          <div className={styles.calendarTopbar}>
            <div>
              <p className="eyebrow">Defense Calendar</p>
              <h2>{monthLabel(selectedMonth)}</h2>
            </div>
            <div className={styles.monthControls}>
              <Link className={styles.monthButton} href={`/?month=${shiftMonth(selectedMonth, -1)}`} aria-label="Previous month">←</Link>
              <Link className={styles.monthButton} href={`/?month=${shiftMonth(selectedMonth, 1)}`} aria-label="Next month">→</Link>
            </div>
          </div>

          <div className={styles.weekdays} aria-hidden="true">
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>

          <div className={styles.calendarGrid}>
            {cells.map((cell, index) => {
              if (!cell) return <span className={styles.emptyCell} key={`empty-${index}`} />
              const entry = calendarDates.get(cell.dateKey)
              const isToday = cell.dateKey === today

              if (entry) {
                const completedOnly = entry.hasCompleted && !entry.hasScheduled
                const stateText = completedOnly ? 'completed' : entry.hasCompleted ? 'scheduled and completed' : 'scheduled'
                return (
                  <Link
                    className={`${styles.day} ${styles.activeDay}${completedOnly ? ` ${styles.completedDay}` : ''}${isToday ? ` ${styles.today}` : ''}`}
                    href={`/schedule?date=${cell.dateKey}`}
                    key={cell.dateKey}
                    title={`${entry.count} published ${stateText} ${entry.count === 1 ? 'defense' : 'defenses'}`}
                    aria-label={`${formatDate(cell.dateKey)}, ${entry.count} published ${stateText} ${entry.count === 1 ? 'defense' : 'defenses'}`}
                  >
                    <span>{cell.day}</span>
                    {completedOnly ? <b className={styles.completedMark} aria-hidden="true">✓</b> : <i className={styles.scheduledMark} aria-hidden="true" />}
                  </Link>
                )
              }

              return <span className={`${styles.day} ${styles.inactiveDay}${isToday ? ` ${styles.today}` : ''}`} key={cell.dateKey}><span>{cell.day}</span></span>
            })}
          </div>

          <div className={styles.calendarFooter}>
            <div className={styles.calendarNote}>
              <span className={styles.legendItem}><i className={styles.legendDot} aria-hidden="true" />Scheduled</span>
              <span className={styles.legendItem}><b className={styles.legendCheck} aria-hidden="true">✓</b>Completed</span>
            </div>
            <span>Click a marked date to view details.</span>
          </div>
        </div>
      </div>
    </section>
  )
}
