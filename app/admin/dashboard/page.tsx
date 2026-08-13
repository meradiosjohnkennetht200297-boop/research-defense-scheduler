import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logoutAdmin } from '../actions'
import { markDefenseCompleted } from './actions'

type DefenseType = 'title' | 'proposal' | 'final'
type ResearchGroupRow = {
  id: string
  public_code: string
  title: string
  program: string | null
  major: string | null
  defense_type: DefenseType | null
  contact_person: string
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
  submitted_at: string
}
type ScheduleGroup = {
  id: string
  public_code: string
  title: string
  defense_type: DefenseType | null
  status: string
}
type ScheduleRow = {
  id: string
  research_group_id: string
  defense_date: string
  start_time: string
  end_time: string
  is_published: boolean
  research_groups: ScheduleGroup | ScheduleGroup[] | null
}

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

function scheduleHasEnded(date: string, endTime: string) {
  return new Date(`${date}T${String(endTime).slice(0, 8)}+08:00`).getTime() <= Date.now()
}

function formatEndedAt(date: string, endTime: string) {
  const value = new Date(`${date}T${String(endTime).slice(0, 8)}+08:00`)
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(value)
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string; error?: string }>
}) {
  const params = await searchParams
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

  const [allCount, pendingCount, scheduledCount, facultyCount, recentGroups, scheduleResult] = await Promise.all([
    supabase.from('research_groups').select('*', { count: 'exact', head: true }),
    supabase.from('research_groups').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('research_groups').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
    supabase.from('faculty').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('research_groups')
      .select('id, public_code, title, program, major, defense_type, contact_person, status, submitted_at')
      .order('submitted_at', { ascending: false })
      .limit(20),
    supabase
      .from('defense_schedules')
      .select(`
        id,
        research_group_id,
        defense_date,
        start_time,
        end_time,
        is_published,
        research_groups (
          id,
          public_code,
          title,
          defense_type,
          status
        )
      `)
      .order('defense_date', { ascending: false })
      .order('end_time', { ascending: false }),
  ])

  const groups = (recentGroups.data ?? []) as ResearchGroupRow[]
  const scheduleRows = (scheduleResult.data ?? []) as ScheduleRow[]
  const confirmationQueue = scheduleRows.filter((schedule) => {
    const group = one(schedule.research_groups)
    return group?.status === 'scheduled' && scheduleHasEnded(schedule.defense_date, schedule.end_time)
  })

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading admin-heading">
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h2>Research defense management</h2>
            <p>Signed in as {adminProfile.display_name}</p>
          </div>
          <div className="admin-actions">
            <Link className="button button-secondary button-small" href="/admin/faculty">
              Manage Faculty
            </Link>
            <form action={logoutAdmin}>
              <button className="button button-secondary button-small" type="submit">Sign out</button>
            </form>
          </div>
        </div>

        {params.confirmed ? <div className="alert alert-success">Defense marked as completed.</div> : null}
        {params.error ? <div className="alert alert-error">{params.error}</div> : null}

        <div className="dashboard-grid dashboard-grid-four">
          <div className="card stat-card">
            <span>Total submissions</span>
            <strong>{allCount.count ?? 0}</strong>
          </div>
          <div className="card stat-card">
            <span>Pending</span>
            <strong>{pendingCount.count ?? 0}</strong>
          </div>
          <div className="card stat-card">
            <span>Scheduled</span>
            <strong>{scheduledCount.count ?? 0}</strong>
          </div>
          <Link className="card stat-card stat-link" href="/admin/faculty">
            <span>Active faculty</span>
            <strong>{facultyCount.count ?? 0}</strong>
            <small>Manage directory →</small>
          </Link>
        </div>

        {confirmationQueue.length > 0 ? (
          <div className="card confirmation-panel">
            <div className="confirmation-panel-head">
              <div>
                <p className="eyebrow">Action Required</p>
                <h3>Confirm ended defenses</h3>
                <p>These defenses have passed their scheduled end time and are already hidden from the public schedule.</p>
              </div>
              <span className="status-pill status-warning">{confirmationQueue.length} pending</span>
            </div>

            <div className="confirmation-list">
              {confirmationQueue.map((schedule) => {
                const group = one(schedule.research_groups)
                if (!group) return null

                return (
                  <div className="confirmation-item" key={schedule.id}>
                    <div>
                      <div className="schedule-labels">
                        <span className="code">{group.public_code}</span>
                        <span className="defense-type-pill">{defenseTypeLabel(group.defense_type)}</span>
                      </div>
                      <strong>{group.title}</strong>
                      <small>Ended {formatEndedAt(schedule.defense_date, schedule.end_time)}</small>
                    </div>
                    <div className="confirmation-actions">
                      <form action={markDefenseCompleted}>
                        <input name="groupId" type="hidden" value={group.id} />
                        <button className="button button-small" type="submit">Confirm Done</button>
                      </form>
                      <Link className="button button-secondary button-small" href={`/admin/groups/${group.id}?reschedule=1`}>
                        Reschedule
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Research title</th>
                <th>Defense</th>
                <th>Program</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={8}>No research submissions yet.</td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr key={group.id}>
                    <td><span className="code">{group.public_code}</span></td>
                    <td>
                      <Link className="table-link" href={`/admin/groups/${group.id}`}>
                        {group.title}
                      </Link>
                    </td>
                    <td>{defenseTypeLabel(group.defense_type)}</td>
                    <td>{group.program ? `${group.program}${group.major ? ` - ${group.major}` : ''}` : 'Not recorded'}</td>
                    <td>{group.contact_person}</td>
                    <td><span className={`status-pill status-${group.status}`}>{group.status}</span></td>
                    <td>{new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(group.submitted_at))}</td>
                    <td>
                      <Link className="button button-secondary button-small" href={`/admin/groups/${group.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
