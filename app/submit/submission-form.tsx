'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

type Faculty = { id: string; full_name: string }
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

function googleFileStatus(value: string) {
  if (!value.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname)
  } catch {
    return false
  }
}

function defenseTypeLabel(value: string) {
  if (value === 'title') return 'Title Defense'
  if (value === 'proposal') return 'Proposal Defense'
  if (value === 'final') return 'Final Defense'
  return 'Not selected'
}

function FacultySearch({
  id, label, faculty, value, onChange,
}: {
  id: string
  label: string
  faculty: Faculty[]
  value: string
  onChange: (value: string) => void
}) {
  const selectedName = faculty.find((person) => person.id === value)?.full_name ?? ''
  const [query, setQuery] = useState(selectedName)
  const listId = `${id}-options`

  useEffect(() => {
    setQuery(selectedName)
  }, [selectedName])

  function changeQuery(next: string) {
    setQuery(next)
    const match = faculty.find((person) => person.full_name.toLowerCase() === next.trim().toLowerCase())
    onChange(match?.id ?? '')
  }

  const typedButNotSelected = Boolean(query.trim() && !value)

  return (
    <div className="field faculty-search-field">
      <label htmlFor={id}>{label} <span className="optional-mark">Optional</span></label>
      <input
        id={id}
        list={listId}
        value={query}
        onChange={(event) => changeQuery(event.target.value)}
        placeholder={faculty.length ? 'Type a faculty name' : 'Faculty list unavailable'}
        disabled={faculty.length === 0}
        autoComplete="off"
      />
      <datalist id={listId}>
        {faculty.map((person) => <option key={person.id} value={person.full_name} />)}
      </datalist>
      {typedButNotSelected ? (
        <p className="submission-field-feedback invalid">Choose the exact name from the suggestions.</p>
      ) : value ? (
        <p className="submission-field-feedback valid">✓ Faculty selected</p>
      ) : (
        <p className="submission-field-help">Start typing to search the faculty directory.</p>
      )}
    </div>
  )
}

export default function SubmissionForm({ faculty }: { faculty: Faculty[] }) {
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

  const majorOptions = values.program === 'BSED' ? BSED_MAJORS : values.program === 'BSBA' ? BSBA_MAJORS : []
  const driveStatus = googleFileStatus(values.researchFileUrl)
  const cleanMembers = members.map((member) => member.trim()).filter(Boolean)
  const instructorName = faculty.find((person) => person.id === values.instructorId)?.full_name ?? 'Not selected'
  const adviserName = faculty.find((person) => person.id === values.adviserId)?.full_name ?? 'Not selected'
  const programLabel = `${values.program || 'Not selected'}${values.major ? ` - ${values.major}` : ''}`

  const progress = useMemo(() => ((step - 1) / (STEPS.length - 1)) * 100, [step])

  useEffect(() => {
    if (!dirty || successCode) return

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const internalLink = (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank') return
      const destination = new URL(anchor.href, window.location.href)
      if (destination.pathname === window.location.pathname && destination.hash) return
      if (!window.confirm('You have an unfinished research submission. Leave this page?')) event.preventDefault()
    }

    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', internalLink)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', internalLink)
    }
  }, [dirty, successCode])

  function updateValue<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value }
      if (key === 'program' && value !== 'BSED' && value !== 'BSBA') next.major = ''
      if (key === 'program' && value !== current.program) next.major = ''
      return next
    })
    setDirty(true)
    setError(null)
  }

  function updateMember(index: number, value: string) {
    setMembers((current) => current.map((member, i) => (i === index ? value : member)))
    setDirty(true)
    setError(null)
  }

  function addMember() {
    if (members.length < 20) {
      setMembers((current) => [...current, ''])
      setDirty(true)
    }
  }

  function removeMember(index: number) {
    if (members.length === 1) return
    setMembers((current) => current.filter((_, i) => i !== index))
    setDirty(true)
  }

  function stepError(targetStep: number) {
    if (targetStep === 1) {
      if (!values.title.trim()) return 'Enter the research title.'
      if (!values.defenseType) return 'Select the defense type.'
      if (!values.program) return 'Select the program.'
      if (majorOptions.length && !values.major) return 'Select the major.'
    }
    if (targetStep === 2 && cleanMembers.length === 0) return 'Enter at least one group member.'
    if (targetStep === 3) {
      if (!values.contactPerson.trim()) return 'Enter the contact person.'
      if (values.contactEmail && !/^\S+@\S+\.\S+$/.test(values.contactEmail)) return 'Enter a valid email address or leave it blank.'
      if (!values.researchFileUrl.trim()) return 'Paste the Google Drive or Google Docs research file link.'
      if (driveStatus !== true) return 'Use a valid Google Drive or Google Docs link.'
    }
    return null
  }

  function moveTo(target: number) {
    if (target > step) {
      for (let current = step; current < target; current += 1) {
        const message = stepError(current)
        if (message) {
          setError(message)
          return
        }
      }
    }
    setError(null)
    setStep(target)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    for (let current = 1; current <= 3; current += 1) {
      const message = stepError(current)
      if (message) {
        setStep(current)
        setError(message)
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

  function resetForm() {
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
        <div className="reference-code-box">
          <span>Reference code</span>
          <strong>{successCode}</strong>
        </div>
        <div className="submission-success-actions">
          <button className="button" type="button" onClick={copyCode}>Copy Reference Code</button>
          <Link className="button button-secondary" href="/#schedule">View Public Schedule</Link>
          <button className="button button-secondary" type="button" onClick={resetForm}>Submit Another Research</button>
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
          return (
            <div className={`submission-step ${number === step ? 'active' : ''} ${number < step ? 'complete' : ''}`} key={label} aria-current={number === step ? 'step' : undefined}>
              <span className="submission-step-number">{number < step ? '✓' : number}</span>
              <span>{label}</span>
            </div>
          )
        })}
      </div>

      <form ref={formRef} className="card submission-form" onSubmit={handleSubmit} noValidate>
        <div className="submission-form-header">
          <div>
            <h2>{STEPS[step - 1]}</h2>
            <p>{step === 1 ? 'Start with the research and defense information.' : step === 2 ? 'Add the members and choose faculty when applicable.' : step === 3 ? 'Provide a contact person and the panel-accessible research file.' : 'Check every detail before sending the submission.'}</p>
          </div>
          <span className="submission-step-count">Step {step} of 4</span>
        </div>

        {error ? <div className="submission-alert-wrap"><div className="alert alert-error" role="alert">{error}</div></div> : null}

        <div className="submission-form-body">
          {step === 1 ? (
            <section>
              <div className="field-grid">
                <div className="field full">
                  <label htmlFor="title">Research title <span className="required-mark">*</span></label>
                  <textarea id="title" value={values.title} maxLength={500} onChange={(event) => updateValue('title', event.target.value)} placeholder="Enter the complete research title" />
                </div>
                <div className="field">
                  <label htmlFor="defenseType">Defense type <span className="required-mark">*</span></label>
                  <select id="defenseType" value={values.defenseType} onChange={(event) => updateValue('defenseType', event.target.value)}>
                    <option value="">Select defense type</option>
                    <option value="title">Title Defense</option>
                    <option value="proposal">Proposal Defense</option>
                    <option value="final">Final Defense</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="program">Program <span className="required-mark">*</span></label>
                  <select id="program" value={values.program} onChange={(event) => updateValue('program', event.target.value)}>
                    <option value="">Select program</option>
                    <option value="BEED">BEED</option><option value="BSED">BSED</option><option value="BSA">BSA</option><option value="BSAIS">BSAIS</option><option value="BSBA">BSBA</option>
                  </select>
                </div>
                {majorOptions.length ? (
                  <div className="field">
                    <label htmlFor="major">Major <span className="required-mark">*</span></label>
                    <select id="major" value={values.major} onChange={(event) => updateValue('major', event.target.value)}>
                      <option value="">Select major</option>
                      {majorOptions.map((major) => <option key={major} value={major}>{major}</option>)}
                    </select>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section>
              <div className="submission-section-intro">
                <h3>Group members</h3>
                <p>Add every member. You can add up to 20 names.</p>
              </div>
              <div className="submission-member-list">
                {members.map((member, index) => (
                  <div className="submission-member-row" key={index}>
                    <div className="field">
                      <label htmlFor={`member-${index}`}>Member {index + 1}{index === 0 ? <span className="required-mark"> *</span> : null}</label>
                      <input id={`member-${index}`} value={member} maxLength={150} onChange={(event) => updateMember(index, event.target.value)} placeholder="Full name" />
                    </div>
                    <button className="button button-secondary submission-remove-member" aria-label={`Remove member ${index + 1}`} type="button" onClick={() => removeMember(index)}>−</button>
                  </div>
                ))}
              </div>
              <button className="button button-secondary button-small submission-add-member" type="button" onClick={addMember} disabled={members.length >= 20}>+ Add Member</button>

              <div className="submission-section-intro submission-subsection">
                <h3>Research faculty</h3>
                <p>Type a name to search the faculty directory. These fields may be left blank when not yet assigned.</p>
              </div>
              <div className="field-grid">
                <FacultySearch id="instructor-search" label="Research instructor" faculty={faculty} value={values.instructorId} onChange={(value) => updateValue('instructorId', value)} />
                <FacultySearch id="adviser-search" label="Research adviser" faculty={faculty} value={values.adviserId} onChange={(value) => updateValue('adviserId', value)} />
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section>
              <div className="submission-section-intro">
                <h3>Contact information</h3>
                <p>Contact details are for administrative use and are not shown on the public schedule.</p>
              </div>
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="contactPerson">Contact person <span className="required-mark">*</span></label>
                  <input id="contactPerson" value={values.contactPerson} maxLength={150} onChange={(event) => updateValue('contactPerson', event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="contactEmail">Email address <span className="optional-mark">Optional</span></label>
                  <input id="contactEmail" value={values.contactEmail} type="email" maxLength={254} onChange={(event) => updateValue('contactEmail', event.target.value)} inputMode="email" />
                </div>
                <div className="field">
                  <label htmlFor="contactNumber">Contact number <span className="optional-mark">Optional</span></label>
                  <input id="contactNumber" value={values.contactNumber} maxLength={40} onChange={(event) => updateValue('contactNumber', event.target.value)} inputMode="tel" />
                </div>
              </div>

              <div className="submission-section-intro submission-subsection">
                <h3>Research file</h3>
                <p>Provide the Google Drive or Google Docs file/folder that the panel may access.</p>
              </div>
              <div className="field">
                <label htmlFor="researchFileUrl">Google Drive research file link <span className="required-mark">*</span></label>
                <input
                  id="researchFileUrl"
                  className={driveStatus === true ? 'input-valid' : driveStatus === false ? 'input-invalid' : ''}
                  value={values.researchFileUrl}
                  type="url"
                  inputMode="url"
                  maxLength={2048}
                  placeholder="https://drive.google.com/..."
                  onChange={(event) => updateValue('researchFileUrl', event.target.value)}
                />
                {driveStatus === true ? <p className="submission-field-feedback valid">✓ Valid Google file link</p> : driveStatus === false ? <p className="submission-field-feedback invalid">Use a drive.google.com or docs.google.com link.</p> : null}
                <div className="drive-access-callout">
                  <span aria-hidden="true">i</span>
                  <div><strong>Make sure panelists can view the file.</strong><small>Set the file or folder to Viewer access for the people who need it before submitting.</small></div>
                </div>
              </div>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="submission-review">
              <div className="review-card">
                <div className="review-card-head"><h3>Research information</h3><button type="button" className="review-edit-button" onClick={() => moveTo(1)}>Edit</button></div>
                <dl className="review-grid">
                  <div className="review-full"><dt>Research title</dt><dd>{values.title}</dd></div>
                  <div><dt>Defense type</dt><dd>{defenseTypeLabel(values.defenseType)}</dd></div>
                  <div><dt>Program</dt><dd>{programLabel}</dd></div>
                </dl>
              </div>
              <div className="review-card">
                <div className="review-card-head"><h3>Group & faculty</h3><button type="button" className="review-edit-button" onClick={() => moveTo(2)}>Edit</button></div>
                <ul className="review-member-list">{cleanMembers.map((member) => <li key={member}>{member}</li>)}</ul>
                <dl className="review-grid review-grid-spaced">
                  <div><dt>Instructor</dt><dd>{instructorName}</dd></div>
                  <div><dt>Adviser</dt><dd>{adviserName}</dd></div>
                </dl>
              </div>
              <div className="review-card">
                <div className="review-card-head"><h3>Contact & research file</h3><button type="button" className="review-edit-button" onClick={() => moveTo(3)}>Edit</button></div>
                <dl className="review-grid">
                  <div><dt>Contact person</dt><dd>{values.contactPerson}</dd></div>
                  <div><dt>Email</dt><dd>{values.contactEmail || 'Not provided'}</dd></div>
                  <div><dt>Contact number</dt><dd>{values.contactNumber || 'Not provided'}</dd></div>
                  <div className="review-full"><dt>Research file</dt><dd><a className="review-file-link" href={values.researchFileUrl} target="_blank" rel="noreferrer">Open Google Drive link ↗</a></dd></div>
                </dl>
              </div>
              <div className="review-notice">Review the information carefully. After submission, scheduling details will be managed by the administrator.</div>
            </section>
          ) : null}
        </div>

        <div className="submission-nav-actions">
          <span className="submission-required-note"><span className="required-mark">*</span> Required field</span>
          <div className="submission-nav-actions-right">
            {step > 1 ? <button className="button button-secondary" type="button" onClick={() => moveTo(step - 1)} disabled={submitting}>Back</button> : null}
            {step < 4 ? <button className="button" type="button" onClick={() => moveTo(step + 1)}>Continue</button> : <button className="button" disabled={submitting} type="submit">{submitting ? 'Submitting…' : 'Submit Research'}</button>}
          </div>
        </div>
      </form>
    </div>
  )
}
