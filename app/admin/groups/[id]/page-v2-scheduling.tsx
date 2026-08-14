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

export default async function ResearchGroupWorkspaceV2({
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
      .select('id, public_code, title, program, major, defense_type, research_file_url, contact_person, contact_email, contact_number, instructor_id, adviser_id, status')
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
  const recordLocked = group.status === 'completed' || group.status === 'cancelled'
  const statusLabel = group.status === 'cancelled' ? 'legacy cancelled' : group.status
  const scheduleState = schedule?.is_published && !hasEnded
    ? 'Published'
    : hasEnded
      ? 'Ended'
      : schedule
        ? 'Private'
        : 'Not scheduled'

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

        {saved ? <div className="alert alert-success">Schedule saved successfully.</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}
        {needsConfirmation ? (
          <div className="alert alert-warning">This defense has ended and is hidden publicly. Confirm completion from the dashboard, or update the schedule below.</div>
        ) : null}
        {reschedule && !recordLocked ? <div className="alert alert-warning">Update the date, time, venue, or panel, then save changes.</div> : null}

        <div className="card workspace-research-header">
          <div className="workspace-research-heading">
            <div className="workspace-research-labels">
              <span className="code">{group.public_code}</span>
              <span className="defense-type-pill">{defenseTypeLabel(currentDefenseType)}</span>
              <span className={`status-pill status-${group.status}`}>{statusLabel}</span>
            </div>
            <h1>{group.title}</h1>
            <p>{programLabel} · Adviser: {adviserName}</p>
          </div>

          <div className="workspace-file-actions">
            {group.research_file_url ? (
              <>
                <a className="button workspace-open-file" href={group.research_file_url} rel="noopener noreferrer" target="_blank">Open Research File ↗</a>
                <CopyResearchLink url={group.research_file_url} />
              </>
            ) : (
              <div className="workspace-file-missing">No research file submitted.</div>
            )}
            {recordLocked ? (
              <small>{group.status === 'completed' ? 'Completed record. Submission editing is disabled.' : 'Legacy Cancelled record. Editing is disabled.'}</small>
            ) : (
              <Link className="button button-secondary" href={`/admin/groups/${group.id}/edit`}>Edit Submission</Link>
            )}
          </div>
        </div>

        <div className="workspace-grid workspace-refined-grid">
          <aside className="workspace-side workspace-info-column">
            <div className="card info-card workspace-info-card">
              <div className="workspace-card-heading">
                <div><h3>Group members</h3><p>{members.length} {members.length === 1 ? 'member' : 'members'}</p></div>
              </div>
              {members.length ? <ol className="member-list workspace-member-list">{members.map((member) => <li key={member.id}>{member.full_name}</li>)}</ol> : <p className="muted-text">No group members recorded.</p>}
            </div>

            <div className="card info-card workspace-info-card">
              <div className="workspace-card-heading">
                <div><h3>Submission contact</h3></div>
              </div>
              <dl className="detail-list">
                <div><dt>Research instructor</dt><dd>{instructorName}</dd></div>
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
                <h2>{schedule ? 'Update schedule' : 'Schedule defense'}</h2>
                <p>{schedule ? 'Change the schedule or panel, then save.' : 'Set the schedule and assign the panel.'}</p>
              </div>
              <span className={schedule?.is_published && !hasEnded ? 'status-pill status-published' : 'status-pill'}>{scheduleState}</span>
            </div>

            {recordLocked ? <div className="workspace-lock-note">This record is protected. Schedule changes are disabled.</div> : null}

            <fieldset className="workspace-form-fieldset" disabled={recordLocked}>
              <section className="workspace-form-section">
                <div className="workspace-section-heading">
                  <div><h3>Schedule</h3><p>Date, time, venue, and defense type.</p></div>
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
                    <label htmlFor="defenseDate">Date <span className="required-mark">*</span></label>
                    <input defaultValue={dateValue} id="defenseDate" name="defenseDate" required type="date" />
                  </div>
                  <div className="field">
                    <label htmlFor="startTime">Start time <span className="required-mark">*</span></label>
                    <input defaultValue={startValue} id="startTime" name="startTime" required type="time" />
                  </div>
                  <div className="field">
                    <label htmlFor="endTime">End time <span className="required-mark">*</span></label>
                    <input defaultValue={endValue} id="endTime" name="endTime" required type="time" />
                    <p className="workspace-picker-help">Public visibility ends automatically at this time.</p>
                  </div>
                  <div className="field full">
                    <label htmlFor="venue">Venue <span className="required-mark">*</span></label>
                    <input defaultValue={schedule?.venue ?? ''} id="venue" maxLength={180} name="venue" placeholder="e.g., AVR" required />
                  </div>
                </div>
              </section>

              <section className="workspace-form-section">
                <div className="workspace-section-heading">
                  <div><h3>Panel</h3><p>Assign the chair and panel members.</p></div>
                </div>
                <PanelAssignmentPicker
                  faculty={activeFaculty.map(({ id: facultyId, full_name }) => ({ id: facultyId, full_name }))}
                  initialChairId={chairId}
                  initialMemberIds={memberIds}
                />
              </section>

              <section className="workspace-form-section">
                <div className="workspace-section-heading">
                  <div><h3>Public visibility</h3><p>Choose whether students can see this defense.</p></div>
                </div>
                <label className="workspace-publish-control" htmlFor="isPublished">
                  <input defaultChecked={schedule?.is_published ?? false} id="isPublished" name="isPublished" type="checkbox" />
                  <span className="workspace-publish-copy">
                    <strong>Show on public schedule</strong>
                    <small>Automatically hidden after the defense end time.</small>
                  </span>
                </label>
                <div className="field workspace-notes-field">
                  <label htmlFor="notes">Notes <span className="optional-mark">Optional</span></label>
                  <textarea defaultValue={schedule?.notes ?? ''} id="notes" maxLength={1000} name="notes" placeholder="Administrative notes" />
                </div>
              </section>
            </fieldset>

            <WorkspaceFormControls
              groupId={group.id}
              hasSchedule={Boolean(schedule)}
              locked={recordLocked}
              publicCode={group.public_code}
              status={group.status}
            />
          </form>
        </div>
      </div>
    </section>
  )
}
