'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useState } from 'react'
import styles from './import.module.css'

type Faculty = {
  id: string
  full_name: string
  is_active: boolean
  can_teach_research: boolean
  can_advise: boolean
  can_chair: boolean
  can_serve_panel: boolean
}

type Stage = 'title' | 'proposal' | 'final'
type Success = { researchGroupId: string; researchCode: string; currentStage: Stage; status: string }

const BSED_MAJORS = ['English', 'Filipino', 'Mathematics', 'Science']
const BSBA_MAJORS = ['MM', 'FM', 'HRM']

function stageLabel(stage: Stage) {
  return stage === 'title' ? 'Title Defense' : stage === 'proposal' ? 'Proposal Defense' : 'Final Defense'
}

function stageNote(stage: Stage) {
  if (stage === 'proposal') return 'Title Defense will be saved as Completed. Proposal Defense becomes the current stage.'
  if (stage === 'final') return 'Title and Proposal Defense will be saved as Completed. Final Defense becomes the current stage.'
  return 'Title Defense becomes the current stage.'
}

function conflictText(value: unknown) {
  if (!value || typeof value !== 'object') return 'Schedule conflict.'
  const item = value as Record<string, unknown>
  if (item.kind === 'venue') return `Venue conflict${typeof item.venue === 'string' ? `: ${item.venue}` : ''}`
  if (item.kind === 'faculty') return `Faculty conflict${typeof item.faculty_name === 'string' ? `: ${item.faculty_name}` : ''}`
  if (typeof item.message === 'string') return item.message
  return 'Schedule conflict.'
}

export default function ExistingResearchImportForm({ faculty }: { faculty: Faculty[] }) {
  const [program, setProgram] = useState('')
  const [stage, setStage] = useState<Stage>('title')
  const [hasSchedule, setHasSchedule] = useState(false)
  const [members, setMembers] = useState([''])
  const [panelMembers, setPanelMembers] = useState([''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState<unknown[]>([])
  const [success, setSuccess] = useState<Success | null>(null)
  const [copied, setCopied] = useState(false)

  const instructors = useMemo(() => faculty.filter((person) => person.can_teach_research), [faculty])
  const advisers = useMemo(() => faculty.filter((person) => person.can_advise), [faculty])
  const chairs = useMemo(() => faculty.filter((person) => person.can_chair), [faculty])
  const panelFaculty = useMemo(() => faculty.filter((person) => person.can_serve_panel), [faculty])
  const majors = program === 'BSED' ? BSED_MAJORS : program === 'BSBA' ? BSBA_MAJORS : []

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setConflicts([])

    const form = new FormData(event.currentTarget)
    const cleanMembers = members.map((name) => name.trim()).filter(Boolean)
    const cleanPanelMembers = panelMembers.filter(Boolean)
    const chairId = String(form.get('chairId') ?? '')

    if (!String(form.get('title') ?? '').trim()) return setError('Enter the research title.')
    if (!program) return setError('Select the program.')
    if (majors.length && !String(form.get('major') ?? '')) return setError('Select the major.')
    if (!cleanMembers.length) return setError('Enter at least one group member.')
    if (!String(form.get('contactPerson') ?? '').trim()) return setError('Enter the contact person.')

    if (hasSchedule) {
      const start = String(form.get('startTime') ?? '')
      const end = String(form.get('endTime') ?? '')
      if (!String(form.get('defenseDate') ?? '')) return setError('Enter the defense date.')
      if (!start || !end || end <= start) return setError('End time must be later than start time.')
      if (!String(form.get('venue') ?? '').trim()) return setError('Enter the venue.')
      if (!chairId) return setError('Select the panel chair.')
      const assigned = [chairId, ...cleanPanelMembers]
      if (new Set(assigned).size !== assigned.length) return setError('A faculty member cannot appear more than once on the panel.')
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/import-existing-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: String(form.get('title') ?? ''),
          program,
          major: String(form.get('major') ?? ''),
          currentStage: stage,
          members: cleanMembers,
          instructorId: String(form.get('instructorId') ?? ''),
          adviserId: String(form.get('adviserId') ?? ''),
          contactPerson: String(form.get('contactPerson') ?? ''),
          contactEmail: String(form.get('contactEmail') ?? ''),
          contactNumber: String(form.get('contactNumber') ?? ''),
          researchFileUrl: String(form.get('researchFileUrl') ?? ''),
          hasSchedule,
          defenseDate: String(form.get('defenseDate') ?? ''),
          startTime: String(form.get('startTime') ?? ''),
          endTime: String(form.get('endTime') ?? ''),
          venue: String(form.get('venue') ?? ''),
          notes: String(form.get('notes') ?? ''),
          chairId,
          panelMemberIds: cleanPanelMembers,
          isPublished: Boolean(form.get('isPublished')),
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setConflicts(Array.isArray(result.conflicts) ? result.conflicts : [])
        throw new Error(result.error || 'Unable to add the existing research record.')
      }
      setSuccess(result as Success)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add the existing research record.')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyCode() {
    if (!success) return
    try {
      await navigator.clipboard.writeText(success.researchCode)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (success) {
    return (
      <div className={`card ${styles.success}`} aria-live="polite">
        <div className={styles.successMark}>✓</div>
        <p className="eyebrow">Existing Research Added</p>
        <h2>{stageLabel(success.currentStage)}</h2>
        <p>The lifecycle has been reconstructed and the group can now use the system normally.</p>
        <div className={styles.codeBox}>
          <span>Private Research Code</span>
          <strong>{success.researchCode}</strong>
          <small>Give this code privately to the research group.</small>
        </div>
        <div className={styles.successActions}>
          <button className="button" onClick={copyCode} type="button">{copied ? 'Copied ✓' : 'Copy Research Code'}</button>
          <Link className="button button-secondary" href={`/admin/groups/${success.researchGroupId}`}>Open Research Workspace</Link>
          <button className="button button-secondary" onClick={() => window.location.reload()} type="button">Add Another</button>
        </div>
      </div>
    )
  }

  return (
    <form className={`card ${styles.form}`} onSubmit={submit}>
      {error ? <div className="alert alert-error" role="alert"><strong>{error}</strong>{conflicts.length ? <ul>{conflicts.map((item, index) => <li key={index}>{conflictText(item)}</li>)}</ul> : null}</div> : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}><span>1</span><div><h2>Research</h2><p>Enter the current research record and where the group is now.</p></div></div>
        <div className="field-grid">
          <div className="field full"><label htmlFor="import-title">Research title <span className="required-mark">*</span></label><textarea id="import-title" name="title" maxLength={500} required /></div>
          <div className="field"><label htmlFor="import-program">Program <span className="required-mark">*</span></label><select id="import-program" name="program" value={program} onChange={(event) => setProgram(event.target.value)} required><option value="">Select program</option><option value="BEED">BEED</option><option value="BSED">BSED</option><option value="BSA">BSA</option><option value="BSAIS">BSAIS</option><option value="BSBA">BSBA</option></select></div>
          {majors.length ? <div className="field"><label htmlFor="import-major">Major <span className="required-mark">*</span></label><select id="import-major" name="major" required><option value="">Select major</option>{majors.map((major) => <option key={major} value={major}>{major}</option>)}</select></div> : null}
          <div className="field"><label htmlFor="import-stage">Current defense stage <span className="required-mark">*</span></label><select id="import-stage" value={stage} onChange={(event) => setStage(event.target.value as Stage)}><option value="title">Title Defense</option><option value="proposal">Proposal Defense</option><option value="final">Final Defense</option></select></div>
        </div>
        <div className={styles.stageNote}><strong>{stageLabel(stage)}</strong><span>{stageNote(stage)}</span></div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}><span>2</span><div><h2>Group & contact</h2><p>Add the members and the information the administrator needs.</p></div></div>
        <div className={styles.memberList}>
          {members.map((member, index) => (
            <div className={styles.memberRow} key={index}>
              <div className="field"><label htmlFor={`import-member-${index}`}>Member {index + 1}{index === 0 ? <span className="required-mark"> *</span> : null}</label><input id={`import-member-${index}`} value={member} onChange={(event) => setMembers((current) => current.map((value, i) => i === index ? event.target.value : value))} maxLength={150} /></div>
              <button className="button button-secondary button-small" disabled={members.length === 1} onClick={() => setMembers((current) => current.filter((_, i) => i !== index))} type="button">Remove</button>
            </div>
          ))}
        </div>
        <button className="button button-secondary button-small" disabled={members.length >= 20} onClick={() => setMembers((current) => [...current, ''])} type="button">+ Add Member</button>

        <div className={`field-grid ${styles.spacedGrid}`}>
          <div className="field"><label htmlFor="import-instructor">Research instructor</label><select id="import-instructor" name="instructorId"><option value="">Not assigned</option>{instructors.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></div>
          <div className="field"><label htmlFor="import-adviser">Research adviser</label><select id="import-adviser" name="adviserId"><option value="">Not assigned</option>{advisers.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></div>
          <div className="field"><label htmlFor="import-contact">Contact person <span className="required-mark">*</span></label><input id="import-contact" name="contactPerson" maxLength={150} required /></div>
          <div className="field"><label htmlFor="import-email">Email</label><input id="import-email" name="contactEmail" type="email" maxLength={254} /></div>
          <div className="field"><label htmlFor="import-number">Contact number</label><input id="import-number" name="contactNumber" maxLength={40} /></div>
          <div className="field full"><label htmlFor="import-file">Google Drive research file</label><input id="import-file" name="researchFileUrl" type="url" placeholder="https://drive.google.com/..." /></div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}><span>3</span><div><h2>Current defense</h2><p>Leave it pending, or enter the manual schedule you already prepared.</p></div></div>
        <label className={styles.scheduleToggle}><input type="checkbox" checked={hasSchedule} onChange={(event) => setHasSchedule(event.target.checked)} /><span><strong>This defense already has a schedule</strong><small>Turn this on to add the date, time, venue, and panel now.</small></span></label>

        {hasSchedule ? (
          <div className={styles.scheduleFields}>
            <div className="field-grid">
              <div className="field"><label htmlFor="import-date">Date <span className="required-mark">*</span></label><input id="import-date" name="defenseDate" type="date" /></div>
              <div className="field"><label htmlFor="import-start">Start time <span className="required-mark">*</span></label><input id="import-start" name="startTime" type="time" /></div>
              <div className="field"><label htmlFor="import-end">End time <span className="required-mark">*</span></label><input id="import-end" name="endTime" type="time" /></div>
              <div className="field"><label htmlFor="import-venue">Venue <span className="required-mark">*</span></label><input id="import-venue" name="venue" maxLength={180} /></div>
              <div className="field full"><label htmlFor="import-chair">Panel chair <span className="required-mark">*</span></label><select id="import-chair" name="chairId"><option value="">Select chair</option>{chairs.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></div>
            </div>

            <div className={styles.panelMembers}>
              {panelMembers.map((memberId, index) => (
                <div className={styles.memberRow} key={index}>
                  <div className="field"><label htmlFor={`import-panel-${index}`}>Panel member {index + 1}</label><select id={`import-panel-${index}`} value={memberId} onChange={(event) => setPanelMembers((current) => current.map((value, i) => i === index ? event.target.value : value))}><option value="">Not assigned</option>{panelFaculty.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></div>
                  <button className="button button-secondary button-small" disabled={panelMembers.length === 1} onClick={() => setPanelMembers((current) => current.filter((_, i) => i !== index))} type="button">Remove</button>
                </div>
              ))}
              <button className="button button-secondary button-small" disabled={panelMembers.length >= 4} onClick={() => setPanelMembers((current) => [...current, ''])} type="button">+ Add Panel Member</button>
            </div>

            <div className={`field-grid ${styles.spacedGrid}`}>
              <div className="field full"><label htmlFor="import-notes">Administrative notes</label><textarea id="import-notes" name="notes" maxLength={1000} /></div>
            </div>
            <label className={styles.publishToggle}><input defaultChecked name="isPublished" type="checkbox" /><span><strong>Show on public schedule</strong><small>The private Research Code will never be shown publicly.</small></span></label>
          </div>
        ) : <div className={styles.pendingNote}>The current stage will be created as <strong>Pending scheduling</strong>.</div>}
      </section>

      <div className={styles.actions}>
        <Link className="button button-secondary" href="/admin/groups">Cancel</Link>
        <button className="button" disabled={submitting} type="submit">{submitting ? 'Adding…' : 'Add Existing Research'}</button>
      </div>
    </form>
  )
}
