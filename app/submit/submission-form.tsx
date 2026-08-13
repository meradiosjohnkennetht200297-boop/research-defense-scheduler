'use client'

import { FormEvent, useState } from 'react'

type Faculty = {
  id: string
  full_name: string
}

export default function SubmissionForm({ faculty }: { faculty: Faculty[] }) {
  const [members, setMembers] = useState(['', '', ''])
  const [submitting, setSubmitting] = useState(false)
  const [successCode, setSuccessCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function updateMember(index: number, value: string) {
    setMembers((current) => current.map((member, i) => (i === index ? value : member)))
  }

  function addMember() {
    if (members.length < 20) setMembers((current) => [...current, ''])
  }

  function removeMember(index: number) {
    if (members.length === 1) return
    setMembers((current) => current.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccessCode(null)

    const form = new FormData(event.currentTarget)
    const cleanMembers = members.map((member) => member.trim()).filter(Boolean)

    if (cleanMembers.length === 0) {
      setError('Please enter at least one group member.')
      setSubmitting(false)
      return
    }

    const payload = {
      title: String(form.get('title') ?? '').trim(),
      contactPerson: String(form.get('contactPerson') ?? '').trim(),
      contactEmail: String(form.get('contactEmail') ?? '').trim(),
      contactNumber: String(form.get('contactNumber') ?? '').trim(),
      instructorId: String(form.get('instructorId') ?? '') || null,
      adviserId: String(form.get('adviserId') ?? '') || null,
      members: cleanMembers,
    }

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed. Please try again.')
      }

      setSuccessCode(result.publicCode)
      event.currentTarget.reset()
      setMembers(['', '', ''])
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Submission failed. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card form-shell" onSubmit={handleSubmit}>
      {successCode ? (
        <div className="alert alert-success">
          Submission received successfully. Your reference code is <strong>{successCode}</strong>.
        </div>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="form-section">
        <h2>Research information</h2>
        <p>Enter the title exactly as you want it to appear in the defense schedule.</p>
        <div className="field-grid">
          <div className="field full">
            <label htmlFor="title">Research title</label>
            <textarea id="title" name="title" maxLength={500} required />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>Group members</h2>
        <p>Add every member of the research group. Blank entries are ignored.</p>
        {members.map((member, index) => (
          <div className="member-row" key={index}>
            <div className="field">
              <label htmlFor={`member-${index}`}>Member {index + 1}</label>
              <input
                id={`member-${index}`}
                value={member}
                maxLength={150}
                onChange={(event) => updateMember(index, event.target.value)}
                required={index === 0}
              />
            </div>
            <button
              aria-label={`Remove member ${index + 1}`}
              className="button button-secondary"
              onClick={() => removeMember(index)}
              type="button"
            >
              −
            </button>
          </div>
        ))}
        <button className="button button-secondary button-small" onClick={addMember} type="button">
          + Add member
        </button>
      </section>

      <section className="form-section">
        <h2>Contact and faculty</h2>
        <p>Contact details are for administrative use and are not shown on the public schedule.</p>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="contactPerson">Contact person</label>
            <input id="contactPerson" name="contactPerson" maxLength={150} required />
          </div>
          <div className="field">
            <label htmlFor="contactEmail">Email address</label>
            <input id="contactEmail" name="contactEmail" type="email" maxLength={254} />
          </div>
          <div className="field">
            <label htmlFor="contactNumber">Contact number</label>
            <input id="contactNumber" name="contactNumber" inputMode="tel" maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="instructorId">Research instructor</label>
            <select id="instructorId" name="instructorId" disabled={faculty.length === 0}>
              <option value="">
                {faculty.length === 0 ? 'Faculty list not yet configured' : 'Select instructor'}
              </option>
              {faculty.map((person) => (
                <option key={person.id} value={person.id}>{person.full_name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="adviserId">Research adviser</label>
            <select id="adviserId" name="adviserId" disabled={faculty.length === 0}>
              <option value="">
                {faculty.length === 0 ? 'Faculty list not yet configured' : 'Select adviser'}
              </option>
              {faculty.map((person) => (
                <option key={person.id} value={person.id}>{person.full_name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="form-actions">
        <p className="form-note">Review the information before submitting. The administrator can update scheduling details later.</p>
        <button className="button" disabled={submitting} type="submit">
          {submitting ? 'Submitting…' : 'Submit Research'}
        </button>
      </div>
    </form>
  )
}
