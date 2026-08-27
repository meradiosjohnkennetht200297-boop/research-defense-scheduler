import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { researchDesignLabel } from '@/lib/research-design'
import { saveDefenseSchedule } from './actions'
import PanelAssignmentPicker from './panel-assignment-picker'
import WorkspaceFormControls from './workspace-form-controls'
import CopyResearchLink from './copy-research-link'
import StudentAccessKeyControl from './student-access-key-control'

type FacultyRow = { id: string; full_name: string; is_active: boolean }
type GroupMemberRow = { id: string; full_name: string; sort_order: number }
type PanelAssignmentRow = { faculty_id: string; panel_role: 'chair' | 'member'; sort_order: number }
type ScheduleRow = { id: string; defense_date: string; start_time: string; end_time: string; venue: string | null; notes: string | null; is_published: boolean; panel_assignments: PanelAssignmentRow[] | null }
type DefenseRow = { id: string; defense_type: 'title' | 'proposal' | 'final' | null; status: string; requested_at: string; completed_at: string | null; defense_schedules: ScheduleRow[] | ScheduleRow | null }

const STAGES = ['title', 'proposal', 'final'] as const

function one<T>(value: T | T[] | null | undefined): T | null {
  return !value ? null : Array.isArray(value) ? value[0] ?? null : value
}

function defenseTypeLabel(value: string | null) {
  return value === 'title' ? 'Title Defense' : value === 'proposal' ? 'Proposal Defense' : value === 'final' ? 'Final Defense' : 'Defense type not recorded'
}

function scheduleHasEnded(date: string, endTime: string) {
  return new Date(`${date}T${String(endTime).slice(0, 8)}+08:00`).getTime() <= Date.now()
}

function stageDate(defense: DefenseRow | undefined) {
  const schedule = one(defense?.defense_schedules)
  if (!schedule) return null
  const [year, month, day] = schedule.defense_date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}

export default async function ResearchGroupWorkspaceV4({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string; reschedule?: string }>
}) {
  const { id } = await params
  const { error, saved, reschedule } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/admin')

  const { data: adminProfile } = await supabase.from('admin_profiles').select('user_id').eq('user_id', userId).eq('is_active', true).maybeSingle()
  if (!adminProfile) redirect('/admin')

  const [groupResult, membersResult, defensesResult, facultyResult] = await Promise.all([
    supabase.from('research_groups').select('id, public_code, title, program, major, research_design, research_design_other, research_file_url, contact_person, contact_email, contact_number, instructor_id, adviser_id, status, defense_type, access_key_created_at').eq('id', id).maybeSingle(),
    supabase.from('group_members').select('id, full_name, sort_order').eq('research_group_id', id).order('sort_order'),
    supabase.from('research_defenses').select(`id, defense_type, status, requested_at, completed_at, defense_schedules (id, defense_date, start_time, end_time, venue, notes, is_published, panel_assignments (faculty_id, panel_role, sort_order))`).eq('research_group_id', id).order('requested_at', { ascending: false }),
    supabase.from('faculty').select('id, full_name, is_active').order('full_name'),
  ])

  const group = groupResult.data
  if (!group) notFound()

  const members = (membersResult.data ?? []) as GroupMemberRow[]
  const defenses = (defensesResult.data ?? []) as DefenseRow[]
  const currentDefense = defenses[0] ?? null
  const schedule = one(currentDefense?.defense_schedules)
  const faculty = (facultyResult.data ?? []) as FacultyRow[]
  const activeFaculty = faculty.filter((person) => person.is_active)
  const facultyNames = new Map(faculty.map((person) => [person.id, person.full_name]))
  const panelAssignments = [...((schedule?.panel_assignments ?? []) as PanelAssignmentRow[])].sort((a, b) => a.sort_order - b.sort_order)
  const chairId = panelAssignments.find((assignment) => assignment.panel_role === 'chair')?.faculty_id ?? ''
  const memberIds = panelAssignments.filter((assignment) => assignment.panel_role === 'member').map((assignment) => assignment.faculty_id)
  const instructorName = group.instructor_id ? facultyNames.get(group.instructor_id) ?? 'Not found' : 'Not assigned'
  const adviserName = group.adviser_id ? facultyNames.get(group.adviser_id) ?? 'Not found' : 'Not assigned'
  const programLabel = group.program ? `${group.program}${group.major ? ` · ${group.major}` : ''}` : 'Program not recorded'
  const designLabel = researchDesignLabel(group.research_design, group.research_design_other)
  const currentType = currentDefense?.defense_type ?? null
  const stageStatus = currentDefense?.status ?? group.status
  const hasEnded = Boolean(schedule?.defense_date && schedule?.end_time && scheduleHasEnded(schedule.defense_date, schedule.end_time))
  const needsConfirmation = Boolean(currentDefense?.status === 'scheduled' && hasEnded)
  const schedulable = Boolean(currentDefense && ['pending', 'scheduled'].includes(currentDefense.status))
  const scheduleState = schedule?.is_published && !hasEnded ? 'Published' : hasEnded ? 'Ended' : schedule ? 'Private' : 'Not scheduled'
  const totalSchedules = defenses.filter((defense) => one(defense.defense_schedules)).length
  const canDeleteRecord = group.status === 'pending' && defenses.length === 1 && totalSchedules === 0
  const dateValue = schedule?.defense_date ?? ''
  const startValue = schedule?.start_time ? String(schedule.start_time).slice(0, 5) : ''
  const endValue = schedule?.end_time ? String(schedule.end_time).slice(0, 5) : ''
  const stageMap = new Map<string, DefenseRow>()
  for (const defense of defenses) if (defense.defense_type) stageMap.set(defense.defense_type, defense)

  return (
    <section className="section workspace-page workspace-focus-page">
      <div className="container workspace-layout workspace-focus-layout">
        <div className="workspace-topbar workspace-refined-topbar">
          <div className="workspace-breadcrumbs"><Link href="/admin/groups">Research Records</Link><span aria-hidden="true">/</span><span>{group.public_code}</span></div>
          <Link className="button button-secondary button-small" href="/admin/groups">← Back to Research Records</Link>
        </div>

        {saved ? <div className="alert alert-success">Schedule saved successfully.</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}
        {needsConfirmation ? <div className="alert alert-warning">This defense has ended and still needs admin confirmation. Confirm completion from the Dashboard, or reschedule it below.</div> : null}
        {reschedule && schedulable ? <div className="alert alert-warning">Update the schedule or panel, then save the changes.</div> : null}

        <article className="card workspace-compact-summary">
          <div className="workspace-summary-primary">
            <div className="workspace-research-labels">
              <span className="code">{group.public_code}</span>
              <span className="defense-type-pill">{defenseTypeLabel(currentType)}</span>
              <span className={`status-pill status-${stageStatus}`}>{stageStatus}</span>
            </div>
            <div className="workspace-summary-title">
              <h1>{group.title}</h1>
              <p>{programLabel} · Adviser: {adviserName}</p>
            </div>
            <div className="workspace-summary-actions">
              {group.research_file_url ? <>
                <a className="button workspace-open-file" href={group.research_file_url} rel="noopener noreferrer" target="_blank">Open Manuscript ↗</a>
                <CopyResearchLink url={group.research_file_url} />
              </> : <span className="workspace-file-missing">No manuscript submitted.</span>}
              {schedulable ? <Link className="button button-secondary button-small" href={`/admin/groups/${group.id}/edit`}>Edit Submission</Link> : null}
            </div>
          </div>

          <details className="workspace-summary-details">
            <summary><span>Research details</span><small>Progress, members, contacts, and Research Code</small></summary>
            <div className="workspace-summary-detail-grid">
              <section className="workspace-summary-block">
                <div className="workspace-card-heading"><div><h3>Defense progress</h3><p>Current research lifecycle</p></div></div>
                <div className="workspace-stage-progress">
                  {STAGES.map((stage) => {
                    const record = stageMap.get(stage)
                    return <div className="workspace-stage-row" key={stage}>
                      <strong>{defenseTypeLabel(stage)}</strong>
                      <span className={`status-pill${record?.status === 'completed' ? ' status-completed' : record?.status === 'scheduled' ? ' status-published' : ''}`}>{record?.status ?? 'Not requested'}</span>
                      <small>{stageDate(record) ?? ''}</small>
                    </div>
                  })}
                  {defenses.some((defense) => !defense.defense_type) ? <div className="workspace-stage-row"><strong>Legacy defense</strong><span className="status-pill">Type not recorded</span><small>Admin correction required before future progression.</small></div> : null}
                </div>
              </section>

              <section className="workspace-summary-block">
                <div className="workspace-card-heading"><div><h3>Group members</h3><p>{members.length} {members.length === 1 ? 'member' : 'members'}</p></div></div>
                {members.length ? <ol className="member-list workspace-member-list">{members.map((member) => <li key={member.id}>{member.full_name}</li>)}</ol> : <p className="muted-text">No group members recorded.</p>}
              </section>

              <section className="workspace-summary-block">
                <div className="workspace-card-heading"><div><h3>Submission details</h3><p>Research and contact information</p></div></div>
                <dl className="detail-list">
                  <div><dt>Research design</dt><dd>{designLabel}</dd></div>
                  <div><dt>Research instructor</dt><dd>{instructorName}</dd></div>
                  <div><dt>Contact person</dt><dd>{group.contact_person}</dd></div>
                  {group.contact_email ? <div><dt>Email</dt><dd>{group.contact_email}</dd></div> : null}
                  {group.contact_number ? <div><dt>Contact number</dt><dd>{group.contact_number}</dd></div> : null}
                </dl>
              </section>

              <section className="workspace-summary-block workspace-code-block">
                <StudentAccessKeyControl groupId={group.id} hasAccessKey={Boolean(group.access_key_created_at)} publicCode={group.public_code} />
              </section>
            </div>
          </details>
        </article>

        {schedulable && currentDefense ? (
          <form action={saveDefenseSchedule} className="card schedule-form workspace-refined-form workspace-compact-desktop-form">
            <input name="groupId" type="hidden" value={group.id} />
            <input name="defenseId" type="hidden" value={currentDefense.id} />
            {currentType ? <input name="defenseType" type="hidden" value={currentType} /> : null}

            <div className="workspace-form-header workspace-focus-form-header">
              <div><p className="eyebrow">Defense Schedule</p><h2>{schedule ? `Update ${defenseTypeLabel(currentType)}` : `Schedule ${defenseTypeLabel(currentType)}`}</h2><p>Set the schedule and assign the panel in one workspace.</p></div>
              <span className={schedule?.is_published && !hasEnded ? 'status-pill status-published' : 'status-pill'}>{scheduleState}</span>
            </div>

            <div className="workspace-desktop-form-grid">
              <section className="workspace-form-column workspace-schedule-column">
                <div className="workspace-section-heading"><div><h3>Schedule</h3><p>Date, time, venue, and visibility.</p></div></div>

                {!currentType ? <div className="field workspace-legacy-stage"><label htmlFor="defenseTypeDisplay">Defense stage <span className="required-mark">*</span></label><select id="defenseTypeDisplay" name="defenseType" defaultValue=""><option value="">Select legacy defense type</option><option value="title">Title Defense</option><option value="proposal">Proposal Defense</option><option value="final">Final Defense</option></select></div> : null}

                <div className="workspace-compact-schedule-fields">
                  <div className="field workspace-field-date"><label htmlFor="defenseDate">Date <span className="required-mark">*</span></label><input defaultValue={dateValue} id="defenseDate" name="defenseDate" required type="date" /></div>
                  <div className="field workspace-field-time"><label htmlFor="startTime">Start time <span className="required-mark">*</span></label><input defaultValue={startValue} id="startTime" name="startTime" required type="time" /></div>
                  <div className="field workspace-field-time"><label htmlFor="endTime">End time <span className="required-mark">*</span></label><input defaultValue={endValue} id="endTime" name="endTime" required type="time" /></div>
                </div>

                <div className="field workspace-field-venue"><label htmlFor="venue">Venue</label><input defaultValue={schedule?.venue ?? ''} id="venue" maxLength={180} name="venue" /></div>

                <div className="workspace-compact-options">
                  <label className="workspace-publish-control workspace-focus-publish" htmlFor="isPublished">
                    <input defaultChecked={schedule?.is_published ?? false} id="isPublished" name="isPublished" type="checkbox" />
                    <span className="workspace-publish-copy"><strong>Show on public schedule</strong><small>Published defenses remain visible after completion.</small></span>
                  </label>

                  <details className="workspace-inline-disclosure workspace-focus-notes" open={Boolean(schedule?.notes)}>
                    <summary>Administrative notes {schedule?.notes ? '· Added' : '· Optional'}</summary>
                    <div className="workspace-inline-disclosure-body"><div className="field workspace-notes-field"><label htmlFor="notes">Notes</label><textarea defaultValue={schedule?.notes ?? ''} id="notes" maxLength={1000} name="notes" /></div></div>
                  </details>
                </div>
              </section>

              <section className="workspace-form-column workspace-panel-column">
                <div className="workspace-section-heading"><div><h3>Panel</h3><p>Assign the chair and panel members.</p></div></div>
                <PanelAssignmentPicker faculty={activeFaculty.map(({ id: facultyId, full_name }) => ({ id: facultyId, full_name }))} initialChairId={chairId} initialMemberIds={memberIds} />
              </section>
            </div>

            <WorkspaceFormControls canDeleteRecord={canDeleteRecord} groupId={group.id} hasSchedule={Boolean(schedule)} locked={false} publicCode={group.public_code} stageStatus={currentDefense.status} />
          </form>
        ) : (
          <div className="card workspace-refined-form workspace-no-active-stage">
            <p className="eyebrow">Defense Schedule</p>
            <h2>{currentDefense?.defense_type === 'final' && currentDefense.status === 'completed' ? 'Research cycle completed' : 'Waiting for the next defense request'}</h2>
            <p>{currentDefense?.status === 'completed' ? 'The previous defense is protected. Students can continue this research from the submission page using their private Research Code when they are ready for the next stage.' : 'There is no schedulable defense stage for this research.'}</p>
            <Link className="button button-secondary button-small" href="/status">View Student Status</Link>
          </div>
        )}
      </div>
    </section>
  )
}
