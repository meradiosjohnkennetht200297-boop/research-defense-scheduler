import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import styles from './schedule.module.css'

type DefenseType = 'title' | 'proposal' | 'final'
type GroupRow = {
  id: string
  public_code: string
  title: string
  program: string | null
  major: string | null
  defense_type: DefenseType | null
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
  research_groups: GroupRow | GroupRow[] | null
  panel_assignments: PanelAssignment[] | null
}

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

function chairName(schedule: ScheduleRow) {
  const chair = [...(schedule.panel_assignments ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .find((assignment) => assignment.panel_role === 'chair')
  return one(chair?.faculty)?.full_name ?? 'Not recorded'
}

function ScheduleAction({ group }: { group: GroupRow }) {
  return <Link className="button button-secondary button-small" href={`/admin/groups/${group.id}`}>Edit Schedule</Link>
}

function ScheduleCard({ schedule }: { schedule: ScheduleRow }) {
  const group = one(schedule.research_groups)
  if (!group) return null

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.labels}>
          <span className="code">{group.public_code}</span>
          <span className="defense-type-pill">{defenseLabel(group.defense_type)}</span>
        </div>
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
        <div><dt>Chair</dt><dd>{chairName(schedule)}</dd></div>
      </dl>

      <div className={styles.actions}><ScheduleAction group={group} /></div>
    </article>
  )
}

function DesktopScheduleTable({ rows }: { rows: ScheduleRow[] }) {
  return (
    <div className="admin-desktop-only admin-table-shell">
      <table className={`admin-data-table ${styles.desktopTable}`}>
        <thead>
          <tr>
            <th scope="col">Schedule</th>
            <th scope="col">Research</th>
            <th scope="col">Program / Defense</th>
            <th scope="col">Venue</th>
            <th scope="col">Chair</th>
            <th scope="col"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((schedule) => {
            const group = one(schedule.research_groups)
            if (!group) return null
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
                <td>{chairName(schedule)}</td>
                <td className="admin-table-action"><ScheduleAction group={group} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ScheduleSection({ id, title, rows, empty }: {
  id: string
  title: string
  rows: ScheduleRow[]
  empty: string
}) {
  return (
    <section className={styles.section} id={id}>
      <div className={styles.sectionHeading}>
        <h2>{title}</h2>
        <span className="status-pill">{rows.length}</span>
      </div>
      {rows.length ? (
        <>
          <DesktopScheduleTable rows={rows} />
          <div className={`admin-mobile-only ${styles.grid}`}>
            {rows.map((row) => <ScheduleCard key={row.id} schedule={row} />)}
          </div>
        </>
      ) : <div className={styles.empty}>{empty}</div>}
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
      id, defense_date, start_time, end_time, venue,
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

  if (selectedDate) scheduleQuery = scheduleQuery.eq('defense_date', selectedDate)

  const { data, error } = await scheduleQuery
  const rows = (data ?? []) as ScheduleRow[]
  const now = Date.now()
  const today = todayKey()
  const active = rows.filter((row) => stamp(row.defense_date, row.end_time) > now)
  const todayRows = active
    .filter((row) => row.defense_date === today)
    .sort((a, b) => stamp(a.defense_date, a.start_time) - stamp(b.defense_date, b.start_time))
  const upcoming = active
    .filter((row) => row.defense_date !== today)
    .sort((a, b) => stamp(a.defense_date, a.start_time) - stamp(b.defense_date, b.start_time))

  return (
    <section className={`section ${styles.page}`}>
      <div className="container">
        <div className={styles.heading}>
          <p className="eyebrow">Defense Schedule</p>
          <div className={styles.tools}>
            <Link className="button button-secondary button-small" href="/schedule">Public Schedule ↗</Link>
            <Link className="button button-secondary button-small" href="/admin/history">Full History</Link>
          </div>
        </div>

        {params.confirmed ? <div className="alert alert-success">Defense confirmed completed and added to history.</div> : null}
        {params.error ? <div className="alert alert-error">{params.error}</div> : null}
        {error ? <div className="alert alert-error">Defense schedules are temporarily unavailable. Please try again.</div> : null}

        {selectedDate ? (
          <div className="schedule-date-filter">
            <div>
              <strong>Showing {formatDate(selectedDate)}</strong>
              <span>Only active scheduled defenses on this date are shown. Ended defenses needing follow-up remain on the Dashboard.</span>
            </div>
            <Link className="button button-secondary button-small" href="/admin/schedule">Clear date filter</Link>
          </div>
        ) : null}

        <ScheduleSection empty="No defenses remaining today." id="today" rows={todayRows} title="Today" />
        <ScheduleSection empty="No upcoming defenses are scheduled." id="upcoming" rows={upcoming} title="Upcoming" />
      </div>
    </section>
  )
}
