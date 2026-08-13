import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type DefenseType = 'title' | 'proposal' | 'final'
type GroupRow = {
  id: string
  public_code: string
  title: string
  program: string | null
  major: string | null
  defense_type: DefenseType | null
  status: string
}
type FacultyName = { full_name: string }
type PanelAssignment = {
  panel_role: 'chair' | 'member'
  sort_order: number
  faculty: FacultyName | FacultyName[] | null
}
type ScheduleRow = {
  id: string
  defense_date: string
  start_time: string
  end_time: string
  venue: string
  is_published: boolean
  research_groups: GroupRow | GroupRow[] | null
  panel_assignments: PanelAssignment[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function scheduleTimestamp(date: string, time: string) {
  return new Date(`${date}T${String(time).slice(0, 8)}+08:00`).getTime()
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
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

export default async function AdminDefenseSchedule() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/admin')

  const { data: profile } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (!profile) redirect('/admin')

  const { data, error } = await supabase
    .from('defense_schedules')
    .select(`
      id, defense_date, start_time, end_time, venue, is_published,
      research_groups!inner (
        id, public_code, title, program, major, defense_type, status
      ),
      panel_assignments (
        panel_role, sort_order,
        faculty ( full_name )
      )
    `)
    .eq('research_groups.status', 'scheduled')
    .order('defense_date', { ascending: true })
    .order('start_time', { ascending: true })

  const now = Date.now()
  const schedules = ((data ?? []) as ScheduleRow[])
    .filter((schedule) => scheduleTimestamp(schedule.defense_date, schedule.end_time) > now)
    .sort((a, b) => scheduleTimestamp(a.defense_date, a.start_time) - scheduleTimestamp(b.defense_date, b.start_time))

  return (
    <section className="section admin-dashboard-page admin-schedule-page">
      <div className="container">
        <div className="dashboard-heading admin-schedule-heading">
          <div>
            <p className="eyebrow">Defense Schedule</p>
            <h2>Scheduled defenses</h2>
            <p className="dashboard-intro">View current and upcoming defense assignments in chronological order.</p>
          </div>
          <div className="admin-schedule-tools">
            <Link className="button button-secondary button-small" href="/admin/history">Completed History</Link>
            <Link className="button button-secondary button-small" href="/schedule">Public Schedule ↗</Link>
          </div>
        </div>

        {error ? (
          <div className="card empty-state">
            <h3>Defense schedules are temporarily unavailable.</h3>
            <p>Please try again later.</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="card empty-state">
            <h3>No scheduled defenses.</h3>
            <p>Defense assignments will appear here after a pending research group is scheduled.</p>
          </div>
        ) : (
          <div className="card dashboard-panel admin-schedule-list-card">
            <div className="dashboard-panel-head">
              <div>
                <span className="dashboard-panel-kicker">Current and upcoming</span>
                <strong>{schedules.length} {schedules.length === 1 ? 'defense' : 'defenses'}</strong>
              </div>
            </div>
            <div className="dashboard-defense-list">
              {schedules.map((schedule) => {
                const group = one(schedule.research_groups)
                if (!group) return null
                const panel = [...(schedule.panel_assignments ?? [])].sort((a, b) => a.sort_order - b.sort_order)
                const chair = panel.find((assignment) => assignment.panel_role === 'chair')
                const chairName = one(chair?.faculty)?.full_name ?? 'Chair not recorded'
                const program = group.program ? `${group.program}${group.major ? ` - ${group.major}` : ''}` : 'Program not recorded'

                return (
                  <Link className="dashboard-defense-row admin-schedule-row" href={`/admin/groups/${group.id}`} key={schedule.id}>
                    <div className="dashboard-defense-date">
                      <span>{formatDate(schedule.defense_date)}</span>
                      <small>{formatTime(schedule.start_time)}–{formatTime(schedule.end_time)}</small>
                    </div>
                    <div className="dashboard-defense-copy">
                      <strong>{group.title}</strong>
                      <small>{group.public_code} · {defenseLabel(group.defense_type)} · {program}</small>
                      <small>{schedule.venue} · Chair: {chairName}</small>
                    </div>
                    <span className={schedule.is_published ? 'status-pill status-published' : 'status-pill'}>
                      {schedule.is_published ? 'Published' : 'Private'}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
