'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useState } from 'react'
import { RESEARCH_DESIGN_OPTIONS } from '@/lib/research-design'
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
  if (stage === 'proposal') return 'Title Defense will be recorded as Completed.'
  if (stage === 'final') return 'Title and Proposal Defense will be recorded as Completed.'
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
  const [researchDesign, setResearchDesign] = useState('')
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
    const researchDesignOther = String(form.get('researchDesignOther') ?? '').trim()

    if (!String(form.get('title') ?? '').trim()) return setError('Enter the research title.')
    if (!program) return setError('Select the program.')
    if (majors.length && !String(form.get('major') ?? '')) return setError('Select the major.')
    if (!researchDesign) return setError('Select the research design.')
    if (researchDesign === 'other' && !researchDesignOther) return setError('Specify the research design.')
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
          researchDesign,
          researchDesignOther: researchDesign === 'other' ? researchDesignOther : '',
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
        <p className="eyebrow">Research Record Added</p>
        <h2>{stageLabel(success.currentStage)}</h2>
        <p>The existing research is now recorded and can continue through the normal defense workflow.</p>
        <div className={styles.codeBox}>
          <span>Private Research Code</span>
          <strong>{success.researchCode}</strong>
          <small>Give this code privately to the research group.</small>
        </div>
        <div className={styles.successActions}>
          <button className="button" onClick={copyCode} type="button">{copied ? 'Copied ✓' : 'Copy Research Code'}</button>
          <Link className="button button-secondary" href={`/admin/groups/${success.researchGroupId}`}>Open Research Record</Link>
          <button className="button button-secondary" onClick={() => window.location.reload()} type="button">Add Another</button>
        </div>
      </div>
    )
  }

  return (
    <form className={`card ${styles.form}`} onSubmit={submit}>
      {error ? <div className={`alert alert-error ${styles.formAlert}`} role="alert"><strong>{error}</strong>{conflicts.length ? <ul>{conflicts.map((item, index) => <li key={index}>{conflictText(item)}</li>)}</ul> : null}</div> : null}

      <div className={styles.columns}>
        <section className={styles.column}>
          <div className={styles.sectionHeading}><span>1</span><div><h2>Research</h2><p>Core information about the study.</p></div></div>
          <div className={styles.columnFields}>
            <div className="field"><label htmlFor="import-title">Research title <span className="required-mark">*</span></label><textarea id="import-title" name="title" maxLength={500} required rows={3} /></div>
            <div className="field"><label htmlFor="import-program">Program <span className="required-mark">*</span></label><select id="import-program" name="program" value={program} onChange={(event) => setProgram(event.target.value)} required><option value="">Select program</option><option value="BEED">BEED</option><option value="BSED">BSED</option><option value="BSA">BSA</option><option value="BSAIS">BSAIS</option><option value="BSBA">BSBA</option></select></div>
            {majors.length ? <div className="field"><label htmlFor="import-major">Major <span className="required-mark">*</span></label><select id="import-major" name="major" required><option value="">Select major</option>{majors.map((major) => <option key={major} value={major}>{major}</option>)}</select></div> : null}
            <div className="field"><label htmlFor="import-design">Research design <span className="required-mark">*</span></label><select id="import-design" value={researchDesign} onChange={(event) => setResearchDesign(event.target.value)} required><option value="">Select research design</option>{RESEARCH_DESIGN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            {researchDesign === 'other' ? <div className="field"><label htmlFor="import-design-other">Specify research design <span className="required-mark">*</span></label><input id="import-design-other" name="researchDesignOther" maxLength={120} required /></div> : null}
          </div>
        </section>

        <section className={styles.column}>
          <div className={styles.sectionHeading}><span>2</span><div><h2>Group & contact</h2><p>Researchers, faculty, contact, and manuscript.</p></div></div>
          <div className={styles.memberList}>
            {members.map((member, index) => (
              <div className={styles.memberRow} key={index}>
                <div className="field"><label htmlFor={`import-member-${index}`}>Member {index + 1}{index === 0 ? <span className="required-mark"> *</span> : null}</label><input id={`import-member-${index}`} value={member} onChange={(event) => setMembers((current) => current.map((value, i) => i === index ? event.target.value : value))} maxLength={150} /></div>
                <button aria-label={`Remove member ${index + 1}`} className={`button button-secondary button-small ${styles.removeButton}`} disabled={members.length === 1} onClick={() => setMembers((current) => current.filter((_, i) => i !== index))} type="button">×</button>
              </div>
            ))}
          </div>
          <button className={`button button-secondary button-small ${styles.addButton}`} disabled={members.length >= 20} onClick={() => setMembers((current) => [...current, ''])} type="button">+ Add Member</button>

          <div className={styles.columnFields}>
            <div className="field"><label htmlFor="import-instructor">Research instructor</label><select id="import-instructor" name="instructorId"><option value="">Not assigned</option>{instructors.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></div>
            <div className="field"><label htmlFor="import-adviser">Research adviser</label><select id="import-adviser" name="adviserId"><option value="">Not assigned</option>{advisers.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></div>
            <div className="field"><label htmlFor="import-contact">Contact person <span className="required-mark">*</span></label><input id="import-contact" name="contactPerson" maxLength={150} required /></div>
            <div className={styles.contactPair}>
              <div className="field"><label htmlFor="import-email">Email</label><input id="import-email" name="contactEmail" type="email" maxLength={254} /></div>
              <div className="field"><label htmlFor="import-number">Contact number</label><input id="import-number" name="contactNumber" maxLength={40} /></div>
            </div>
            <div className="field"><label htmlFor="import-file">Google Drive research file</label><input id="import-file" name="researchFileUrl" type="url" placeholder="https://drive.google.com/..." /></div>
          </div>
        </section>

        <section className={styles.column}>
          <div className={styles.sectionHeading}><span>3</span><div><h2>Current defense</h2><p>Record the current stage and schedule, if available.</p></div></div>
          <div className={styles.columnFields}>
            <div className="field"><label htmlFor="import-stage">Current defense stage <span className="required-mark">*</span></label><select id="import-stage" value={stage} onChange={(event) => setStage(event.target.value as Stage)}><option value="title">Title Defense</option><option value="proposal">Proposal Defense</option><option value="final">Final Defense</option></select><p className={styles.stageHelp}>{stageNote(stage)}</p></div>

            <label className={styles.scheduleToggle}><input type="checkbox" checked={hasSchedule} onChange={(event) => setHasSchedule(event.target.checked)} /><span><strong>Already scheduled</strong><small>Add the date, time, venue, and panel now.</small></span></label>

            {hasSchedule ? (
              <div className={styles.scheduleFields}>
                <div className={styles.timeGrid}>
                  <div className="field"><label htmlFor="import-date">Date <span className="required-mark">*</span></label><input id="import-date" name="defenseDate" type="date" /></div>
                  <div className="field"><label htmlFor="import-start">Start <span className="required-mark">*</span></label><input id="import-start" name="startTime" type="time" /></div>
                  <div className="field"><label htmlFor="import-end">End <span className="required-mark">*</span></label><input id="import-end" name="endTime" type="time" /></div>
                </div>
                <div className="field"><label htmlFor="import-venue">Venue <span className="required-mark">*</span></label><input id="import-venue" name="venue" maxLength={180} /></div>
                <div className="field"><label htmlFor="import-chair">Panel chair <span className="required-mark">*</span></label><select id="import-chair" name="chairId"><option value="">Select chair</option>{chairs.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></div>

                <div className={styles.panelMembers}>
                  {panelMembers.map((memberId, index) => (
                    <div className={styles.memberRow} key={index}>
                      <div className="field"><label htmlFor={`import-panel-${index}`}>Panel member {index + 1}</label><select id={`import-panel-${index}`} value={memberId} onChange={(event) => setPanelMembers((current) => current.map((value, i) => i === index ? event.target.value : value))}><option value="">Not assigned</option>{panelFaculty.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></div>
                      <button aria-label={`Remove panel member ${index + 1}`} className={`button button-secondary button-small ${styles.removeButton}`} disabled={panelMembers.length === 1} onClick={() => setPanelMembers((current) => current.filter((_, i) => i !== index))} type="button">×</button>
                    </div>
                  ))}
                  <button className={`button button-secondary button-small ${styles.addButton}`} disabled={panelMembers.length >= 4} onClick={() => setPanelMembers((current) => [...current, ''])} type="button">+ Add Panel Member</button>
                </div>

                <label className={styles.publishToggle}><input defaultChecked name="isPublished" type="checkbox" /><span><strong>Show on public schedule</strong><small>Research Code remains private.</small></span></label>
                <details className={styles.notesDisclosure}><summary>Administrative notes · Optional</summary><div className="field"><label className="sr-only" htmlFor="import-notes">Administrative notes</label><textarea id="import-notes" name="notes" maxLength={1000} rows={3} /></div></details>
              </div>
            ) : <div className={styles.pendingNote}>Current stage will be saved as <strong>Pending scheduling</strong>.</div>}
          </div>
        </section>
      </div>

      <div className={styles.actions}>
        <Link className="button button-secondary" href="/admin/groups">Cancel</Link>
        <button className="button" disabled={submitting} type="submit">{submitting ? 'Adding…' : 'Add Existing Research'}</button>
      </div>
    </form>
  )
}
