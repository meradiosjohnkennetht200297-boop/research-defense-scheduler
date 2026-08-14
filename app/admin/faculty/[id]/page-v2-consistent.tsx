import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteFacultyRecord, toggleFacultyRecord, updateFacultyRecord } from '../directory-actions'
import styles from '../faculty.module.css'

type FacultyRow = {
  id: string
  full_name: string
  email: string | null
  department: string | null
  is_active: boolean
  can_serve_panel: boolean
  can_chair: boolean
  can_advise: boolean
  can_teach_research: boolean
}

type ResearchReference = { id: string; status: string }
type PanelReference = { defense_schedule_id: string }

function capabilityLabels(person: FacultyRow) {
  const labels: string[] = []
  if (person.can_serve_panel) labels.push('Panel')
  if (person.can_chair) labels.push('Chair')
  if (person.can_advise) labels.push('Adviser')
  if (person.can_teach_research) labels.push('Research Instructor')
  return labels
}

export default async function FacultyRecordPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { id } = await params
  const query = await searchParams
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

  const [facultyResult, researchResult, panelResult] = await Promise.all([
    supabase.from('faculty')
      .select('id, full_name, email, department, is_active, can_serve_panel, can_chair, can_advise, can_teach_research')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('research_groups')
      .select('id, status')
      .or(`instructor_id.eq.${id},adviser_id.eq.${id}`),
    supabase.from('panel_assignments')
      .select('defense_schedule_id')
      .eq('faculty_id', id),
  ])

  if (facultyResult.error) redirect('/admin/faculty?error=Faculty%20record%20could%20not%20be%20loaded.')
  const person = facultyResult.data as FacultyRow | null
  if (!person) notFound()

  const researchRefs = (researchResult.data ?? []) as ResearchReference[]
  const panelRefs = (panelResult.data ?? []) as PanelReference[]
  const scheduleIds = [...new Set(panelRefs.map((row) => row.defense_schedule_id).filter(Boolean))]
  let panelScheduled = false
  let panelScheduleFailed = false

  if (scheduleIds.length) {
    const scheduleResult = await supabase.from('defense_schedules')
      .select('id, research_groups!inner(status)')
      .in('id', scheduleIds)
      .eq('research_groups.status', 'scheduled')
      .limit(1)
    panelScheduled = (scheduleResult.data?.length ?? 0) > 0
    panelScheduleFailed = Boolean(scheduleResult.error)
  }

  const referenceCheckFailed = Boolean(researchResult.error || panelResult.error || panelScheduleFailed)
  const hasAnyReference = researchRefs.length > 0 || panelRefs.length > 0
  const hasScheduledAssignment = researchRefs.some((row) => row.status === 'scheduled') || panelScheduled
  const roles = capabilityLabels(person)

  const statusReason = referenceCheckFailed
    ? 'The system could not verify all current assignments, so status changes are temporarily blocked.'
    : hasScheduledAssignment
      ? 'This faculty member is attached to a scheduled defense. Reassign or complete that defense before deactivating.'
      : null

  const deleteReason = referenceCheckFailed
    ? 'The system could not verify the complete faculty history, so permanent deletion is temporarily blocked.'
    : hasAnyReference
      ? 'This faculty member has research or defense history. Historical faculty records cannot be permanently deleted.'
      : null

  return (
    <section className={`section ${styles.recordPage}`}>
      <div className="container">
        <div className={styles.topbar}>
          <div className={styles.breadcrumbs}>
            <Link href="/admin/faculty">Faculty</Link>
            <span aria-hidden="true">/</span>
            <span>{person.full_name}</span>
          </div>
          <Link className="button button-secondary button-small" href="/admin/faculty">← Back to Faculty</Link>
        </div>

        {query.success ? <div className="alert alert-success">{query.success}</div> : null}
        {query.error ? <div className="alert alert-error">{query.error}</div> : null}

        <div className={`card ${styles.recordHeader}`}>
          <div>
            <span className={person.is_active ? 'status-pill status-published' : 'status-pill'}>{person.is_active ? 'Active' : 'Inactive'}</span>
            <h1>{person.full_name}</h1>
            <p>{person.department || 'Department not set'}{person.email ? ` · ${person.email}` : ''}</p>
          </div>
          <div className={styles.badges} aria-label="Faculty capabilities">
            {roles.length ? roles.map((role) => <span className={styles.badge} key={role}>{role}</span>) : <span className={styles.noRoles}>No defense roles enabled</span>}
          </div>
        </div>

        <div className={styles.recordGrid}>
          <form action={updateFacultyRecord} className={`card ${styles.editCard}`}>
            <input name="id" type="hidden" value={person.id} />
            <div className={styles.sectionHeading}>
              <p className="eyebrow">Faculty Information</p>
              <h2>Edit faculty record</h2>
              <p>Changes to capabilities affect future faculty selections. Existing historical assignments remain recorded.</p>
            </div>

            <div className={styles.editGrid}>
              <div className={`field ${styles.full}`}>
                <label htmlFor="faculty-name">Full name</label>
                <input defaultValue={person.full_name} id="faculty-name" maxLength={150} name="fullName" required />
              </div>
              <div className="field">
                <label htmlFor="faculty-email">Email <span className="optional-mark">Optional</span></label>
                <input defaultValue={person.email ?? ''} id="faculty-email" maxLength={254} name="email" type="email" />
              </div>
              <div className="field">
                <label htmlFor="faculty-department">Department / unit <span className="optional-mark">Optional</span></label>
                <input defaultValue={person.department ?? ''} id="faculty-department" maxLength={120} name="department" />
              </div>
            </div>

            <div className={styles.capabilityBox}>
              <strong>Capabilities</strong>
              <label className={styles.check}><input defaultChecked={person.can_serve_panel} name="canServePanel" type="checkbox" /> Can serve as Panel Member</label>
              <label className={styles.check}><input defaultChecked={person.can_chair} name="canChair" type="checkbox" /> Can serve as Chair</label>
              <label className={styles.check}><input defaultChecked={person.can_advise} name="canAdvise" type="checkbox" /> Can serve as Research Adviser</label>
              <label className={styles.check}><input defaultChecked={person.can_teach_research} name="canTeachResearch" type="checkbox" /> Can teach Research</label>
            </div>

            <button className="button" type="submit">Save Changes</button>
          </form>

          <aside className={`card ${styles.recordOptions}`}>
            <div className={styles.sectionHeading}>
              <p className="eyebrow">Record Options</p>
              <h2>Manage faculty status</h2>
              <p>Status management and permanent deletion always appear here. Unavailable actions stay visible with the reason shown below.</p>
            </div>

            <div className={styles.option}>
              <strong>{person.is_active ? 'Deactivate faculty' : 'Activate faculty'}</strong>
              <p>{person.is_active
                ? 'Deactivate this faculty member to remove them from new selections while preserving past records.'
                : 'Activate this faculty member to make them available for new eligible assignments again.'}</p>

              {person.is_active ? (
                statusReason ? (
                  <>
                    <button className="button button-secondary" disabled type="button">Deactivate Faculty</button>
                    <p>{statusReason}</p>
                  </>
                ) : (
                  <form action={toggleFacultyRecord}>
                    <input name="id" type="hidden" value={person.id} />
                    <input name="nextActive" type="hidden" value="false" />
                    <button className="button button-secondary" type="submit">Deactivate Faculty</button>
                  </form>
                )
              ) : (
                <form action={toggleFacultyRecord}>
                  <input name="id" type="hidden" value={person.id} />
                  <input name="nextActive" type="hidden" value="true" />
                  <button className="button" type="submit">Activate Faculty</button>
                </form>
              )}
            </div>

            <div className={`${styles.option} ${styles.dangerOption}`}>
              <strong>Delete permanently</strong>
              <p>Permanent deletion is available only when the faculty member has never been referenced in any research or defense record.</p>

              {deleteReason ? (
                <>
                  <button className={styles.deleteButton} disabled type="button">Delete Permanently</button>
                  <p>{deleteReason}</p>
                </>
              ) : (
                <form action={deleteFacultyRecord} className={styles.deleteForm}>
                  <input name="id" type="hidden" value={person.id} />
                  <div className="field">
                    <label htmlFor="delete-confirmation">Type <strong>{person.full_name}</strong> to confirm</label>
                    <input autoComplete="off" id="delete-confirmation" name="confirmation" required />
                  </div>
                  <button className={styles.deleteButton} type="submit">Delete Permanently</button>
                </form>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
