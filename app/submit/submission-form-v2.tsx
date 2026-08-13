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

const BSED_MAJORS = ['English', 'Filipino', 'Mathematics', 'Science']
const BSBA_MAJORS = ['MM', 'FM', 'HRM']
const STEPS = ['Research', 'Group & Faculty', 'Contact & File', 'Review']
const INITIAL_VALUES: Values = {
  title: '', defenseType: '', program: '', major: '', researchFileUrl: '',
  contactPerson: '', contactEmail: '', contactNumber: '', instructorId: '', adviserId: '',
}

function driveStatus(value: string) {
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

export default function SubmissionFormV2({ faculty }: { faculty: SubmissionFaculty[] }) {
  const [step, setStep] = useState(1)
  const [values, setValues] = useState<Values>(INITIAL_VALUES)
  const [members, setMembers] = useState(['', '', ''])
  const [submitting, setSubmitting] = useState(false)
  const [successCode, setSuccessCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [copied, setCopied] = useState(false)
  const submittingRef = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)

  const majors = values.program === 'BSED' ? BSED_MAJORS : values.program === 'BSBA' ? BSBA_MAJORS : []
  const fileStatus = driveStatus(values.researchFileUrl)
  const cleanMembers = members.map((member) => member.trim()).filter(Boolean)
  const instructorFaculty = useMemo(() => faculty.filter((person) => person.can_teach_research), [faculty])
  const adviserFaculty = useMemo(() => faculty.filter((person) => person.can_advise), [faculty])
  const instructorName = faculty.find((person) => person.id === values.instructorId)?.full_name ?? 'Not selected'
  const adviserName = faculty.find((person) => person.id === values.adviserId)?.full_name ?? 'Not selected'
  const programLabel = `${values.program || 'Not selected'}${values.major ? ` - ${values.major}` : ''}`
  const progress = ((step - 1) / (STEPS.length - 1)) * 100

  useEffect(() => {
    if (!dirty || successCode) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const linkGuard = (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank') return
      const destination = new URL(anchor.href, window.location.href)
      if (destination.pathname === window.location.pathname && destination.hash) return
      if (!window.confirm('You have an unfinished research submission. Leave this page?')) event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', linkGuard)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', linkGuard)
    }
  }, [dirty, successCode])

  function setValue<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value }
      if (key === 'program' && value !== current.program) next.major = ''
      return next
    })
    setDirty(true)
    setError(null)
  }

  function setMember(index: number, value: string) {
    setMembers((current) => current.map((member, i) => i === index ? value : member))
    setDirty(true)
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
      if (fileStatus !== true) return 'Use a valid Google Drive or Google Docs link.'
    }
    return null
  }

  function moveTo(target: number) {
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

    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title.trim(), defenseType: values.defenseType, program: values.program,
          major: values.major || null, researchFileUrl: values.researchFileUrl.trim(),
          contactPerson: values.contactPerson.trim(), contactEmail: values.contactEmail.trim(),
          contactNumber: values.contactNumber.trim(), instructorId: values.instructorId || null,
          adviserId: values.adviserId || null, members: cleanMembers,
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
    setSuccessCode(null)
    setError(null)
    setDirty(false)
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
          <Link className="button button-secondary" href="/#schedule">View Public Schedule</Link>
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
          <div><h2>{STEPS[step - 1]}</h2><p>{step === 1 ? 'Start with the research and defense information.' : step === 2 ? 'Add the members and choose faculty when applicable.' : step === 3 ? 'Provide a contact person and the panel-accessible research file.' : 'Check every detail before sending the submission.'}</p></div>
          <span className="submission-step-count">Step {step} of 4</span>
        </div>
        {error ? <div className="submission-alert-wrap"><div className="alert alert-error" role="alert">{error}</div></div> : null}

        <div className="submission-form-body">
          {step === 1 ? <section><div className="field-grid">
            <div className="field full"><label htmlFor="title">Research title <span className="required-mark">*</span></label><textarea id="title" maxLength={500} onChange={(e) => setValue('title', e.target.value)} placeholder="Enter the complete research title" value={values.title} /></div>
            <div className="field"><label htmlFor="defenseType">Defense type <span className="required-mark">*</span></label><select id="defenseType" onChange={(e) => setValue('defenseType', e.target.value)} value={values.defenseType}><option value="">Select defense type</option><option value="title">Title Defense</option><option value="proposal">Proposal Defense</option><option value="final">Final Defense</option></select></div>
            <div className="field"><label htmlFor="program">Program <span className="required-mark">*</span></label><select id="program" onChange={(e) => setValue('program', e.target.value)} value={values.program}><option value="">Select program</option><option value="BEED">BEED</option><option value="BSED">BSED</option><option value="BSA">BSA</option><option value="BSAIS">BSAIS</option><option value="BSBA">BSBA</option></select></div>
            {majors.length ? <div className="field"><label htmlFor="major">Major <span className="required-mark">*</span></label><select id="major" onChange={(e) => setValue('major', e.target.value)} value={values.major}><option value="">Select major</option>{majors.map((major) => <option key={major} value={major}>{major}</option>)}</select></div> : null}
          </div></section> : null}

          {step === 2 ? <section>
            <div className="submission-section-intro"><h3>Group members</h3><p>Add every member. You can add up to 20 names.</p></div>
            <div className="submission-member-list">{members.map((member, index) => <div className="submission-member-row" key={index}><div className="field"><label htmlFor={`member-${index}`}>Member {index + 1}{index === 0 ? <span className="required-mark"> *</span> : null}</label><input id={`member-${index}`} maxLength={150} onChange={(e) => setMember(index, e.target.value)} placeholder="Full name" value={member} /></div><button aria-label={`Remove member ${index + 1}`} className="button button-secondary submission-remove-member" disabled={members.length === 1} onClick={() => { setMembers((current) => current.filter((_, i) => i !== index)); setDirty(true) }} type="button">−</button></div>)}</div>
            <button className="button button-secondary button-small submission-add-member" disabled={members.length >= 20} onClick={() => { setMembers((current) => [...current, '']); setDirty(true) }} type="button">+ Add Member</button>
            <div className="submission-section-intro submission-subsection"><h3>Research faculty</h3><p>Only active faculty enabled for each role appear. These fields may be left blank when not yet assigned.</p></div>
            <div className="field-grid">
              <RoleFacultySearch faculty={instructorFaculty} id="instructor-search" label="Research instructor" onChange={(value) => setValue('instructorId', value)} value={values.instructorId} />
              <RoleFacultySearch faculty={adviserFaculty} id="adviser-search" label="Research adviser" onChange={(value) => setValue('adviserId', value)} value={values.adviserId} />
            </div>
          </section> : null}

          {step === 3 ? <section>
            <div className="submission-section-intro"><h3>Contact information</h3><p>Contact details are for administrative use and are not shown on the public schedule.</p></div>
            <div className="field-grid">
              <div className="field"><label htmlFor="contactPerson">Contact person <span className="required-mark">*</span></label><input id="contactPerson" maxLength={150} onChange={(e) => setValue('contactPerson', e.target.value)} value={values.contactPerson} /></div>
              <div className="field"><label htmlFor="contactEmail">Email address <span className="optional-mark">Optional</span></label><input id="contactEmail" inputMode="email" maxLength={254} onChange={(e) => setValue('contactEmail', e.target.value)} type="email" value={values.contactEmail} /></div>
              <div className="field"><label htmlFor="contactNumber">Contact number <span className="optional-mark">Optional</span></label><input id="contactNumber" inputMode="tel" maxLength={40} onChange={(e) => setValue('contactNumber', e.target.value)} value={values.contactNumber} /></div>
            </div>
            <div className="submission-section-intro submission-subsection"><h3>Research file</h3><p>Provide the Google Drive or Google Docs file/folder that the panel may access.</p></div>
            <div className="field"><label htmlFor="researchFileUrl">Google Drive research file link <span className="required-mark">*</span></label><input className={fileStatus === true ? 'input-valid' : fileStatus === false ? 'input-invalid' : ''} id="researchFileUrl" inputMode="url" maxLength={2048} onChange={(e) => setValue('researchFileUrl', e.target.value)} placeholder="https://drive.google.com/..." type="url" value={values.researchFileUrl} />{fileStatus === true ? <p className="submission-field-feedback valid">✓ Valid Google file link</p> : fileStatus === false ? <p className="submission-field-feedback invalid">Use a drive.google.com or docs.google.com link.</p> : null}<div className="drive-access-callout"><span aria-hidden="true">i</span><div><strong>Make sure panelists can view the file.</strong><small>Set the file or folder to Viewer access for the people who need it before submitting.</small></div></div></div>
          </section> : null}

          {step === 4 ? <section className="submission-review">
            <div className="review-card"><div className="review-card-head"><h3>Research information</h3><button className="review-edit-button" onClick={() => moveTo(1)} type="button">Edit</button></div><dl className="review-grid"><div className="review-full"><dt>Research title</dt><dd>{values.title}</dd></div><div><dt>Defense type</dt><dd>{defenseLabel(values.defenseType)}</dd></div><div><dt>Program</dt><dd>{programLabel}</dd></div></dl></div>
            <div className="review-card"><div className="review-card-head"><h3>Group & faculty</h3><button className="review-edit-button" onClick={() => moveTo(2)} type="button">Edit</button></div><ul className="review-member-list">{cleanMembers.map((member) => <li key={member}>{member}</li>)}</ul><dl className="review-grid review-grid-spaced"><div><dt>Instructor</dt><dd>{instructorName}</dd></div><div><dt>Adviser</dt><dd>{adviserName}</dd></div></dl></div>
            <div className="review-card"><div className="review-card-head"><h3>Contact & research file</h3><button className="review-edit-button" onClick={() => moveTo(3)} type="button">Edit</button></div><dl className="review-grid"><div><dt>Contact person</dt><dd>{values.contactPerson}</dd></div><div><dt>Email</dt><dd>{values.contactEmail || 'Not provided'}</dd></div><div><dt>Contact number</dt><dd>{values.contactNumber || 'Not provided'}</dd></div><div className="review-full"><dt>Research file</dt><dd><a className="review-file-link" href={values.researchFileUrl} rel="noreferrer" target="_blank">Open Google Drive link ↗</a></dd></div></dl></div>
            <div className="review-notice">Review the information carefully. After submission, scheduling details will be managed by the administrator.</div>
          </section> : null}
        </div>

        <div className="submission-nav-actions"><span className="submission-required-note"><span className="required-mark">*</span> Required field</span><div className="submission-nav-actions-right">{step > 1 ? <button className="button button-secondary" disabled={submitting} onClick={() => moveTo(step - 1)} type="button">Back</button> : null}{step < 4 ? <button className="button" onClick={() => moveTo(step + 1)} type="button">Continue</button> : <button className="button" disabled={submitting} type="submit">{submitting ? 'Submitting…' : 'Submit Research'}</button>}</div></div>
      </form>
    </div>
  )
}
