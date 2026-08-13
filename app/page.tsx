import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type FacultyName = { full_name: string }
type PanelAssignment = {
  panel_role: 'chair' | 'member'
  sort_order: number
  faculty: FacultyName | FacultyName[] | null
}
type ResearchGroup = {
  public_code: string
  title: string
  defense_type: 'title' | 'proposal' | 'final' | null
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

function formatDate(value: string) {
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

export default async function Home() {
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

  const schedules = (data ?? []) as ScheduleRow[]

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">Research Defense Management</p>
            <h1>One place for defense submissions and schedules.</h1>
            <p className="lead">
              Research groups can submit their information online, while published defense
              schedules are available here for students, faculty, and panel members.
            </p>
          </div>
          <div className="hero-actions">
            <Link className="button" href="/submit">Submit Research</Link>
            <Link className="button button-secondary" href="#schedule">View Schedule</Link>
          </div>
        </div>
      </section>

      <section className="section" id="schedule">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Published Schedule</p>
              <h2>Upcoming research defenses</h2>
            </div>
            <p>{schedules.length} published {schedules.length === 1 ? 'schedule' : 'schedules'}</p>
          </div>

          {error ? (
            <div className="card empty-state">
              <h3>Schedule is temporarily unavailable.</h3>
              <p>The application is connected, but the schedule could not be loaded right now.</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="card empty-state">
              <h3>No upcoming defense schedule is currently published.</h3>
              <p>Published defenses appear here until their scheduled end time.</p>
            </div>
          ) : (
            <div className="schedule-list">
              {schedules.map((schedule) => {
                const group = one(schedule.research_groups)
                const panel = [...(schedule.panel_assignments ?? [])].sort(
                  (a, b) => a.sort_order - b.sort_order
                )

                return (
                  <article className="card schedule-card" key={schedule.id}>
                    <div>
                      <span className="schedule-date">{formatDate(schedule.defense_date)}</span>
                      <span className="schedule-time">
                        {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                      </span>
                    </div>

                    <div className="schedule-title">
                      <div className="schedule-labels">
                        {group?.public_code ? <span className="code">{group.public_code}</span> : null}
                        <span className="defense-type-pill">{defenseTypeLabel(group?.defense_type ?? null)}</span>
                      </div>
                      <h3 style={{ marginTop: 10 }}>{group?.title ?? 'Research Defense'}</h3>
                    </div>

                    <div className="schedule-meta">
                      <p><strong>Venue:</strong> {schedule.venue}</p>
                      {panel.length > 0 ? (
                        <>
                          <p><strong>Panel:</strong></p>
                          <ul className="panel-list">
                            {panel.map((item, index) => {
                              const faculty = one(item.faculty)
                              return (
                                <li key={`${schedule.id}-${index}`}>
                                  {faculty?.full_name ?? 'Panel member'}
                                  {item.panel_role === 'chair' ? ' (Chair)' : ''}
                                </li>
                              )
                            })}
                          </ul>
                        </>
                      ) : null}
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
