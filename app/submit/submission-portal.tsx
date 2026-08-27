'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useState } from 'react'
import RoleFacultySearch, { SubmissionFaculty } from './role-faculty-search'
import { RESEARCH_DESIGN_OPTIONS, researchDesignLabel } from '@/lib/research-design'

type Mode = 'choice' | 'new' | 'continue'
type DefenseType = 'title' | 'proposal' | 'final'
type Step = 1 | 2 | 3 | 4
type Values = { title: string; program: string; major: string; researchDesign: string; researchDesignOther: string; researchFileUrl: string; contactPerson: string; contactEmail: string; contactNumber: string; instructorId: string; adviserId: string }
type ExistingGroup = Values & { researchCode: string; members: string[] }
type VerifyResult = { verified?: boolean; canContinue?: boolean; reason?: string | null; currentDefenseType?: string | null; currentStatus?: string; nextDefenseType?: DefenseType | null; group?: ExistingGroup; error?: string }
type Success = { researchCode: string; defenseType: DefenseType; continued: boolean }
type Access = { researchCode: string }

const BSED_MAJORS = ['English', 'Filipino', 'Mathematics', 'Science']
const BSBA_MAJORS = ['MM', 'FM', 'HRM']
const STEP_LABELS = ['Research', 'Group', 'Contact & File', 'Review']
const EMPTY: Values = { title: '', program: '', major: '', researchDesign: '', researchDesignOther: '', researchFileUrl: '', contactPerson: '', contactEmail: '', contactNumber: '', instructorId: '', adviserId: '' }

function defenseLabel(value: string | null | undefined) { return value === 'title' ? 'Title Defense' : value === 'proposal' ? 'Proposal Defense' : value === 'final' ? 'Final Defense' : 'Research Defense' }
function validDrive(value: string) { try { const url = new URL(value.trim()); return url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname) } catch { return false } }
function facultyName(faculty: SubmissionFaculty[], id: string) { return faculty.find((person) => person.id === id)?.full_name ?? 'Not specified' }

function ResearchRequestForm({ faculty, mode, defenseType, initial, access, onBack }: { faculty: SubmissionFaculty[]; mode: 'new' | 'continue'; defenseType: DefenseType; initial?: ExistingGroup; access?: Access; onBack: () => void }) {
  const availableIds = useMemo(() => new Set(faculty.map((person) => person.id)), [faculty])
  const [values, setValues] = useState<Values>(() => ({ ...(initial ?? EMPTY), instructorId: initial?.instructorId && availableIds.has(initial.instructorId) ? initial.instructorId : '', adviserId: initial?.adviserId && availableIds.has(initial.adviserId) ? initial.adviserId : '' }))
  const [members, setMembers] = useState<string[]>(initial?.members?.length ? initial.members : [''])
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<Success | null>(null)
  const [copied, setCopied] = useState(false)
  const instructorFaculty = useMemo(() => faculty.filter((person) => person.can_teach_research), [faculty])
  const adviserFaculty = useMemo(() => faculty.filter((person) => person.can_advise), [faculty])
  const majors = values.program === 'BSED' ? BSED_MAJORS : values.program === 'BSBA' ? BSBA_MAJORS : []
  const cleanMembers = members.map((name) => name.trim()).filter(Boolean)

  function setValue<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value }
      if (key === 'program' && current.program !== value) next.major = ''
      if (key === 'researchDesign' && value !== 'other') next.researchDesignOther = ''
      return next
    })
    setError('')
  }

  function validateStep(target: Step) {
    if (target === 1) {
      if (!values.title.trim()) return 'Enter the research title.'
      if (!values.program) return 'Select the program.'
      if (majors.length && !values.major) return 'Select the major.'
      if (!values.researchDesign) return 'Select the research design.'
      if (values.researchDesign === 'other' && !values.researchDesignOther.trim()) return 'Specify the research design.'
    }
    if (target === 2 && !cleanMembers.length) return 'Enter at least one group member.'
    if (target === 3) {
      if (!values.contactPerson.trim()) return 'Enter the contact person.'
      if (values.contactEmail && !/^\S+@\S+\.\S+$/.test(values.contactEmail)) return 'Enter a valid email address or leave it blank.'
      if (!validDrive(values.researchFileUrl)) return 'Use a valid Google Drive or Google Docs research file link.'
    }
    return ''
  }

  function moveTo(next: Step) {
    setStep(next)
    setError('')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function nextStep() {
    const issue = validateStep(step)
    if (issue) return setError(issue)
    moveTo(Math.min(4, step + 1) as Step)
  }

  function previousStep() {
    if (step === 1) return onBack()
    moveTo((step - 1) as Step)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step !== 4) return nextStep()
    const issue = validateStep(1) || validateStep(2) || validateStep(3)
    if (issue) return setError(issue)
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, researchCode: access?.researchCode, title: values.title.trim(), program: values.program, major: values.major || null, researchDesign: values.researchDesign, researchDesignOther: values.researchDesign === 'other' ? values.researchDesignOther.trim() : null, researchFileUrl: values.researchFileUrl.trim(), contactPerson: values.contactPerson.trim(), contactEmail: values.contactEmail.trim(), contactNumber: values.contactNumber.trim(), instructorId: values.instructorId || null, adviserId: values.adviserId || null, members: cleanMembers }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to submit the defense request.')
      setSuccess({ researchCode: result.researchCode, defenseType: result.defenseType, continued: Boolean(result.continued) })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to submit the defense request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyResearchCode() {
    if (!success) return
    try { await navigator.clipboard.writeText(success.researchCode); setCopied(true) } catch { setCopied(false) }
  }

  if (success) {
    return (
      <div className="card lifecycle-success" aria-live="polite">
        <div className="submission-success-icon" aria-hidden="true">✓</div>
        <p className="eyebrow">{success.continued ? 'Defense Request Received' : 'Research Submitted'}</p>
        <h2>{success.continued ? `${defenseLabel(success.defenseType)} requested.` : 'Save your Research Code.'}</h2>
        <p>{success.continued ? 'Your Research Code stays the same for the next stage.' : 'Keep this code private. You will use it to check status and request Proposal and Final Defense.'}</p>
        <div className="lifecycle-credentials lifecycle-id-only"><div><span>Research Code</span><strong>{success.researchCode}</strong></div></div>
        <div className="submission-success-actions">
          <button className="button" onClick={copyResearchCode} type="button">{copied ? 'Research Code Copied ✓' : 'Copy Research Code'}</button>
          <Link className="button button-secondary" href="/status">Check Status</Link>
          <button className="button button-secondary" onClick={onBack} type="button">Done</button>
        </div>
      </div>
    )
  }

  return (
    <form className="card lifecycle-form lifecycle-wizard" onSubmit={submit}>
      <div className="lifecycle-form-head">
        <div>
          <p className="eyebrow">{mode === 'new' ? 'New Research' : 'Continue Existing Research'}</p>
          <h2>{defenseLabel(defenseType)}</h2>
          {mode === 'continue' ? <p>Review and update anything that changed before requesting your next defense.</p> : null}
        </div>
      </div>

      <div className="wizard-progress" aria-label="Submission progress">
        {STEP_LABELS.map((label, index) => {
          const number = (index + 1) as Step
          return <div className={`wizard-progress-step${step === number ? ' active' : ''}${step > number ? ' complete' : ''}`} key={label}><span>{step > number ? '✓' : number}</span><strong>{label}</strong></div>
        })}
      </div>

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      {step === 1 ? (
        <section className="lifecycle-form-section wizard-panel"><h3>Research</h3><div className="field-grid"><div className="field full"><label htmlFor={`${mode}-title`}>Research title <span className="required-mark">*</span></label><textarea id={`${mode}-title`} maxLength={500} onChange={(event) => setValue('title', event.target.value)} value={values.title} /></div><div className="field"><label htmlFor={`${mode}-program`}>Program <span className="required-mark">*</span></label><select id={`${mode}-program`} onChange={(event) => setValue('program', event.target.value)} value={values.program}><option value="">Select program</option><option value="BEED">BEED</option><option value="BSED">BSED</option><option value="BSA">BSA</option><option value="BSAIS">BSAIS</option><option value="BSBA">BSBA</option></select></div>{majors.length ? <div className="field"><label htmlFor={`${mode}-major`}>Major <span className="required-mark">*</span></label><select id={`${mode}-major`} onChange={(event) => setValue('major', event.target.value)} value={values.major}><option value="">Select major</option>{majors.map((major) => <option key={major}>{major}</option>)}</select></div> : null}<div className="field full"><label htmlFor={`${mode}-research-design`}>Research design <span className="required-mark">*</span></label><select id={`${mode}-research-design`} onChange={(event) => setValue('researchDesign', event.target.value)} value={values.researchDesign}><option value="">Select research design</option>{RESEARCH_DESIGN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>{values.researchDesign === 'other' ? <div className="field full"><label htmlFor={`${mode}-research-design-other`}>Specify research design <span className="required-mark">*</span></label><input id={`${mode}-research-design-other`} maxLength={120} onChange={(event) => setValue('researchDesignOther', event.target.value)} value={values.researchDesignOther} /></div> : null}</div></section>
      ) : null}

      {step === 2 ? (
        <section className="lifecycle-form-section wizard-panel"><div className="lifecycle-section-head"><h3>Group members</h3></div><div className="submission-member-list">{members.map((member, index) => <div className="submission-member-row" key={`${index}-${members.length}`}><div className="field"><label htmlFor={`${mode}-member-${index}`}>Member {index + 1}{index === 0 ? <span className="required-mark"> *</span> : null}</label><input id={`${mode}-member-${index}`} maxLength={150} onChange={(event) => setMembers((current) => current.map((value, i) => i === index ? event.target.value : value))} value={member} /></div><button aria-label={`Remove member ${index + 1}`} className="button button-secondary submission-remove-member" disabled={members.length === 1} onClick={() => setMembers((current) => current.filter((_, i) => i !== index))} type="button">−</button></div>)}</div><button className="button button-secondary button-small submission-add-member" disabled={members.length >= 20} onClick={() => setMembers((current) => [...current, ''])} type="button">+ Add Member</button><div className="field-grid lifecycle-faculty-grid"><RoleFacultySearch faculty={instructorFaculty} id={`${mode}-instructor`} label="Research instructor" onChange={(value) => setValue('instructorId', value)} value={values.instructorId} /><RoleFacultySearch faculty={adviserFaculty} id={`${mode}-adviser`} label="Research adviser" onChange={(value) => setValue('adviserId', value)} value={values.adviserId} /></div></section>
      ) : null}

      {step === 3 ? (
        <section className="lifecycle-form-section wizard-panel"><h3>Contact & research file</h3><div className="field-grid"><div className="field"><label htmlFor={`${mode}-contact`}>Contact person <span className="required-mark">*</span></label><input id={`${mode}-contact`} maxLength={150} onChange={(event) => setValue('contactPerson', event.target.value)} value={values.contactPerson} /></div><div className="field"><label htmlFor={`${mode}-email`}>Email <span className="optional-mark">Optional</span></label><input id={`${mode}-email`} maxLength={254} onChange={(event) => setValue('contactEmail', event.target.value)} type="email" value={values.contactEmail} /></div><div className="field"><label htmlFor={`${mode}-number`}>Contact number <span className="optional-mark">Optional</span></label><input id={`${mode}-number`} maxLength={40} onChange={(event) => setValue('contactNumber', event.target.value)} value={values.contactNumber} /></div><div className="field full"><label htmlFor={`${mode}-file`}>Google Drive research file link <span className="required-mark">*</span></label><input id={`${mode}-file`} maxLength={2048} onChange={(event) => setValue('researchFileUrl', event.target.value)} placeholder="https://drive.google.com/..." type="url" value={values.researchFileUrl} /><div className="submission-file-note"><span aria-hidden="true">!</span><strong>Use a Drive or Docs link that the panel can open.</strong></div></div></div></section>
      ) : null}

      {step === 4 ? (
        <section className="lifecycle-form-section wizard-panel"><div className="wizard-review-heading"><div><h3>Review before submission</h3><p>Check the information below before sending your defense request.</p></div></div><div className="submission-review"><div className="review-card"><div className="review-card-head"><h3>Research</h3><button className="review-edit-button" onClick={() => moveTo(1)} type="button">Edit</button></div><dl className="review-grid"><div className="review-full"><dt>Research title</dt><dd>{values.title}</dd></div><div><dt>Program</dt><dd>{values.program}{values.major ? ` - ${values.major}` : ''}</dd></div><div><dt>Research design</dt><dd>{researchDesignLabel(values.researchDesign, values.researchDesignOther)}</dd></div></dl></div><div className="review-card"><div className="review-card-head"><h3>Group</h3><button className="review-edit-button" onClick={() => moveTo(2)} type="button">Edit</button></div><ol className="review-member-list">{cleanMembers.map((member, index) => <li key={`${member}-${index}`}>{member}</li>)}</ol><dl className="review-grid review-grid-spaced"><div><dt>Research instructor</dt><dd>{facultyName(faculty, values.instructorId)}</dd></div><div><dt>Research adviser</dt><dd>{facultyName(faculty, values.adviserId)}</dd></div></dl></div><div className="review-card"><div className="review-card-head"><h3>Contact & research file</h3><button className="review-edit-button" onClick={() => moveTo(3)} type="button">Edit</button></div><dl className="review-grid"><div><dt>Contact person</dt><dd>{values.contactPerson}</dd></div><div><dt>Email</dt><dd>{values.contactEmail || 'Not provided'}</dd></div><div><dt>Contact number</dt><dd>{values.contactNumber || 'Not provided'}</dd></div><div className="review-full"><dt>Research file</dt><dd><a className="review-file-link" href={values.researchFileUrl} rel="noopener noreferrer" target="_blank">Open Google Drive file ↗</a></dd></div></dl></div></div></section>
      ) : null}

      <div className="lifecycle-form-actions">
        <button className="button button-secondary" onClick={previousStep} type="button">{step === 1 ? '← Back' : '← Previous'}</button>
        <button className="button" disabled={submitting} type="submit">{submitting ? 'Submitting…' : step < 4 ? 'Next →' : mode === 'new' ? 'Submit Title Defense' : `Request ${defenseLabel(defenseType)}`}</button>
      </div>
    </form>
  )
}

function ContinueAccess({ faculty, onBack }: { faculty: SubmissionFaculty[]; onBack: () => void }) {
  const [researchCode, setResearchCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<VerifyResult | null>(null)

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch('/api/research-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchCode }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to verify the research record.')
      setResult(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to verify the research record.')
    } finally {
      setLoading(false)
    }
  }

  if (result?.verified && result.canContinue && result.nextDefenseType && result.group) {
    return <ResearchRequestForm access={{ researchCode: result.group.researchCode }} defenseType={result.nextDefenseType} faculty={faculty} initial={result.group} mode="continue" onBack={onBack} />
  }

  return <div className="lifecycle-access-shell"><form className="card lifecycle-access-card" onSubmit={verify}><div className="lifecycle-form-head"><div><p className="eyebrow">Continue Existing Research</p><h2>Enter your Research Code.</h2></div></div>{error ? <div className="alert alert-error" role="alert">{error}</div> : null}{result?.reason ? <div className="alert alert-warning">{result.reason}</div> : null}<div className="field-grid"><div className="field full"><label htmlFor="continue-code">Research Code <span className="required-mark">*</span></label><input autoCapitalize="characters" autoComplete="off" id="continue-code" maxLength={4} onChange={(event) => setResearchCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))} placeholder="K7M4" value={researchCode} /></div></div><div className="lifecycle-form-actions"><button className="button button-secondary" onClick={onBack} type="button">← Back</button><button className="button" disabled={loading} type="submit">{loading ? 'Checking…' : 'Continue →'}</button></div></form></div>
}

export default function SubmissionPortal({ faculty }: { faculty: SubmissionFaculty[] }) {
  const [mode, setMode] = useState<Mode>('choice')
  if (mode === 'new') return <ResearchRequestForm defenseType="title" faculty={faculty} mode="new" onBack={() => setMode('choice')} />
  if (mode === 'continue') return <ContinueAccess faculty={faculty} onBack={() => setMode('choice')} />
  return <div className="lifecycle-choice"><button className="card lifecycle-choice-card" onClick={() => setMode('new')} type="button"><span className="lifecycle-choice-number">01</span><strong>New Research</strong><p>Start your Title Defense.</p><span>Start →</span></button><button className="card lifecycle-choice-card" onClick={() => setMode('continue')} type="button"><span className="lifecycle-choice-number">02</span><strong>Continue Research</strong><p>Request Proposal or Final Defense using your Research Code.</p><span>Continue →</span></button></div>
}
