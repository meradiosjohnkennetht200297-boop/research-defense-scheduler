import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import styles from './schedule.module.css'

type FacultyName = { full_name: string }
type PanelAssignment = { panel_role: 'chair' | 'member'; sort_order: number; faculty: FacultyName | FacultyName[] | null }
type GroupRow = { id: string; public_code: string }
type DefenseRow = { id: string; defense_type: 'title' | 'proposal' | 'final' | null; status: string; title_snapshot: string; program_snapshot: string | null; major_snapshot: string | null }
type ScheduleRow = { id: string; defense_date: string; start_time: string; end_time: string; venue: string; research_groups: GroupRow | GroupRow[] | null; research_defenses: DefenseRow | DefenseRow[] | null; panel_assignments: PanelAssignment[] | null }
type ScheduleState = 'scheduled' | 'completed' | 'action'

function one<T>(value: T | T[] | null | undefined): T | null { return !value ? null : Array.isArray(value) ? value[0] ?? null : value }
function stamp(date: string, time: string) { return new Date(`${date}T${String(time).slice(0, 8)}+08:00`).getTime() }
function todayKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
function validDateKey(value: string | undefined) { const candidate = String(value ?? '').trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return ''; const [y, m, d] = candidate.split('-').map(Number), parsed = new Date(Date.UTC(y, m - 1, d)); return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d ? candidate : '' }
function formatDate(value: string) { const [y, m, d] = value.split('-').map(Number); return new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))) }
function formatLongDate(value: string) { const [y, m, d] = value.split('-').map(Number); return new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))) }
function formatTime(value: string) { const [h, m] = value.split(':'); let hour = Number(h); const suffix = hour >= 12 ? 'PM' : 'AM'; hour %= 12; if (!hour) hour = 12; return `${hour}:${m ?? '00'} ${suffix}` }
function defenseLabel(value: string | null) { return value === 'title' ? 'Title Defense' : value === 'proposal' ? 'Proposal Defense' : value === 'final' ? 'Final Defense' : 'Research Defense' }
function programLabel(defense: DefenseRow) { return defense.program_snapshot ? `${defense.program_snapshot}${defense.major_snapshot ? ` - ${defense.major_snapshot}` : ''}` : 'Program not recorded' }
function chairName(schedule: ScheduleRow) { const chair = [...(schedule.panel_assignments ?? [])].sort((a, b) => a.sort_order - b.sort_order).find(a => a.panel_role === 'chair'); return one(chair?.faculty)?.full_name ?? 'Not recorded' }
function scheduleState(schedule: ScheduleRow, now: number): ScheduleState { const defense = one(schedule.research_defenses); if (defense?.status === 'completed') return 'completed'; if (defense?.status === 'scheduled' && stamp(schedule.defense_date, schedule.end_time) <= now) return 'action'; return 'scheduled' }
function stateLabel(state: ScheduleState) { return state === 'completed' ? 'Completed' : state === 'action' ? 'Action Required' : 'Scheduled' }
function stateClass(state: ScheduleState) { return state === 'completed' ? styles.stateCompleted : state === 'action' ? styles.stateAction : styles.stateScheduled }

function ScheduleAction({ group, state }: { group: GroupRow; state: ScheduleState }) {
  if (state === 'completed') return <Link className="button button-secondary button-small" href={`/admin/groups/${group.id}`}>Open Research</Link>
  if (state === 'action') return <Link className="button button-secondary button-small" href="/admin/dashboard#action-required">Review</Link>
  return <Link className="button button-secondary button-small" href={`/admin/groups/${group.id}`}>Edit Schedule</Link>
}

function ScheduleCard({ schedule, now }: { schedule: ScheduleRow; now: number }) {
  const group = one(schedule.research_groups), defense = one(schedule.research_defenses)
  if (!group || !defense) return null
  const state = scheduleState(schedule, now)
  return <article className={`${styles.card} ${state === 'completed' ? styles.completedCard : state === 'action' ? styles.actionCard : ''}`}>
    <div className={styles.cardTop}><div className={styles.labels}><span className={`code ${styles.privateCode}`}>{group.public_code}</span><span className={`${styles.state} ${stateClass(state)}`}>{stateLabel(state)}</span><span className="defense-type-pill">{defenseLabel(defense.defense_type)}</span></div></div>
    <div className={styles.when}><strong>{formatDate(schedule.defense_date)}</strong><span>{formatTime(schedule.start_time)}–{formatTime(schedule.end_time)}</span></div>
    <div className={styles.research}><h3>{defense.title_snapshot}</h3><p>{programLabel(defense)}</p></div>
    <dl className={styles.meta}><div><dt>Venue</dt><dd>{schedule.venue}</dd></div><div><dt>Chair</dt><dd>{chairName(schedule)}</dd></div></dl>
    <div className={styles.actions}><ScheduleAction group={group} state={state}/></div>
  </article>
}

function DesktopScheduleTable({ rows, now }: { rows: ScheduleRow[]; now: number }) {
  return <div className="admin-desktop-only admin-table-shell"><table className={`admin-data-table ${styles.desktopTable}`}><thead><tr><th scope="col">Schedule</th><th scope="col">Research</th><th scope="col">Status / Defense</th><th scope="col">Venue</th><th scope="col">Chair</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead><tbody>{rows.map(schedule => {
    const group = one(schedule.research_groups), defense = one(schedule.research_defenses)
    if (!group || !defense) return null
    const state = scheduleState(schedule, now)
    return <tr className={state === 'action' ? styles.actionRow : undefined} key={schedule.id}><td><span className="admin-table-nowrap">{formatDate(schedule.defense_date)}</span><small className="admin-table-muted">{formatTime(schedule.start_time)}–{formatTime(schedule.end_time)}</small></td><td><div className="admin-table-research"><span className={`code ${styles.privateCode}`}>{group.public_code}</span><strong>{defense.title_snapshot}</strong></div></td><td><span className={`${styles.state} ${stateClass(state)}`}>{stateLabel(state)}</span><small className="admin-table-muted">{defenseLabel(defense.defense_type)} · {programLabel(defense)}</small></td><td>{schedule.venue}</td><td>{chairName(schedule)}</td><td className="admin-table-action"><ScheduleAction group={group} state={state}/></td></tr>
  })}</tbody></table></div>
}

function ScheduleSection({ id, title, rows, empty, now }: { id: string; title: string; rows: ScheduleRow[]; empty: string; now: number }) {
  return <section className={styles.section} id={id}><div className={styles.sectionHeading}><h2>{title}</h2><span className="status-pill">{rows.length}</span></div>{rows.length ? <><DesktopScheduleTable rows={rows} now={now}/><div className={`admin-mobile-only ${styles.grid}`}>{rows.map(row => <ScheduleCard key={row.id} schedule={row} now={now}/>)}</div></> : <div className={styles.empty}>{empty}</div>}</section>
}

export default async function AdminDefenseScheduleV3({ searchParams }: { searchParams: Promise<{ confirmed?: string; error?: string; date?: string }> }) {
  const params = await searchParams
  const selectedDate = validDateKey(params.date)
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/admin')
  const { data: profile } = await supabase.from('admin_profiles').select('user_id').eq('user_id', userId).eq('is_active', true).maybeSingle()
  if (!profile) redirect('/admin')

  let scheduleQuery = supabase
    .from('defense_schedules')
    .select(`id, defense_date, start_time, end_time, venue, research_groups!inner (id, public_code), research_defenses!inner (id, defense_type, status, title_snapshot, program_snapshot, major_snapshot), panel_assignments (panel_role, sort_order, faculty (full_name))`)
    .order('defense_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (selectedDate) scheduleQuery = scheduleQuery.eq('defense_date', selectedDate)
  else scheduleQuery = scheduleQuery.eq('research_defenses.status', 'scheduled')

  const { data, error } = await scheduleQuery
  const rows = (data ?? []) as ScheduleRow[]
  const now = Date.now()
  const today = todayKey()

  if (selectedDate) {
    const dayRows = rows.sort((a, b) => stamp(a.defense_date, a.start_time) - stamp(b.defense_date, b.start_time))
    const completed = dayRows.filter(row => scheduleState(row, now) === 'completed').length
    const action = dayRows.filter(row => scheduleState(row, now) === 'action').length
    const scheduled = dayRows.filter(row => scheduleState(row, now) === 'scheduled').length
    return <section className={`section ${styles.page}`}><div className="container">
      <div className={styles.heading}><div><p className="eyebrow">Defense Calendar</p><h1 className={styles.dayTitle}>{formatLongDate(selectedDate)}</h1></div><div className={styles.tools}><Link className="button button-secondary button-small" href={`/admin/dashboard?month=${selectedDate.slice(0, 7)}`}>← Calendar</Link><Link className="button button-secondary button-small" href="/admin/history">Full History</Link></div></div>
      {params.confirmed ? <div className="alert alert-success">Defense stage confirmed completed and retained on the calendar.</div> : null}
      {params.error ? <div className="alert alert-error">{params.error}</div> : null}
      {error ? <div className="alert alert-error">Defense schedules are temporarily unavailable. Please try again.</div> : null}
      <div className={styles.daySummary}><span><i className={styles.summaryScheduled}/>{scheduled} Scheduled</span><span><b>✓</b>{completed} Completed</span><span className={action ? styles.summaryAction : ''}><b>!</b>{action} Action Required</span></div>
      <ScheduleSection empty="No defenses are recorded on this date." id="day-defenses" rows={dayRows} title="All defenses" now={now}/>
    </div></section>
  }

  const active = rows.filter(row => stamp(row.defense_date, row.end_time) > now)
  const todayRows = active.filter(row => row.defense_date === today).sort((a, b) => stamp(a.defense_date, a.start_time) - stamp(b.defense_date, b.start_time))
  const upcoming = active.filter(row => row.defense_date !== today).sort((a, b) => stamp(a.defense_date, a.start_time) - stamp(b.defense_date, b.start_time))

  return <section className={`section ${styles.page}`}><div className="container"><div className={styles.heading}><p className="eyebrow">Defense Schedule</p><div className={styles.tools}><Link className="button button-secondary button-small" href="/admin/dashboard">Calendar</Link><Link className="button button-secondary button-small" href="/admin/history">Full History</Link></div></div>{params.confirmed ? <div className="alert alert-success">Defense stage confirmed completed and retained on the calendar.</div> : null}{params.error ? <div className="alert alert-error">{params.error}</div> : null}{error ? <div className="alert alert-error">Defense schedules are temporarily unavailable. Please try again.</div> : null}<ScheduleSection empty="No defenses remaining today." id="today" rows={todayRows} title="Today" now={now}/><ScheduleSection empty="No upcoming defenses are scheduled." id="upcoming" rows={upcoming} title="Upcoming" now={now}/></div></section>
}
