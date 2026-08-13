import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { saveDefenseSchedule } from './actions'

type FacultyRow = {
  id: string
  full_name: string
  is_active: boolean
}

type GroupMemberRow = {
  id: string
  full_name: string
  sort_order: number
}

type PanelAssignmentRow = {
  faculty_id: string
  panel_role: 'chair' | 'member'
  sort_order: number
}

type DefenseType = 'title' | 'proposal' | 'final'

function defenseTypeLabel(value: DefenseType | null) {
  if (value === 'title') return 'Title Defense'
  if (value === 'proposal') return 'Proposal Defense'
  if (value === 'final') return 'Final Defense'
  return 'Not recorded'
}

function scheduleHasEnded(date: string, endTime: string) {
  return new Date(`${date}T${String(endTime).slice(0, 8)}+08:00`).getTime() <= Date.now()
}

export default async function ResearchGroupWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string; reschedule?: string }>
}) {
  const { id } = await params
  const { error, saved, reschedule } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (!userId) redirect('/admin')

  const { data: adminProfile } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!adminProfile) redirect('/admin')

  const [groupResult, membersResult, scheduleResult, facultyResult] = await Promise.all([
    supabase
      .from('research_groups')
      .select('id, public_code, title, program, major, defense_type, research_file_url, contact_person, contact_email, contact_number, instructor_id, adviser_id, status, submitted_at')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('group_members')
      .select('id, full_name, sort_order')
      .eq('research_group_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('defense_schedules')
      .select('id, defense_date, start_time, end_time, venue, notes, is_published')
      .eq('research_group_id', id)
      .maybeSingle(),
    supabase
      .from('faculty')
      .select('id, full_name, is_active')
      .order('full_name', { ascending: true }),
  ])

  const group = groupResult.data
  if (!group) notFound()

  const members = (membersResult.data ?? []) as GroupMemberRow[]
  const faculty = (facultyResult.data ?? []) as FacultyRow[]
  const activeFaculty = faculty.filter((person) => person.is_active)
  const facultyNames = new Map(faculty.map((person) => [person.id, person.full_name]))
  const schedule = scheduleResult.data

  let panelAssignments: PanelAssignmentRow[] = []
  if (schedule?.id) {
    const { data } = await supabase
      .from('panel_assignments')
      .select('faculty_id, panel_role, sort_order')
      .eq('defense_schedule_id', schedule.id)
      .order('sort_order', { ascending: true })
    panelAssignments = (data ?? []) as PanelAssignmentRow[]
  }

  const chairId = panelAssignments.find((assignment) => assignment.panel_role === 'chair')?.faculty_id ?? ''
  const memberIds = panelAssignments
    .filter((assignment) => assignment.panel_role === 'member')
    .map((assignment) => assignment.faculty_id)

  const instructorName = group.instructor_id ? facultyNames.get(group.instructor_id) ?? 'Not found' : 'Not assigned'
  const adviserName = group.adviser_id ? facultyNames.get(group.adviser_id) ?? 'Not found' : 'Not assigned'
  const programLabel = group.program ? `${group.program}${group.major ? ` - ${group.major}` : ''}` : 'Not recorded'
  const currentDefenseType = (group.defense_type as DefenseType | null) ?? null
  const dateValue = schedule?.defense_date ?? ''
  const startValue = schedule?.start_time ? String(schedule.start_time).slice(0, 5) : ''
  const endValue = schedule?.end_time ? String(schedule.end_time).slice(0, 5) : ''
  const hasEnded = Boolean(
    schedule?.defense_date && schedule?.end_time && scheduleHasEnded(schedule.defense_date, schedule.end_time)
  )
  const needsConfirmation = hasEnded && group.status === 'scheduled'

  return (
    <section className="section">
      <div className="container workspace-layout">
        <div className="workspace-topbar">
          <Link className="button button-secondary button-small" href="/admin/dashboard">
            ← Dashboard
          </Link>
          <span className="code">{group.public_code}</span>
        </div>

        {saved ? <div className="alert alert-success">Defense schedule saved successfully.</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}
        {needsConfirmation ? (
          <div className="alert alert-warning">
            This defense has reached its scheduled end time and is no longer shown publicly. If it was completed, confirm it from the dashboard. If it did not proceed, enter a new date and time below and save to reschedule it.
          </div>
        ) : null}
        {reschedule ? (
          <div className="alert alert-warning">
            Update the date and time below, keep the status as Scheduled, then save the schedule.
          </div>
        ) : null}

        <div className="workspace-grid">
          <aside className="workspace-side">
            <div className="card info-card">
              <p className="eyebrow">Research Group</p>
              <h2>{group.title}</h2>

              {group.research_file_url ? (
                <a
                  className="button button-secondary button-small research-file-button"
                  href={group.research_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Research File ↗
                </a>
              ) : (
                <p className="muted-text">No research file link was submitted for this earlier record.</p>
              )}

              <dl className="detail-list">
                <div>
                  <dt>Status</dt>
                  <dd><span className={`status-pill status-${group.status}`}>{group.status}</span></dd>
                </div>
                <div>
                  <dt>Defense type</dt>
                  <dd>{defenseTypeLabel(currentDefenseType)}</dd>
                </div>
                <div>
                  <dt>Program</dt>
                  <dd>{programLabel}</dd>
                </div>
                <div>
                  <dt>Research instructor</dt>
                  <dd>{instructorName}</dd>
                </div>
                <div>
                  <dt>Research adviser</dt>
                  <dd>{adviserName}</dd>
                </div>
                <div>
                  <dt>Contact person</dt>
                  <dd>{group.contact_person}</dd>
                </div>
                {group.contact_email ? (
                  <div>
                    <dt>Email</dt>
                    <dd>{group.contact_email}</dd>
                  </div>
                ) : null}
                {group.contact_number ? (
                  <div>
                    <dt>Contact number</dt>
                    <dd>{group.contact_number}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="card info-card">
              <h3>Group members</h3>
              {members.length ? (
                <ol className="member-list">
                  {members.map((member) => <li key={member.id}>{member.full_name}</li>)}
                </ol>
              ) : (
                <p className="muted-text">No group members recorded.</p>
              )}
            </div>
          </aside>

          <form action={saveDefenseSchedule} className="card schedule-form">
            <input name="groupId" type="hidden" value={group.id} />

            <div className="schedule-form-head">
              <div>
                <p className="eyebrow">Defense Schedule</p>
                <h2>{schedule ? 'Edit defense assignment' : 'Create defense assignment'}</h2>
              </div>
              <span className={schedule?.is_published && !hasEnded ? 'status-pill status-published' : 'status-pill'}>
                {schedule?.is_published && !hasEnded ? 'Published' : hasEnded ? 'Ended' : 'Not published'}
              </span>
            </div>

            <div className="form-section compact-section">
              <h3>Defense type, date, time, and venue</h3>
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="defenseType">Defense type</label>
                  <select defaultValue={currentDefenseType ?? ''} id="defenseType" name="defenseType" required>
                    <option value="">Select defense type</option>
                    <option value="title">Title Defense</option>
                    <option value="proposal">Proposal Defense</option>
                    <option value="final">Final Defense</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="defenseDate">Defense date</label>
                  <input defaultValue={dateValue} id="defenseDate" name="defenseDate" required type="date" />
                </div>
                <div className="field">
                  <label htmlFor="startTime">Start time</label>
                  <input defaultValue={startValue} id="startTime" name="startTime" required type="time" />
                </div>
                <div className="field">
                  <label htmlFor="endTime">End time</label>
                  <input defaultValue={endValue} id="endTime" name="endTime" required type="time" />
                </div>
                <div className="field full">
                  <label htmlFor="venue">Venue</label>
                  <input defaultValue={schedule?.venue ?? ''} id="venue" maxLength={180} name="venue" placeholder="e.g., AVR" required />
                </div>
              </div>
            </div>

            <div className="form-section compact-section">
              <h3>Panel assignment</h3>
              <p>Select one chair and, when needed, up to four panel members. Leave unused member slots blank.</p>

              <div className="field full-width-field">
                <label htmlFor="chairId">Panel chair</label>
                <select defaultValue={chairId} id="chairId" name="chairId" required>
                  <option value="">Select panel chair</option>
                  {activeFaculty.map((person) => (
                    <option key={person.id} value={person.id}>{person.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="field-grid panel-member-grid">
                {[0, 1, 2, 3].map((index) => (
                  <div className="field" key={index}>
                    <label htmlFor={`member-${index}`}>Panel member {index + 1}</label>
                    <select defaultValue={memberIds[index] ?? ''} id={`member-${index}`} name="memberIds">
                      <option value="">None</option>
                      {activeFaculty.map((person) => (
                        <option key={person.id} value={person.id}>{person.full_name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-section compact-section">
              <h3>Status and publication</h3>
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="status">Research status</label>
                  <select defaultValue={schedule ? group.status : 'scheduled'} id="status" name="status">
                    <option value="pending">Pending</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <label className="publish-toggle" htmlFor="isPublished">
                  <input defaultChecked={schedule?.is_published ?? false} id="isPublished" name="isPublished" type="checkbox" />
                  <span>
                    <strong>Publish schedule</strong>
                    <small>Show this defense publicly until its scheduled end time.</small>
                  </span>
                </label>
              </div>

              <div className="field notes-field">
                <label htmlFor="notes">Administrative notes</label>
                <textarea defaultValue={schedule?.notes ?? ''} id="notes" maxLength={1000} name="notes" placeholder="Optional notes for the defense assignment" />
              </div>
            </div>

            <div className="form-actions schedule-actions">
              <p className="form-note">Ended published schedules are hidden automatically. If a defense does not proceed, change its date and time here to reschedule it.</p>
              <button className="button" type="submit">Save Schedule</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
