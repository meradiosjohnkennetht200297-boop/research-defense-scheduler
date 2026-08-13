import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CompleteDefenseForm from './complete-defense-form'

type DefenseType = 'title' | 'proposal' | 'final'
type ResearchStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled'
type ResearchGroupRow = {
  id: string
  public_code: string
  title: string
  program: string | null
  major: string | null
  defense_type: DefenseType | null
  status: ResearchStatus
  submitted_at: string
}
type ScheduleGroup = {
  id: string
  public_code: string
  title: string
  defense_type: DefenseType | null
  status: ResearchStatus
}
type FacultyName = { full_name: string }
type PanelAssignment = {
  panel_role: 'chair' | 'member'
  sort_order: number
  faculty: FacultyName | FacultyName[] | null
}
type ScheduleRow = {
  id: string
  research_group_id: string
  defense_date: string
  start_time: string
  end_time: string
  venue: string
  is_published: boolean
  research_groups: ScheduleGroup | ScheduleGroup[] | null
  panel_assignments: PanelAssignment[] | null
}

const STATUS_FILTERS = new Set<ResearchStatus>(['pending', 'scheduled', 'completed', 'cancelled'])

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function defenseTypeLabel(value: DefenseType | null) {
  if (value === 'title') return 'Title Defense'
  if (value === 'proposal') return 'Proposal Defense'
  if (value === 'final') return 'Final Defense'
  return 'Not recorded'
}

function scheduleTimestamp(date: string, time: string) {
  return new Date(`${date}T${String(time).slice(0, 8)}+08:00`).getTime()
}

function scheduleHasEnded(date: string, endTime: string) {
  return scheduleTimestamp(date, endTime) <= Date.now()
}

function formatScheduleDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatTime(value: string) {
  const [hourText, minuteText] = value.split(':')
  let hour = Number(hourText)
  const minute = minuteText ?? '00'
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (hour === 0) hour = 12
  return `${hour}:${minute} ${suffix}`
}

function formatEndedAt(date: string, endTime: string) {
  const value = new Date(`${date}T${String(endTime).slice(0, 8)}+08:00`)
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
  }).format(value)
}

function manilaTodayKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Manila',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export default async function AdminDashboard({ searchParams }: {
  searchParams: Promise<{ confirmed?: string; error?: string; status?: string }>
}) {
  const params = await searchParams
  const statusFilter = STATUS_FILTERS.has(params.status as ResearchStatus)
    ? (params.status as ResearchStatus)
    : null

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/admin')

  const { data: adminProfile } = await supabase
    .from('admin_profiles')
    .select('display_name, role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (!adminProfile) redirect('/admin')

  let recentGroupsQuery = supabase
    .from('research_groups')
    .select('id, public_code, title, program, major, defense_type, status, submitted_at')
    .order('submitted_at', { ascending: false })
    .limit(20)
  if (statusFilter) recentGroupsQuery = recentGroupsQuery.eq('status', statusFilter)

  const [allCount, pendingCount, scheduledCount, completedCount, recentGroups, scheduleResult] = await Promise.all([
    supabase.from('research_groups').select('*', { count: 'exact', head: true }),
    supabase.from('research_groups').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('research_groups').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
    supabase.from('research_groups').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    recentGroupsQuery,
    supabase
      .from('defense_schedules')
      .select(`
        id, research_group_id, defense_date, start_time, end_time, venue, is_published,
        research_groups ( id, public_code, title, defense_type, status ),
        panel_assignments (
          panel_role, sort_order,
          faculty ( full_name )
        )
      `)
      .order('defense_date', { ascending: true })
      .order('start_time', { ascending: true }),
  ])

  const groups = (recentGroups.data ?? []) as ResearchGroupRow[]
  const scheduleRows = (scheduleResult.data ?? []) as ScheduleRow[]
  const now = Date.now()
  const todayKey = manilaTodayKey()

  const confirmationQueue = scheduleRows.filter((schedule) => {
    const group = one(schedule.research_groups)
    return group?.status === 'scheduled' && scheduleHasEnded(schedule.defense_date, schedule.end_time)
  })

  const activeSchedules = scheduleRows
    .filter((schedule) => {
      const group = one(schedule.research_groups)
      return group?.status === 'scheduled' && scheduleTimestamp(schedule.defense_date, schedule.end_time) > now
    })
    .sort((a, b) => scheduleTimestamp(a.defense_date, a.start_time) - scheduleTimestamp(b.defense_date, b.start_time))

  const todaySchedules = activeSchedules.filter((schedule) => schedule.defense_date === todayKey)
  const upcomingSchedules = activeSchedules.slice(0, 5)

  const stats = [
    { label: 'Total submissions', value: allCount.count ?? 0, href: '/admin/groups', note: 'Browse all groups', tone: 'neutral' },
    { label: 'Pending', value: pendingCount.count ?? 0, href: '/admin/groups?status=pending', note: 'Needs scheduling', tone: 'pending' },
    { label: 'Scheduled', value: scheduledCount.count ?? 0, href: '/admin/groups?status=scheduled', note: 'View scheduled groups', tone: 'scheduled' },
    { label: 'Completed', value: completedCount.count ?? 0, href: '/admin/history', note: 'Open completion history', tone: 'completed' },
    {
      label: 'Action required', value: confirmationQueue.length,
      href: confirmationQueue.length ? '/admin/dashboard#action-required' : '/admin/dashboard#upcoming-defenses',
      note: confirmationQueue.length ? 'Confirm or reschedule' : 'Nothing waiting',
      tone: confirmationQueue.length ? 'warning' : 'clear',
    },
  ]

  return (
    <section className="section admin-dashboard-page">
      <div className="container">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h2>Research defense management</h2>
            <p className="dashboard-intro">Manage submissions, schedules, and follow-up actions from one workspace.</p>
          </div>
          <div className="admin-session-chip"><span>Signed in as</span><strong>{adminProfile.display_name}</strong></div>
        </div>

        {params.confirmed ? <div className="alert alert-success">Defense confirmed completed and added to history.</div> : null}
        {params.error ? <div className="alert alert-error">{params.error}</div> : null}

        <div className="dashboard-stats" aria-label="Research defense summary">
          {stats.map((stat) => (
            <Link className={`card dashboard-stat-card stat-${stat.tone}`} href={stat.href} key={stat.label}>
              <span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.note} →</small>
            </Link>
          ))}
        </div>

        {confirmationQueue.length > 0 ? (
          <section className="card confirmation-panel" id="action-required">
            <div className="confirmation-panel-head">
              <div>
                <p className="eyebrow">Action Required</p>
                <h3>Ended defenses awaiting confirmation</h3>
                <p>These defenses are already hidden from the public schedule. Confirm only those that actually finished. Otherwise, reschedule them.</p>
              </div>
              <span className="status-pill status-warning">{confirmationQueue.length} waiting</span>
            </div>

            <div className="confirmation-list">
              {confirmationQueue.map((schedule) => {
                const group = one(schedule.research_groups)
                if (!group) return null
                const panel = [...(schedule.panel_assignments ?? [])].sort((a, b) => a.sort_order - b.sort_order)
                const chair = panel.find((item) => item.panel_role === 'chair')
                const chairName = one(chair?.faculty)?.full_name ?? 'Not recorded'
                const memberCount = panel.filter((item) => item.panel_role === 'member').length

                return (
                  <div className="confirmation-item confirmation-item-refined" key={schedule.id}>
                    <div className="confirmation-copy">
                      <div className="schedule-labels">
                        <span className="code">{group.public_code}</span>
                        <span className="defense-type-pill">{defenseTypeLabel(group.defense_type)}</span>
                      </div>
                      <strong>{group.title}</strong>
                      <div className="ended-defense-meta">
                        <span><b>Ended</b>{formatEndedAt(schedule.defense_date, schedule.end_time)}</span>
                        <span><b>Venue</b>{schedule.venue}</span>
                        <span><b>Chair</b>{chairName}</span>
                        <span><b>Panel</b>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                      </div>
                    </div>
                    <div className="confirmation-actions confirmation-actions-refined">
                      <CompleteDefenseForm groupId={group.id} />
                      <Link className="button button-secondary button-small" href={`/admin/groups/${group.id}?reschedule=1`}>
                        Reschedule
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="dashboard-section" id="upcoming-defenses">
          <div className="dashboard-section-heading">
            <div><p className="eyebrow">Schedule Overview</p><h3>Today and upcoming defenses</h3></div>
            <Link className="button button-secondary button-small" href="/#schedule">Open Public Schedule ↗</Link>
          </div>

          <div className="dashboard-schedule-grid">
            <div className="card dashboard-panel">
              <div className="dashboard-panel-head">
                <div><span className="dashboard-panel-kicker">Today</span><strong>{todaySchedules.length} {todaySchedules.length === 1 ? 'defense' : 'defenses'}</strong></div>
                <span className="dashboard-date-label">{formatScheduleDate(todayKey)}</span>
              </div>
              {todaySchedules.length === 0 ? (
                <div className="dashboard-mini-empty"><strong>No defenses remaining today.</strong><span>Upcoming schedules will appear in the next panel.</span></div>
              ) : (
                <div className="dashboard-defense-list">
                  {todaySchedules.map((schedule) => {
                    const group = one(schedule.research_groups)
                    if (!group) return null
                    return (
                      <Link className="dashboard-defense-row" href={`/admin/groups/${group.id}`} key={schedule.id}>
                        <span className="dashboard-defense-time">{formatTime(schedule.start_time)}</span>
                        <span className="dashboard-defense-copy"><strong>{group.title}</strong><small>{defenseTypeLabel(group.defense_type)} · {schedule.venue}</small></span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="card dashboard-panel">
              <div className="dashboard-panel-head">
                <div><span className="dashboard-panel-kicker">Upcoming</span><strong>Next scheduled defenses</strong></div>
                <span className="dashboard-date-label">{upcomingSchedules.length} listed</span>
              </div>
              {upcomingSchedules.length === 0 ? (
                <div className="dashboard-mini-empty"><strong>No upcoming defenses.</strong><span>Schedule a pending research group to see it here.</span></div>
              ) : (
                <div className="dashboard-defense-list">
                  {upcomingSchedules.map((schedule, index) => {
                    const group = one(schedule.research_groups)
                    if (!group) return null
                    return (
                      <Link className="dashboard-defense-row" href={`/admin/groups/${group.id}`} key={schedule.id}>
                        <span className="dashboard-defense-date">{index === 0 ? <em>Next</em> : null}{formatScheduleDate(schedule.defense_date)}<small>{formatTime(schedule.start_time)}</small></span>
                        <span className="dashboard-defense-copy"><strong>{group.title}</strong><small>{defenseTypeLabel(group.defense_type)} · {schedule.venue}</small></span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="dashboard-section" id="research-groups">
          <div className="dashboard-section-heading">
            <div>
              <p className="eyebrow">Research Groups</p>
              <h3>{statusFilter ? `${statusFilter[0].toUpperCase()}${statusFilter.slice(1)} submissions` : 'Recent submissions'}</h3>
              <p>Showing up to 20 of the most recent matching research groups.</p>
            </div>
            <div className="dashboard-heading-actions">
              <Link className="button button-secondary button-small" href="/admin/groups">View All Groups</Link>
              {statusFilter ? <Link className="button button-secondary button-small" href="/admin/dashboard#research-groups">Clear Filter</Link> : null}
            </div>
          </div>

          <div className="card table-wrap dashboard-table-wrap">
            <table>
              <thead><tr><th>Research</th><th className="hide-mobile">Program</th><th>Defense</th><th>Status</th><th className="hide-mobile">Submitted</th><th>Action</th></tr></thead>
              <tbody>
                {groups.length === 0 ? <tr><td colSpan={6}>No research submissions match this view.</td></tr> : groups.map((group) => (
                  <tr key={group.id}>
                    <td className="research-cell"><span className="code">{group.public_code}</span><Link className="table-link" href={`/admin/groups/${group.id}`}>{group.title}</Link></td>
                    <td className="hide-mobile">{group.program ? `${group.program}${group.major ? ` - ${group.major}` : ''}` : 'Not recorded'}</td>
                    <td>{defenseTypeLabel(group.defense_type)}</td>
                    <td><span className={`status-pill status-${group.status}`}>{group.status}</span></td>
                    <td className="hide-mobile">{new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(group.submitted_at))}</td>
                    <td><Link className="button button-secondary button-small" href={`/admin/groups/${group.id}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  )
}
