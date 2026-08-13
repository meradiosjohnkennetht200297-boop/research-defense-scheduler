'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import RoleFacultySearch, { SubmissionFaculty } from './role-faculty-search'

type Values = {
  title: string
  defenseType: string
  program: string
  major: string
  researchFileUrl: string
  contactPerson: string
  contactEmail: string
  contactNumber: string
  instructorId: string
  adviserId: string
}

const STEPS = ['Research', 'Group & Faculty', 'Contact & File', 'Review']
const BSED_MAJORS = ['English', 'Filipino', 'Mathematics', 'Science']
const BSBA_MAJORS = ['MM', 'FM', 'HRM']
const INITIAL_VALUES: Values = {
  title: '', defenseType: '', program: '', major: '', researchFileUrl: '',
  contactPerson: '', contactEmail: '', contactNumber: '', instructorId: '', adviserId: '',
}

function fileStatus(value: string) {
  if (!value.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname)
  } catch {
    return false
  }
}

function defenseLabel(value: string) {
  if (value === 'title') return 'Title Defense'
  if (value === 'proposal') return 'Proposal Defense'
  if (value === 'final') return 'Final Defense'
  return 'Not selected'
}

export default function SubmissionFormV3({ faculty }: { faculty: SubmissionFaculty[] }) {
  const [step, setStep] = useState(1)
  const [values, setValues] = useState<Values>(INITIAL_VALUES)
  const [members, setMembers] = useState(['', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [successCode, setSuccessCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const submittingRef = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)

  const majors = values.program === 'BSED' ? BSED_MAJORS : values.program === 'BSBA' ? BSBA_MAJORS : []
  const driveOk = fileStatus(values.researchFileUrl)
  const cleanMembers = members.map((member) => member.trim()).filter(Boolean)
  const instructorFaculty = useMemo(() => faculty.filter((person) => person.can_teach_research), [faculty])
  const adviserFaculty = useMemo(() => faculty.filter((person) => person.can_advise), [faculty])
  const instructorName = faculty.find((person) => person.id === values.instructorId)?.full_name ?? 'Not selected'
  const adviserName = faculty.find((person) => person.id === values.adviserId)?.full_name ?? 'Not selected'
  const programLabel = `${values.program || 'Not selected'}${values.major ? ` - ${values.major}` : ''}`
  const progress = ((step - 1) / 3) * 100

  useEffect(() => {
    if (!dirty || successCode) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty, successCode])

  function updateValue<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value }
      if (key === 'program' && value !== current.program) next.major = ''
      return next
    })
    setDirty(true)
    setReviewConfirmed(false)
    setError(null)
  }

  function updateMember(index: number, value: string) {
    setMembers((current) => current.map((member, i) => i === index ? value : member))
    setDirty(true)
    setReviewConfirmed(false)
    setError(null)
  }

  function validate(target: number) {
    if (target === 1) {
      if (!values.title.trim()) return 'Enter the research title.'
      if (!values.defenseType) return 'Select the defense type.'
      if (!values.program) return 'Select the program.'
      if (majors.length && !values.major) return 'Select the major.'
    }
    if (target === 2 && cleanMembers.length === 0) return 'Enter at least one group member.'
    if (target === 3) {
      if (!values.contactPerson.trim()) return 'Enter the contact person.'
      if (values.contactEmail && !/^\S+@\S+\.\S+$/.test(values.contactEmail)) return 'Enter a valid email address or leave it blank.'
      if (!values.researchFileUrl.trim()) return 'Paste the Google Drive or Google Docs research file link.'
      if (driveOk !== true) return 'Use a valid Google Drive or Google Docs link.'
    }
    return null
  }

  function goTo(target: number) {
    if (target > step) {
      for (let current = step; current < target; current += 1) {
        const issue = validate(current)
        if (issue) {
          setError(issue)
          return
        }
      }
    }
    setError(null)
    setReviewConfirmed(false)
    setStep(target)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    for (let current = 1; current <= 3; current += 1) {
      const issue = validate(current)
      if (issue) {
        setStep(current)
        setError(issue)
        return
      }
    }

    // Hard review gate: a form-submit event from Steps 1–3 can never send data.
    if (step !== 4) {
      setError(null)
      setReviewConfirmed(false)
      setStep(4)
      requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      return
    }

    if (!reviewConfirmed) {
      setError('Please review the information and confirm it before submitting.')
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title.trim(),
          defenseType: values.defenseType,
          program: values.program,
          major: values.major || null,
          researchFileUrl: values.researchFileUrl.trim(),
          contactPerson: values.contactPerson.trim(),
          contactEmail: values.contactEmail.trim(),
          contactNumber: values.contactNumber.trim(),
          instructorId: values.instructorId || null,
          adviserId: values.adviserId || null,
          members: cleanMembers,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Submission failed. Please try again.')
      setSuccessCode(result.publicCode)
      setDirty(false)
      setCopied(false)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Submission failed. Please try again.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function reset() {
    setValues(INITIAL_VALUES)
    setMembers(['', '', ''])
    setStep(1)
    setError(null)
    setDirty(false)
    setSubmitting(false)
    setReviewConfirmed(false)
    setSuccessCode(null)
    setCopied(false)
  }

  async function copyCode() {
    if (!successCode) return
    try {
      await navigator.clipboard.writeText(successCode)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (successCode) {
    return (
      <div className="card submission-success" aria-live="polite">
        <div className="submission-success-icon" aria-hidden="true">✓</div>
        <p className="eyebrow">Submission Received</p>
        <h2>Your research group was submitted.</h2>
        <p>Keep the reference code below. The administrator will use the submitted information when preparing the defense schedule.</p>
        <div className="reference-code-box"><span>Reference code</span><strong>{successCode}</strong></div>
        <div className="submission-success-actions">
          <button className="button" type="button" onClick={copyCode}>Copy Reference Code</button>
          <Link className="button button-secondary" href="/schedule">View Public Schedule</Link>
          <button className="button button-secondary" type="button" onClick={reset}>Submit Another Research</button>
        </div>
        <p className="copy-feedback">{copied ? '✓ Reference code copied.' : ''}</p>
      </div>
    )
  }

  return (
    <div className="submission-shell">
      <div className="submission-progress" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} aria-label={`Submission step ${step} of 4`} style={{ '--submission-progress': `${progress}%` } as React.CSSProperties}>
        {STEPS.map((label, index) => {
          const number = index + 1
          return <div className={`submission-step ${number === step ? 'active' : ''} ${number < step ? 'complete' : ''}`} key={label} aria-current={number === step ? 'step' : undefined}><span className="submission-step-number">{number < step ? '✓' : number}</span><span>{label}</span></div>
        })}
      </div>

      <form className="card submission-form" noValidate onSubmit={submit} ref={formRef}>
        <div className="submission-form-header">
          <div>
            <h2>{STEPS[step - 1]}</h2>
            <p>{step === 1 ? 'Enter the research and defense information.' : step === 2 ? 'Add the group members and research faculty.' : step === 3 ? 'Provide contact information and the research file.' : 'Review all information below. Nothing has been submitted yet.'}</p>
          </div>
          <span className="submission-step-count">Step {step} of 4</span>
        </div>

        {error ? <div className="submission-alert-wrap"><div className="alert alert-error" role="alert">{error}</div></div> : null}

        <div className="submission-form-body">
          {step === 1 ? <section><div className="field-grid">
            <div className="field full"><label htmlFor="title">Research title <span className="required-mark">*</span></label><textarea id="title" maxLength={500} value={values.title} onChange={(e) => updateValue('title', e.target.value)} /></div>
            <div className="field"><label htmlFor="defenseType">Defense type <span className="required-mark">*</span></label><select id="defenseType" value={values.defenseType} onChange={(e) => updateValue('defenseType', e.target.value)}><option value="">Select defense type</option><option value="title">Title Defense</option><option value="proposal">Proposal Defense</option><option value="final">Final Defense</option></select></div>
            <div className="field"><label htmlFor="program">Program <span className="required-mark">*</span></label><select id="program" value={values.program} onChange={(e) => updateValue('program', e.target.value)}><option value="">Select program</option><option value="BEED">BEED</option><option value="BSED">BSED</option><option value="BSA">BSA</option><option value="BSAIS">BSAIS</option><option value="BSBA">BSBA</option></select></div>
            {majors.length ? <div className="field"><label htmlFor="major">Major <span className="required-mark">*</span></label><select id="major" value={values.major} onChange={(e) => updateValue('major', e.target.value)}><option value="">Select major</option>{majors.map((major) => <option key={major} value={major}>{major}</option>)}</select></div> : null}
          </div></section> : null}

          {step === 2 ? <section>
            <div className="submission-section-intro"><h3>Group members</h3><p>Add every member. You can add up to 20 names.</p></div>
            <div className="submission-member-list">{members.map((member, index) => <div className="submission-member-row" key={index}><div className="field"><label htmlFor={`member-${index}`}>Member {index + 1}{index === 0 ? <span className="required-mark"> *</span> : null}</label><input id={`member-${index}`} value={member} maxLength={150} onChange={(e) => updateMember(index, e.target.value)} /></div><button type="button" className="button button-secondary submission-remove-member" disabled={members.length === 1} onClick={() => { setMembers((current) => current.filter((_, i) => i !== index)); setDirty(true); setReviewConfirmed(false) }}>−</button></div>)}</div>
            <button type="button" className="button button-secondary button-small submission-add-member" disabled={members.length >= 20} onClick={() => { setMembers((current) => [...current, '']); setDirty(true); setReviewConfirmed(false) }}>+ Add Member</button>
            <div className="submission-section-intro submission-subsection"><h3>Research faculty</h3><p>These fields may be left blank when not yet assigned.</p></div>
            <div className="field-grid">
              <RoleFacultySearch faculty={instructorFaculty} id="instructor-search" label="Research instructor" value={values.instructorId} onChange={(value) => updateValue('instructorId', value)} />
              <RoleFacultySearch faculty={adviserFaculty} id="adviser-search" label="Research adviser" value={values.adviserId} onChange={(value) => updateValue('adviserId', value)} />
            </div>
          </section> : null}

          {step === 3 ? <section>
            <div className="submission-section-intro"><h3>Contact information</h3><p>These details remain private.</p></div>
            <div className="field-grid">
              <div className="field"><label htmlFor="contactPerson">Contact person <span className="required-mark">*</span></label><input id="contactPerson" value={values.contactPerson} maxLength={150} onChange={(e) => updateValue('contactPerson', e.target.value)} /></div>
              <div className="field"><label htmlFor="contactEmail">Email <span className="optional-mark">Optional</span></label><input id="contactEmail" type="email" inputMode="email" value={values.contactEmail} maxLength={254} onChange={(e) => updateValue('contactEmail', e.target.value)} /></div>
              <div className="field"><label htmlFor="contactNumber">Contact number <span className="optional-mark">Optional</span></label><input id="contactNumber" inputMode="tel" value={values.contactNumber} maxLength={40} onChange={(e) => updateValue('contactNumber', e.target.value)} /></div>
            </div>
            <div className="submission-section-intro submission-subsection"><h3>Research file</h3><p>Provide the Google Drive or Google Docs link that the panel may access.</p></div>
            <div className="field"><label htmlFor="researchFileUrl">Google Drive research file link <span className="required-mark">*</span></label><input id="researchFileUrl" type="url" inputMode="url" value={values.researchFileUrl} maxLength={2048} placeholder="https://drive.google.com/..." onChange={(e) => updateValue('researchFileUrl', e.target.value)} />{driveOk === true ? <p className="submission-field-feedback valid">✓ Valid Google file link</p> : driveOk === false ? <p className="submission-field-feedback invalid">Use a drive.google.com or docs.google.com link.</p> : null}</div>
          </section> : null}

          {step === 4 ? <section className="submission-review">
            <div className="review-notice"><strong>Review before submitting.</strong><br />Nothing has been submitted yet. Check the details below, edit anything needed, then confirm at the bottom.</div>
            <div className="review-card"><div className="review-card-head"><h3>Research information</h3><button type="button" className="review-edit-button" onClick={() => goTo(1)}>Edit</button></div><dl className="review-grid"><div className="review-full"><dt>Research title</dt><dd>{values.title}</dd></div><div><dt>Defense type</dt><dd>{defenseLabel(values.defenseType)}</dd></div><div><dt>Program</dt><dd>{programLabel}</dd></div></dl></div>
            <div className="review-card"><div className="review-card-head"><h3>Group & faculty</h3><button type="button" className="review-edit-button" onClick={() => goTo(2)}>Edit</button></div><ul className="review-member-list">{cleanMembers.map((member, index) => <li key={`${member}-${index}`}>{member}</li>)}</ul><dl className="review-grid review-grid-spaced"><div><dt>Instructor</dt><dd>{instructorName}</dd></div><div><dt>Adviser</dt><dd>{adviserName}</dd></div></dl></div>
            <div className="review-card"><div className="review-card-head"><h3>Contact & research file</h3><button type="button" className="review-edit-button" onClick={() => goTo(3)}>Edit</button></div><dl className="review-grid"><div><dt>Contact person</dt><dd>{values.contactPerson}</dd></div><div><dt>Email</dt><dd>{values.contactEmail || 'Not provided'}</dd></div><div><dt>Contact number</dt><dd>{values.contactNumber || 'Not provided'}</dd></div><div className="review-full"><dt>Research file</dt><dd><a className="review-file-link" href={values.researchFileUrl} target="_blank" rel="noreferrer">Open Google Drive link ↗</a></dd></div></dl></div>
            <label className="review-confirm-control"><input type="checkbox" checked={reviewConfirmed} onChange={(e) => { setReviewConfirmed(e.target.checked); setError(null) }} /><span><strong>I reviewed the information above.</strong><small>I am ready to submit this research group for defense scheduling.</small></span></label>
          </section> : null}
        </div>

        <div className="submission-nav-actions">
          <span className="submission-required-note">{step === 4 ? 'Review required before submission' : <><span className="required-mark">*</span> Required field</>}</span>
          <div className="submission-nav-actions-right">
            {step > 1 ? <button className="button button-secondary" type="button" disabled={submitting} onClick={() => goTo(step - 1)}>Back</button> : null}
            {step < 3 ? <button className="button" type="button" onClick={() => goTo(step + 1)}>Continue</button> : null}
            {step === 3 ? <button className="button" type="button" onClick={() => goTo(4)}>Review Details</button> : null}
            {step === 4 ? <button className="button" type="submit" disabled={submitting || !reviewConfirmed}>{submitting ? 'Submitting…' : 'Submit Research'}</button> : null}
          </div>
        </div>
      </form>
    </div>
  )
}
