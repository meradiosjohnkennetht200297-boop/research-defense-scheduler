import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CompleteDefenseForm from '../dashboard/complete-defense-form'
import styles from './schedule.module.css'

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
  completed_at: string | null
  research_groups: GroupRow | GroupRow[] | null
  panel_assignments: PanelAssignment[] | null
}

type ScheduleMode = 'active' | 'action' | 'completed'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function stamp(date: string, time: string) {
  return new Date(`${date}T${String(time).slice(0, 8)}+08:00`).getTime()
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function validDateKey(value: string | undefined) {
  const candidate = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return ''
  const [year, month, day] = candidate.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? candidate
    : ''
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
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

function programLabel(group: GroupRow) {
  if (!group.program) return 'Program not recorded'
  return `${group.program}${group.major ? ` - ${group.major}` : ''}`
}

function panelNames(schedule: ScheduleRow) {
  const panel = [...(schedule.panel_assignments ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const chair = panel.find((assignment) => assignment.panel_role === 'chair')
  const members = panel.filter((assignment) => assignment.panel_role === 'member')
  return {
    chair: one(chair?.faculty)?.full_name ?? 'Not recorded',
    members: members.map((assignment) => one(assignment.faculty)?.full_name).filter(Boolean) as string[],
  }
}

function visibilityLabel(schedule: ScheduleRow, mode: ScheduleMode) {
  if (mode === 'completed') return 'Completed'
  if (mode === 'action') return 'Ended'
  return schedule.is_published ? 'Published' : 'Private'
}

function visibilityClass(schedule: ScheduleRow, mode: ScheduleMode) {
  if (mode === 'completed') return 'status-pill status-completed'
  if (schedule.is_published && mode === 'active') return 'status-pill status-published'
  return 'status-pill'
}

function ScheduleActions({ group, mode }: { group: GroupRow; mode: ScheduleMode }) {
  return (
    <>
      {mode === 'action' ? <CompleteDefenseForm groupId={group.id} returnTo="schedule" /> : null}
      {mode !== 'completed' ? (
        <Link className="button button-secondary button-small" href={`/admin/groups/${group.id}${mode === 'action' ? '?reschedule=1' : ''}`}>
          {mode === 'action' ? 'Reschedule' : 'Edit Schedule'}
        </Link>
      ) : null}
      {mode !== 'active' ? <Link className="button button-secondary button-small" href={`/admin/groups/${group.id}`}>Open Research</Link> : null}
    </>
  )
}

function ScheduleCard({ schedule, mode }: { schedule: ScheduleRow; mode: ScheduleMode }) {
  const group = one(schedule.research_groups)
  if (!group) return null
  const panel = panelNames(schedule)

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.labels}>
          <span className="code">{group.public_code}</span>
          <span className="defense-type-pill">{defenseLabel(group.defense_type)}</span>
        </div>
        <span className={visibilityClass(schedule, mode)}>{visibilityLabel(schedule, mode)}</span>
      </div>

      <div className={styles.when}>
        <strong>{formatDate(schedule.defense_date)}</strong>
        <span>{formatTime(schedule.start_time)}–{formatTime(schedule.end_time)}</span>
      </div>

      <div className={styles.research}>
        <h3>{group.title}</h3>
        <p>{programLabel(group)}</p>
      </div>

      <dl className={styles.meta}>
        <div><dt>Venue</dt><dd>{schedule.venue}</dd></div>
        <div><dt>Chair</dt><dd>{panel.chair}</dd></div>
      </dl>

      {panel.members.length ? (
        <details className={styles.moreDetails}>
          <summary>Panel members <span>{panel.members.length}</span></summary>
          <ul>{panel.members.map((name) => <li key={name}>{name}</li>)}</ul>
        </details>
      ) : null}

      <div className={styles.actions}><ScheduleActions group={group} mode={mode} /></div>
    </article>
  )
}

function DesktopScheduleTable({ rows, mode }: { rows: ScheduleRow[]; mode: ScheduleMode }) {
  return (
    <div className="admin-desktop-only admin-table-shell">
      <table className="admin-data-table admin-schedule-table">
        <thead>
          <tr>
            <th scope="col">Schedule</th>
            <th scope="col">Research</th>
            <th scope="col">Program / Defense</th>
            <th scope="col">Venue</th>
            <th scope="col">Panel</th>
            <th scope="col">State</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((schedule) => {
            const group = one(schedule.research_groups)
            if (!group) return null
            const panel = panelNames(schedule)
            return (
              <tr key={schedule.id}>
                <td>
                  <span className="admin-table-nowrap">{formatDate(schedule.defense_date)}</span>
                  <small className="admin-table-muted">{formatTime(schedule.start_time)}–{formatTime(schedule.end_time)}</small>
                </td>
                <td>
                  <div className="admin-table-research">
                    <span className="code">{group.public_code}</span>
                    <strong>{group.title}</strong>
                  </div>
                </td>
                <td>
                  <span>{programLabel(group)}</span>
                  <small className="admin-table-muted">{defenseLabel(group.defense_type)}</small>
                </td>
                <td>{schedule.venue}</td>
                <td>
                  <strong>{panel.chair}</strong>
                  {panel.members.length ? (
                    <details className="admin-table-panel-details">
                      <summary>{panel.members.length} {panel.members.length === 1 ? 'member' : 'members'}</summary>
                      <ul>{panel.members.map((name) => <li key={name}>{name}</li>)}</ul>
                    </details>
                  ) : <small className="admin-table-muted">No members recorded</small>}
                </td>
                <td><span className={visibilityClass(schedule, mode)}>{visibilityLabel(schedule, mode)}</span></td>
                <td className="admin-table-action">
                  <div className="admin-schedule-actions"><ScheduleActions group={group} mode={mode} /></div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ScheduleSection({
  id, eyebrow, title, description, rows, mode, empty, collapsed = false,
}: {
  id: string
  eyebrow: string
  title: string
  description: string
  rows: ScheduleRow[]
  mode: ScheduleMode
  empty: string
  collapsed?: boolean
}) {
  const content = rows.length ? (
    <>
      <DesktopScheduleTable mode={mode} rows={rows} />
      <div className={`admin-mobile-only ${styles.grid}`}>
        {rows.map((row) => <ScheduleCard key={row.id} mode={mode} schedule={row} />)}
      </div>
    </>
  ) : <div className={styles.empty}>{empty}</div>

  if (collapsed) {
    return (
      <details className={`${styles.section} ${styles.collapsibleSection}`} id={id}>
        <summary className={styles.collapsibleHeading}>
          <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>
          <span className="status-pill">{rows.length}</span>
        </summary>
        <div className={styles.collapsibleBody}>{content}</div>
      </details>
    )
  }

  return (
    <section className={styles.section} id={id}>
      <div className={styles.sectionHeading}>
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>
        <span className={mode === 'action' && rows.length ? 'status-pill status-warning' : 'status-pill'}>{rows.length}</span>
      </div>
      {content}
    </section>
  )
}

export default async function AdminDefenseScheduleV2({ searchParams }: {
  searchParams: Promise<{ confirmed?: string; error?: string; date?: string }>
}) {
  const params = await searchParams
  const selectedDate = validDateKey(params.date)
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

  let scheduleQuery = supabase
    .from('defense_schedules')
    .select(`
      id, defense_date, start_time, end_time, venue, is_published, completed_at,
      research_groups!inner (
        id, public_code, title, program, major, defense_type, status
      ),
      panel_assignments (
        panel_role, sort_order,
        faculty ( full_name )
      )
    `)
    .in('research_groups.status', ['scheduled', 'completed'])
    .order('defense_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (selectedDate) scheduleQuery = scheduleQuery.eq('defense_date', selectedDate)

  const { data, error } = await scheduleQuery
  const rows = (data ?? []) as ScheduleRow[]
  const now = Date.now()
  const today = todayKey()
  const scheduled = rows.filter((row) => one(row.research_groups)?.status === 'scheduled')
  const active = scheduled.filter((row) => stamp(row.defense_date, row.end_time) > now)
  const actionRequired = scheduled
    .filter((row) => stamp(row.defense_date, row.end_time) <= now)
    .sort((a, b) => stamp(b.defense_date, b.end_time) - stamp(a.defense_date, a.end_time))
  const todayRows = active
    .filter((row) => row.defense_date === today)
    .sort((a, b) => stamp(a.defense_date, a.start_time) - stamp(b.defense_date, b.start_time))
  const upcoming = active
    .filter((row) => row.defense_date !== today)
    .sort((a, b) => stamp(a.defense_date, a.start_time) - stamp(b.defense_date, b.start_time))
  const completed = rows
    .filter((row) => one(row.research_groups)?.status === 'completed')
    .sort((a, b) => {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : stamp(a.defense_date, a.end_time)
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : stamp(b.defense_date, b.end_time)
      return bTime - aTime
    })
    .slice(0, 6)

  return (
    <section className={`section admin-dashboard-page ${styles.page}`}>
      <div className="container">
        <div className={`dashboard-heading ${styles.heading}`}>
          <div>
            <p className="eyebrow">Defense Schedule</p>
            <h2>Defense schedule workspace</h2>
            <p className="dashboard-intro">Manage today&apos;s defenses, upcoming assignments, ended defenses that need confirmation, and recent completions.</p>
          </div>
          <div className={styles.tools}>
            <Link className="button button-secondary button-small" href="/schedule">Public Schedule ↗</Link>
            <Link className="button button-secondary button-small" href="/admin/history">Full History</Link>
          </div>
        </div>

        {params.confirmed ? <div className="alert alert-success">Defense confirmed completed and moved to recent completions.</div> : null}
        {params.error ? <div className="alert alert-error">{params.error}</div> : null}
        {error ? <div className="alert alert-error">Defense schedules are temporarily unavailable. Please try again.</div> : null}

        {selectedDate ? (
          <div className="schedule-date-filter">
            <div>
              <strong>Showing {formatDate(selectedDate)}</strong>
              <span>Only defenses scheduled on this date are shown.</span>
            </div>
            <Link className="button button-secondary button-small" href="/admin/schedule">Clear date filter</Link>
          </div>
        ) : null}

        <nav aria-label="Schedule summary" className={styles.summary}>
          <a href="#today"><span>Today</span><strong>{todayRows.length}</strong></a>
          <a href="#upcoming"><span>Upcoming</span><strong>{upcoming.length}</strong></a>
          <a className={actionRequired.length ? styles.attention : undefined} href="#action-required"><span>Action Required</span><strong>{actionRequired.length}</strong></a>
          <a href="#completed"><span>Recent Completed</span><strong>{completed.length}</strong></a>
        </nav>

        <ScheduleSection description="Defenses still in progress or scheduled later today." empty="No active defenses today." eyebrow="Today" id="today" mode="active" rows={todayRows} title="Today's defenses" />
        <ScheduleSection description="Future defense assignments in chronological order." empty="No upcoming defenses are scheduled." eyebrow="Upcoming" id="upcoming" mode="active" rows={upcoming} title="Upcoming defenses" />
        <ScheduleSection description="These defense times have passed. Confirm the defense if it took place, or reschedule it if it did not." empty="No ended defenses are waiting for confirmation." eyebrow="Action Required" id="action-required" mode="action" rows={actionRequired} title="Awaiting confirmation" />
        <ScheduleSection collapsed description="The most recently confirmed completed defenses." empty="No completed defenses yet." eyebrow="Recent History" id="completed" mode="completed" rows={completed} title="Recently completed" />
      </div>
    </section>
  )
}
