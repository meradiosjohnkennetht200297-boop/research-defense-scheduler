import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { PANEL_ACCESS_COOKIE, panelTokenIsCurrent } from '@/lib/panel-portal'
import styles from './panel.module.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Panel Access | Research Defense Scheduler',
  description: 'Private manuscript access for research defense panel members.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

type FacultyName = { full_name: string }
type PanelAssignment = {
  panel_role: 'chair' | 'member'
  sort_order: number
  faculty: FacultyName | FacultyName[] | null
}
type DefenseRow = {
  id: string
  defense_type: 'title' | 'proposal' | 'final' | null
  status: string
  title_snapshot: string
  program_snapshot: string | null
  major_snapshot: string | null
  research_file_url: string | null
  members_snapshot: string[]
  adviser_id_snapshot: string | null
  instructor_id_snapshot: string | null
}
type ScheduleRow = {
  id: string
  defense_date: string
  start_time: string
  end_time: string
  venue: string
  research_defenses: DefenseRow | DefenseRow[] | null
  panel_assignments: PanelAssignment[] | null
}

type PortalState = 'scheduled' | 'completed' | 'awaiting'

function one<T>(value: T | T[] | null | undefined): T | null {
  return !value ? null : Array.isArray(value) ? value[0] ?? null : value
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function stamp(date: string, time: string) {
  return new Date(`${date}T${String(time).slice(0, 8)}+08:00`).getTime()
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
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

function defenseLabel(value: DefenseRow['defense_type']) {
  return value === 'title' ? 'Title Defense' : value === 'proposal' ? 'Proposal Defense' : value === 'final' ? 'Final Defense' : 'Research Defense'
}

function programLabel(defense: DefenseRow) {
  if (!defense.program_snapshot) return 'Program not recorded'
  return `${defense.program_snapshot}${defense.major_snapshot ? ` · ${defense.major_snapshot}` : ''}`
}

function portalState(schedule: ScheduleRow, now: number): PortalState {
  const defense = one(schedule.research_defenses)
  if (defense?.status === 'completed') return 'completed'
  if (defense?.status === 'scheduled' && stamp(schedule.defense_date, schedule.end_time) <= now) return 'awaiting'
  return 'scheduled'
}

function panelNames(schedule: ScheduleRow) {
  const assignments = [...(schedule.panel_assignments ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const chair = assignments.find(item => item.panel_role === 'chair')
  const members = assignments.filter(item => item.panel_role === 'member')
  return {
    chair: one(chair?.faculty)?.full_name ?? 'Not recorded',
    members: members.map(item => one(item.faculty)?.full_name).filter((name): name is string => Boolean(name)),
  }
}

function stateLabel(state: PortalState) {
  return state === 'completed' ? 'Completed' : state === 'awaiting' ? 'Awaiting confirmation' : 'Scheduled'
}

function PortalCard({ schedule, facultyNames, now }: {
  schedule: ScheduleRow
  facultyNames: Map<string, string>
  now: number
}) {
  const defense = one(schedule.research_defenses)
  if (!defense) return null
  const state = portalState(schedule, now)
  const panel = panelNames(schedule)
  const adviser = defense.adviser_id_snapshot ? facultyNames.get(defense.adviser_id_snapshot) ?? 'Not recorded' : 'Not recorded'
  const instructor = defense.instructor_id_snapshot ? facultyNames.get(defense.instructor_id_snapshot) ?? 'Not recorded' : 'Not recorded'

  return <article className={`${styles.card} ${state === 'completed' ? styles.completed : state === 'awaiting' ? styles.awaiting : ''}`}>
    <div className={styles.cardHead}>
      <div className={styles.labels}>
        <span className={`${styles.status} ${state === 'completed' ? styles.statusCompleted : state === 'awaiting' ? styles.statusAwaiting : styles.statusScheduled}`}>{stateLabel(state)}</span>
        <span className={styles.defenseType}>{defenseLabel(defense.defense_type)}</span>
      </div>
      <span className={styles.program}>{programLabel(defense)}</span>
    </div>

    <div className={styles.researchTitle}><h2>{defense.title_snapshot}</h2></div>

    <div className={styles.scheduleLine}>
      <span><strong>{formatDate(schedule.defense_date)}</strong>{formatTime(schedule.start_time)}–{formatTime(schedule.end_time)}</span>
      <span><strong>Venue</strong>{schedule.venue}</span>
    </div>

    <div className={styles.primaryAction}>
      {defense.research_file_url ? (
        <a className="button" href={defense.research_file_url} rel="noopener noreferrer" target="_blank">Open Manuscript ↗</a>
      ) : (
        <span className={styles.manuscriptMissing}>Manuscript not available</span>
      )}
    </div>

    <details className={styles.details}>
      <summary>Defense details</summary>
      <div className={styles.detailGrid}>
        <div><span>Group members</span><p>{defense.members_snapshot.length ? defense.members_snapshot.join(', ') : 'Not recorded'}</p></div>
        <div><span>Research Adviser</span><p>{adviser}</p></div>
        <div><span>Research Instructor</span><p>{instructor}</p></div>
        <div><span>Panel Chair</span><p>{panel.chair}</p></div>
        <div><span>Panel Members</span><p>{panel.members.length ? panel.members.join(', ') : 'Not recorded'}</p></div>
      </div>
    </details>
  </article>
}

function PortalSection({ title, note, rows, facultyNames, now }: {
  title: string
  note: string
  rows: ScheduleRow[]
  facultyNames: Map<string, string>
  now: number
}) {
  if (!rows.length) return null
  return <section className={styles.section}>
    <div className={styles.sectionHead}><div><h2>{title}</h2><p>{note}</p></div><span>{rows.length}</span></div>
    <div className={styles.list}>{rows.map(row => <PortalCard facultyNames={facultyNames} key={row.id} now={now} schedule={row}/>)}</div>
  </section>
}

export default async function PanelPortal({ searchParams }: { searchParams: Promise<{ invalid?: string }> }) {
  const params = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get(PANEL_ACCESS_COOKIE)?.value ?? ''
  const admin = createAdminClient()
  const hasAccess = token ? await panelTokenIsCurrent(admin, token) : false

  if (!hasAccess) {
    return <section className={styles.lockedPage}><div className={styles.lockedCard}>
      <span className={styles.lockMark}>PANEL</span>
      <h1>Private Panel Access</h1>
      <p>{params.invalid ? 'This panel link is invalid or has already been reset.' : 'Open the private Panel Access link shared by the research administrator.'}</p>
      <small>No account or Research Code is required.</small>
    </div></section>
  }

  const { data, error } = await admin
    .from('defense_schedules')
    .select(`id, defense_date, start_time, end_time, venue,
      research_defenses!inner (
        id, defense_type, status, title_snapshot, program_snapshot, major_snapshot,
        research_file_url, members_snapshot, adviser_id_snapshot, instructor_id_snapshot
      ),
      panel_assignments (panel_role, sort_order, faculty (full_name))`)
    .in('research_defenses.status', ['scheduled', 'completed'])
    .order('defense_date', { ascending: true })
    .order('start_time', { ascending: true })

  const rows = (data ?? []) as ScheduleRow[]
  const facultyIds = new Set<string>()
  for (const row of rows) {
    const defense = one(row.research_defenses)
    if (defense?.adviser_id_snapshot) facultyIds.add(defense.adviser_id_snapshot)
    if (defense?.instructor_id_snapshot) facultyIds.add(defense.instructor_id_snapshot)
  }

  const facultyNames = new Map<string, string>()
  if (facultyIds.size) {
    const { data: facultyRows } = await admin.from('faculty').select('id, full_name').in('id', [...facultyIds])
    for (const faculty of facultyRows ?? []) facultyNames.set(faculty.id, faculty.full_name)
  }

  const now = Date.now()
  const today = todayKey()
  const todayRows = rows.filter(row => row.defense_date === today).sort((a, b) => stamp(a.defense_date, a.start_time) - stamp(b.defense_date, b.start_time))
  const upcomingRows = rows.filter(row => row.defense_date > today && portalState(row, now) === 'scheduled').sort((a, b) => stamp(a.defense_date, a.start_time) - stamp(b.defense_date, b.start_time))
  const completedRows = rows.filter(row => row.defense_date < today && portalState(row, now) === 'completed').sort((a, b) => stamp(b.defense_date, b.start_time) - stamp(a.defense_date, a.start_time))
  const awaitingRows = rows.filter(row => row.defense_date < today && portalState(row, now) === 'awaiting').sort((a, b) => stamp(b.defense_date, b.start_time) - stamp(a.defense_date, a.start_time))

  return <section className={styles.page}><div className={`container ${styles.container}`}>
    <header className={styles.heading}>
      <div><p className="eyebrow">Private Panel Access</p><h1>Defense manuscripts</h1><p>Open the manuscript for any scheduled or completed research defense.</p></div>
      <div className={styles.accessNote}>Read-only access</div>
    </header>

    {error ? <div className="alert alert-error">Defense manuscripts are temporarily unavailable. Please try again.</div> : null}

    {!rows.length && !error ? <div className={styles.empty}>No scheduled or completed defenses are available yet.</div> : null}
    <PortalSection facultyNames={facultyNames} note="Defenses scheduled for today." now={now} rows={todayRows} title="Today"/>
    <PortalSection facultyNames={facultyNames} note="Upcoming scheduled defenses." now={now} rows={upcomingRows} title="Upcoming"/>
    <PortalSection facultyNames={facultyNames} note="Past defenses waiting for the administrator to confirm completion." now={now} rows={awaitingRows} title="Awaiting confirmation"/>
    <PortalSection facultyNames={facultyNames} note="Completed defense records and their manuscripts." now={now} rows={completedRows} title="Completed"/>
  </div></section>
}
