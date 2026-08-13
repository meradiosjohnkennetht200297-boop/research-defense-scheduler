import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { saveDefenseSchedule } from './actions'
import PanelAssignmentPicker from './panel-assignment-picker'
import WorkspaceFormControls from './workspace-form-controls'
import CopyResearchLink from './copy-research-link'

type FacultyRow = { id: string; full_name: string; is_active: boolean }
type GroupMemberRow = { id: string; full_name: string; sort_order: number }
type PanelAssignmentRow = { faculty_id: string; panel_role: 'chair' | 'member'; sort_order: number }
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
      .select(`
        id,
        defense_date,
        start_time,
        end_time,
        venue,
        notes,
        is_published,
        panel_assignments (
          faculty_id,
          panel_role,
          sort_order
        )
      `)
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
  const panelAssignments = ((schedule?.panel_assignments ?? []) as PanelAssignmentRow[]).sort(
    (a, b) => a.sort_order - b.sort_order
  )

  const chairId = panelAssignments.find((assignment) => assignment.panel_role === 'chair')?.faculty_id ?? ''
  const memberIds = panelAssignments.filter((assignment) => assignment.panel_role === 'member').map((assignment) => assignment.faculty_id)
  const instructorName = group.instructor_id ? facultyNames.get(group.instructor_id) ?? 'Not found' : 'Not assigned'
  const adviserName = group.adviser_id ? facultyNames.get(group.adviser_id) ?? 'Not found' : 'Not assigned'
  const programLabel = group.program ? `${group.program}${group.major ? ` - ${group.major}` : ''}` : 'Not recorded'
  const currentDefenseType = (group.defense_type as DefenseType | null) ?? null
  const dateValue = schedule?.defense_date ?? ''
  const startValue = schedule?.start_time ? String(schedule.start_time).slice(0, 5) : ''
  const endValue = schedule?.end_time ? String(schedule.end_time).slice(0, 5) : ''
  const hasEnded = Boolean(schedule?.defense_date && schedule?.end_time && scheduleHasEnded(schedule.defense_date, schedule.end_time))
  const needsConfirmation = hasEnded && group.status === 'scheduled'

  return (
    <section className="section workspace-page">
      <div className="container workspace-layout">
        <div className="workspace-topbar workspace-refined-topbar">
          <div className="workspace-breadcrumbs">
            <Link href="/admin/groups">Research Groups</Link>
            <span aria-hidden="true">/</span>
            <span>{group.public_code}</span>
          </div>
          <Link className="button button-secondary button-small" href="/admin/groups">← Back to Research Groups</Link>
        </div>

        {saved ? <div className="alert alert-success">Schedule saved successfully. The latest assignment is now active.</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}
        {needsConfirmation ? (
          <div className="alert alert-warning">This defense has ended and is already hidden publicly. Confirm completion from the dashboard, or update the date and time below to reschedule.</div>
        ) : null}
        {reschedule ? <div className="alert alert-warning">Enter the new date and time, keep the status as Scheduled, then save the assignment.</div> : null}

        <div className="card workspace-research-header">
          <div className="workspace-research-heading">
            <div className="workspace-research-labels">
              <span className="code">{group.public_code}</span>
              <span className="defense-type-pill">{defenseTypeLabel(currentDefenseType)}</span>
              <span className={`status-pill status-${group.status}`}>{group.status}</span>
            </div>
            <h1>{group.title}</h1>
            <p>{programLabel} · Adviser: {adviserName}</p>
          </div>
          {group.research_file_url ? (
            <div className="workspace-file-actions">
              <a className="button workspace-open-file" href={group.research_file_url} rel="noopener noreferrer" target="_blank">Open Research File ↗</a>
              <CopyResearchLink url={group.research_file_url} />
              <small>Research files remain private from the public schedule.</small>
            </div>
          ) : (
            <div className="workspace-file-missing">No research file link was submitted for this earlier record.</div>
          )}
        </div>

        <div className="workspace-grid workspace-refined-grid">
          <aside className="workspace-side workspace-info-column">
            <div className="card info-card workspace-info-card">
              <div className="workspace-card-heading">
                <span className="workspace-card-icon" aria-hidden="true">i</span>
                <div><h3>Research information</h3><p>Submission details used when preparing the defense.</p></div>
              </div>
              <dl className="detail-list">
                <div><dt>Program</dt><dd>{programLabel}</dd></div>
                <div><dt>Defense type</dt><dd>{defenseTypeLabel(currentDefenseType)}</dd></div>
                <div><dt>Research instructor</dt><dd>{instructorName}</dd></div>
                <div><dt>Research adviser</dt><dd>{adviserName}</dd></div>
              </dl>
            </div>

            <div className="card info-card workspace-info-card">
              <div className="workspace-card-heading">
                <span className="workspace-card-icon" aria-hidden="true">#</span>
                <div><h3>Group members</h3><p>{members.length} {members.length === 1 ? 'member' : 'members'} recorded.</p></div>
              </div>
              {members.length ? <ol className="member-list workspace-member-list">{members.map((member) => <li key={member.id}>{member.full_name}</li>)}</ol> : <p className="muted-text">No group members recorded.</p>}
            </div>

            <div className="card info-card workspace-info-card">
              <div className="workspace-card-heading">
                <span className="workspace-card-icon" aria-hidden="true">@</span>
                <div><h3>Contact</h3><p>Administrative contact details.</p></div>
              </div>
              <dl className="detail-list">
                <div><dt>Contact person</dt><dd>{group.contact_person}</dd></div>
                {group.contact_email ? <div><dt>Email</dt><dd>{group.contact_email}</dd></div> : null}
                {group.contact_number ? <div><dt>Contact number</dt><dd>{group.contact_number}</dd></div> : null}
              </dl>
            </div>
          </aside>

          <form action={saveDefenseSchedule} className="card schedule-form workspace-refined-form">
            <input name="groupId" type="hidden" value={group.id} />

            <div className="workspace-form-header">
              <div>
                <p className="eyebrow">Defense Schedule</p>
                <h2>{schedule ? 'Edit defense assignment' : 'Create defense assignment'}</h2>
                <p>Set the schedule, assign panelists, then choose whether it should appear publicly.</p>
              </div>
              <span className={schedule?.is_published && !hasEnded ? 'status-pill status-published' : 'status-pill'}>
                {schedule?.is_published && !hasEnded ? 'Published' : hasEnded ? 'Ended' : 'Not published'}
              </span>
            </div>

            <section className="workspace-form-section">
              <div className="workspace-section-heading">
                <span className="workspace-section-number">1</span>
                <div><h3>Schedule details</h3><p>Defense type, date, time range, and venue.</p></div>
              </div>
              <div className="field-grid workspace-schedule-fields">
                <div className="field">
                  <label htmlFor="defenseType">Defense type <span className="required-mark">*</span></label>
                  <select defaultValue={currentDefenseType ?? ''} id="defenseType" name="defenseType" required>
                    <option value="">Select defense type</option>
                    <option value="title">Title Defense</option>
                    <option value="proposal">Proposal Defense</option>
                    <option value="final">Final Defense</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="defenseDate">Defense date <span className="required-mark">*</span></label>
                  <input defaultValue={dateValue} id="defenseDate" name="defenseDate" required type="date" />
                </div>
                <div className="field">
                  <label htmlFor="startTime">Start time <span className="required-mark">*</span></label>
                  <input defaultValue={startValue} id="startTime" name="startTime" required type="time" />
                </div>
                <div className="field">
                  <label htmlFor="endTime">End time <span className="required-mark">*</span></label>
                  <input defaultValue={endValue} id="endTime" name="endTime" required type="time" />
                  <p className="workspace-picker-help">This is also the automatic public-schedule cutoff.</p>
                </div>
                <div className="field full">
                  <label htmlFor="venue">Venue <span className="required-mark">*</span></label>
                  <input defaultValue={schedule?.venue ?? ''} id="venue" maxLength={180} name="venue" placeholder="e.g., AVR" required />
                </div>
              </div>
            </section>

            <section className="workspace-form-section">
              <div className="workspace-section-heading">
                <span className="workspace-section-number">2</span>
                <div><h3>Panel assignment</h3><p>Search by faculty name. Add only the member rows needed for this defense.</p></div>
              </div>
              <PanelAssignmentPicker
                faculty={activeFaculty.map(({ id, full_name }) => ({ id, full_name }))}
                initialChairId={chairId}
                initialMemberIds={memberIds}
              />
            </section>

            <section className="workspace-form-section">
              <div className="workspace-section-heading">
                <span className="workspace-section-number">3</span>
                <div><h3>Status and publication</h3><p>Control the research state and public visibility of the schedule.</p></div>
              </div>
              <div className="workspace-status-grid">
                <div className="field">
                  <label htmlFor="status">Research status</label>
                  <select defaultValue={schedule ? group.status : 'scheduled'} id="status" name="status">
                    <option value="pending">Pending</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <label className="workspace-publish-control" htmlFor="isPublished">
                  <input defaultChecked={schedule?.is_published ?? false} id="isPublished" name="isPublished" type="checkbox" />
                  <span className="workspace-publish-copy">
                    <strong>Publish on public schedule</strong>
                    <small>Only Scheduled defenses are published. They disappear automatically after the end time.</small>
                  </span>
                </label>
              </div>
              <div className="field workspace-notes-field">
                <label htmlFor="notes">Administrative notes <span className="optional-mark">Optional</span></label>
                <textarea defaultValue={schedule?.notes ?? ''} id="notes" maxLength={1000} name="notes" placeholder="Notes for the defense assignment" />
              </div>
            </section>

            <WorkspaceFormControls />
          </form>
        </div>
      </div>
    </section>
  )
}
