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

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function manilaTodayKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Manila',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatTime(value: string) {
  const [hourText, minuteText] = value.split(':')
  let hour = Number(hourText)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (hour === 0) hour = 12
  return `${hour}:${minuteText ?? '00'} ${suffix}`
}

function defenseLabel(value: DefenseType | null) {
  if (value === 'title') return 'Title Defense'
  if (value === 'proposal') return 'Proposal Defense'
  if (value === 'final') return 'Final Defense'
  return 'Research Defense'
}

function programLabel(group: ResearchGroup) {
  if (!group.program) return 'Program not recorded'
  return `${group.program}${group.major ? ` - ${group.major}` : ''}`
}

export default async function MinimalHome() {
  const today = manilaTodayKey()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('defense_schedules')
    .select(`
      id,
      defense_date,
      start_time,
      end_time,
      venue,
      research_groups (title, program, major, defense_type, status),
      panel_assignments (
        panel_role,
        sort_order,
        faculty (full_name)
      )
    `)
    .eq('is_published', true)
    .eq('defense_date', today)
    .order('start_time', { ascending: true })

  const schedules = ((data ?? []) as ScheduleRow[]).filter((schedule) => {
    const group = one(schedule.research_groups)
    return group?.status === 'scheduled'
  })

  return (
    <>
      <section className="minimal-home-hero">
        <div className="container minimal-home-inner">
          <p className="eyebrow">Research Defense Scheduler</p>
          <h1>Research defense scheduling, kept simple.</h1>
          <p className="minimal-home-lead">Submit your research group or check the published defense schedule.</p>
          <div className="minimal-home-actions">
            <Link className="button" href="/submit">Submit Research</Link>
            <Link className="button button-secondary" href="/schedule">Browse Schedule</Link>
          </div>
        </div>
      </section>

      <section className="section minimal-today-section">
        <div className="container">
          <div className="minimal-section-heading">
            <div>
              <p className="eyebrow">Defense Today</p>
              <h2>{formatDate(today)}</h2>
            </div>
            {!error ? <span>{schedules.length} {schedules.length === 1 ? 'defense' : 'defenses'}</span> : null}
          </div>

          {error ? (
            <div className="minimal-empty">
              <h3>Today&apos;s defenses are temporarily unavailable.</h3>
              <p>Please try again later.</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="minimal-empty">
              <h3>No defenses scheduled today.</h3>
              <p>Use Browse Schedule above to check upcoming published defenses.</p>
            </div>
          ) : (
            <div className="minimal-today-list">
              {schedules.map((schedule) => {
                const group = one(schedule.research_groups)
                if (!group) return null
                const panel = [...(schedule.panel_assignments ?? [])].sort((a, b) => a.sort_order - b.sort_order)
                const chair = panel.find((item) => item.panel_role === 'chair')
                const chairName = one(chair?.faculty)?.full_name ?? null
                const members = panel
                  .filter((item) => item.panel_role === 'member')
                  .map((item) => one(item.faculty)?.full_name)
                  .filter((name): name is string => Boolean(name))

                return (
                  <article className="minimal-defense-card" key={schedule.id}>
                    <div className="minimal-defense-time">
                      <strong>{formatTime(schedule.start_time)}</strong>
                      <span>– {formatTime(schedule.end_time)}</span>
                    </div>
                    <div className="minimal-defense-content">
                      <div className="minimal-defense-labels">
                        <span className={`public-defense-badge type-${group.defense_type ?? 'general'}`}>{defenseLabel(group.defense_type)}</span>
                        <span className="public-program-badge">{programLabel(group)}</span>
                      </div>
                      <h3>{group.title}</h3>
                      <p className="minimal-venue">{schedule.venue}</p>
                    </div>
                    <div className="minimal-panel">
                      <div><span>Panel Chair</span><strong>{chairName ?? 'Not listed'}</strong></div>
                      <div><span>Panel Members</span><p>{members.length ? members.join(', ') : 'Not listed'}</p></div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
