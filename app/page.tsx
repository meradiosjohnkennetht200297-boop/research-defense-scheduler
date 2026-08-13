import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type DefenseType = 'title' | 'proposal' | 'final'
type FacultyName = { full_name: string }
type PanelAssignment = {
  panel_role: 'chair' | 'member'
  sort_order: number
  faculty: FacultyName | FacultyName[] | null
}
type ResearchGroup = {
  public_code: string
  title: string
  program: string | null
  major: string | null
  defense_type: DefenseType | null
  status: string
}
type ScheduleRow = {
  id: string
  defense_date: string
  start_time: string
  end_time: string
  venue: string
  research_groups: ResearchGroup | ResearchGroup[] | null
  panel_assignments: PanelAssignment[] | null
}
type PublicSearchParams = {
  q?: string
  defense?: string
  program?: string
  date?: string
}

const DEFENSE_TYPES = new Set<DefenseType>(['title', 'proposal', 'final'])
const PROGRAMS = new Set(['BEED', 'BSED', 'BSA', 'BSAIS', 'BSBA'])

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatCompactDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatTime(value: string | null) {
  if (!value) return ''
  const [hourText, minuteText] = value.split(':')
  let hour = Number(hourText)
  const minute = minuteText ?? '00'
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (hour === 0) hour = 12
  return `${hour}:${minute} ${suffix}`
}

function defenseTypeLabel(value: ResearchGroup['defense_type']) {
  if (value === 'title') return 'Title Defense'
  if (value === 'proposal') return 'Proposal Defense'
  if (value === 'final') return 'Final Defense'
  return 'Research Defense'
}

function programLabel(group: ResearchGroup | null) {
  if (!group?.program) return 'Program not recorded'
  return `${group.program}${group.major ? ` - ${group.major}` : ''}`
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

function scheduleTimestamp(schedule: ScheduleRow) {
  return new Date(`${schedule.defense_date}T${String(schedule.start_time).slice(0, 8)}+08:00`).getTime()
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<PublicSearchParams>
}) {
  const params = await searchParams
  const search = String(params.q ?? '').trim().slice(0, 150)
  const defenseType = DEFENSE_TYPES.has(params.defense as DefenseType)
    ? (params.defense as DefenseType)
    : null
  const requestedProgram = String(params.program ?? '').toUpperCase()
  const program = PROGRAMS.has(requestedProgram) ? requestedProgram : null
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(params.date ?? '')) ? String(params.date) : null

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('defense_schedules')
    .select(`
      id,
      defense_date,
      start_time,
      end_time,
      venue,
      research_groups (
        public_code,
        title,
        program,
        major,
        defense_type,
        status
      ),
      panel_assignments (
        panel_role,
        sort_order,
        faculty (
          full_name
        )
      )
    `)
    .eq('is_published', true)
    .order('defense_date', { ascending: true })
    .order('start_time', { ascending: true })

  const allSchedules = ((data ?? []) as ScheduleRow[]).filter((schedule) => {
    const group = one(schedule.research_groups)
    return group?.status === 'scheduled'
  })

  const schedules = allSchedules.filter((schedule) => {
    const group = one(schedule.research_groups)
    if (!group) return false
    if (search && !group.title.toLowerCase().includes(search.toLowerCase())) return false
    if (defenseType && group.defense_type !== defenseType) return false
    if (program && group.program !== program) return false
    if (date && schedule.defense_date !== date) return false
    return true
  })

  const groupedSchedules = new Map<string, ScheduleRow[]>()
  for (const schedule of schedules) {
    const current = groupedSchedules.get(schedule.defense_date) ?? []
    current.push(schedule)
    groupedSchedules.set(schedule.defense_date, current)
  }

  const todayKey = manilaTodayKey()
  const nextSchedule = [...allSchedules].sort((a, b) => scheduleTimestamp(a) - scheduleTimestamp(b))[0] ?? null
  const nextGroup = nextSchedule ? one(nextSchedule.research_groups) : null
  const hasFilters = Boolean(search || defenseType || program || date)

  return (
    <>
      <section className="public-hero">
        <div className="container public-hero-grid">
          <div className="public-hero-copy">
            <p className="eyebrow">Research Defense Schedule</p>
            <h1>Upcoming research defenses</h1>
            <p className="lead">
              Find scheduled title, proposal, and final defenses. Published schedules remain visible until their scheduled end time.
            </p>
            <div className="public-hero-actions">
              <Link className="button" href="/submit">Submit Research</Link>
              <Link className="button button-secondary" href="#schedule">Browse Schedule</Link>
            </div>
          </div>

          <div className="card next-defense-card">
            <span className="next-defense-kicker">Next defense</span>
            {nextSchedule && nextGroup ? (
              <>
                <div className="next-defense-date">
                  <strong>{formatCompactDate(nextSchedule.defense_date)}</strong>
                  <span>{formatTime(nextSchedule.start_time)} – {formatTime(nextSchedule.end_time)}</span>
                </div>
                <span className={`public-defense-badge type-${nextGroup.defense_type ?? 'general'}`}>
                  {defenseTypeLabel(nextGroup.defense_type)}
                </span>
                <h2>{nextGroup.title}</h2>
                <p>{programLabel(nextGroup)} · {nextSchedule.venue}</p>
              </>
            ) : (
              <div className="next-defense-empty">
                <strong>No upcoming defense</strong>
                <p>A published schedule will appear here once one is available.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section public-schedule-section" id="schedule">
        <div className="container">
          <div className="public-schedule-heading">
            <div>
              <p className="eyebrow">Published Schedule</p>
              <h2>Defense calendar</h2>
              <p>Search or narrow the list using the filters below.</p>
            </div>
            <div className="public-schedule-count">
              <strong>{schedules.length}</strong>
              <span>{schedules.length === 1 ? 'defense shown' : 'defenses shown'}</span>
            </div>
          </div>

          <form className="card public-schedule-filters" method="get" action="/">
            <div className="public-filter-search">
              <label htmlFor="public-search">Research title</label>
              <input
                id="public-search"
                name="q"
                defaultValue={search}
                maxLength={150}
                placeholder="Search research title"
              />
            </div>

            <div className="public-filter-field">
              <label htmlFor="public-defense">Defense type</label>
              <select id="public-defense" name="defense" defaultValue={defenseType ?? ''}>
                <option value="">All defense types</option>
                <option value="title">Title Defense</option>
                <option value="proposal">Proposal Defense</option>
                <option value="final">Final Defense</option>
              </select>
            </div>

            <div className="public-filter-field">
              <label htmlFor="public-program">Program</label>
              <select id="public-program" name="program" defaultValue={program ?? ''}>
                <option value="">All programs</option>
                <option value="BEED">BEED</option>
                <option value="BSED">BSED</option>
                <option value="BSA">BSA</option>
                <option value="BSAIS">BSAIS</option>
                <option value="BSBA">BSBA</option>
              </select>
            </div>

            <div className="public-filter-field">
              <label htmlFor="public-date">Date</label>
              <input id="public-date" name="date" type="date" defaultValue={date ?? ''} />
            </div>

            <div className="public-filter-actions">
              <button className="button button-small" type="submit">Apply</button>
              {hasFilters ? (
                <Link className="button button-secondary button-small" href="/#schedule">Clear</Link>
              ) : null}
            </div>
          </form>

          {error ? (
            <div className="card empty-state public-empty-state">
              <h3>Schedule is temporarily unavailable.</h3>
              <p>The published schedule could not be loaded right now. Please try again later.</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="card empty-state public-empty-state">
              <span className="public-empty-icon" aria-hidden="true">○</span>
              <h3>{hasFilters ? 'No defenses match these filters.' : 'No upcoming defense is currently published.'}</h3>
              <p>
                {hasFilters
                  ? 'Try changing the research title, program, defense type, or date.'
                  : 'Published defenses will appear here once the administrator releases a schedule.'}
              </p>
              {hasFilters ? <Link className="button button-secondary button-small" href="/#schedule">Clear filters</Link> : null}
            </div>
          ) : (
            <div className="public-date-groups">
              {[...groupedSchedules.entries()].map(([defenseDate, daySchedules]) => (
                <section className="public-date-group" key={defenseDate}>
                  <div className="public-date-heading">
                    <div>
                      <span className={defenseDate === todayKey ? 'day-marker today' : 'day-marker'}>
                        {defenseDate === todayKey ? 'Today' : 'Upcoming'}
                      </span>
                      <h3>{formatDate(defenseDate)}</h3>
                    </div>
                    <span>{daySchedules.length} {daySchedules.length === 1 ? 'defense' : 'defenses'}</span>
                  </div>

                  <div className="public-defense-list">
                    {daySchedules.map((schedule) => {
                      const group = one(schedule.research_groups)
                      if (!group) return null

                      const panel = [...(schedule.panel_assignments ?? [])].sort(
                        (a, b) => a.sort_order - b.sort_order
                      )
                      const chair = panel.find((item) => item.panel_role === 'chair')
                      const chairName = one(chair?.faculty)?.full_name ?? null
                      const memberNames = panel
                        .filter((item) => item.panel_role === 'member')
                        .map((item) => one(item.faculty)?.full_name)
                        .filter((name): name is string => Boolean(name))

                      return (
                        <article className="card public-defense-card" key={schedule.id}>
                          <div className="public-defense-time-block">
                            <span>Time</span>
                            <strong>{formatTime(schedule.start_time)}</strong>
                            <small>to {formatTime(schedule.end_time)}</small>
                          </div>

                          <div className="public-defense-main">
                            <div className="public-defense-labels">
                              <span className={`public-defense-badge type-${group.defense_type ?? 'general'}`}>
                                {defenseTypeLabel(group.defense_type)}
                              </span>
                              <span className="public-program-badge">{programLabel(group)}</span>
                            </div>
                            <h4>{group.title}</h4>
                            <div className="public-defense-facts">
                              <span><strong>Venue</strong>{schedule.venue}</span>
                              {chairName ? <span><strong>Panel Chair</strong>{chairName}</span> : null}
                            </div>
                          </div>

                          <div className="public-panel-block">
                            <span className="public-panel-label">Panel Members</span>
                            {memberNames.length ? (
                              <ul>
                                {memberNames.map((name) => <li key={name}>{name}</li>)}
                              </ul>
                            ) : (
                              <p>Panel members not listed.</p>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
