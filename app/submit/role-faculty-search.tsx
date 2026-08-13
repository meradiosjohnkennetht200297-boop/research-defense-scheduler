'use client'

import { useEffect, useState } from 'react'

export type SubmissionFaculty = {
  id: string
  full_name: string
  can_advise: boolean
  can_teach_research: boolean
}

export default function RoleFacultySearch({
  id,
  label,
  faculty,
  value,
  onChange,
}: {
  id: string
  label: string
  faculty: SubmissionFaculty[]
  value: string
  onChange: (value: string) => void
}) {
  const selectedName = faculty.find((person) => person.id === value)?.full_name ?? ''
  const [query, setQuery] = useState(selectedName)
  const listId = `${id}-options`

  useEffect(() => setQuery(selectedName), [selectedName])

  function change(next: string) {
    setQuery(next)
    const match = faculty.find((person) => person.full_name.toLowerCase() === next.trim().toLowerCase())
    onChange(match?.id ?? '')
  }

  return (
    <div className="field faculty-search-field">
      <label htmlFor={id}>{label} <span className="optional-mark">Optional</span></label>
      <input
        autoComplete="off"
        disabled={faculty.length === 0}
        id={id}
        list={listId}
        onChange={(event) => change(event.target.value)}
        placeholder={faculty.length ? 'Type a faculty name' : 'No eligible faculty available'}
        value={query}
      />
      <datalist id={listId}>{faculty.map((person) => <option key={person.id} value={person.full_name} />)}</datalist>
      {query.trim() && !value ? (
        <p className="submission-field-feedback invalid">Choose the exact name from the suggestions.</p>
      ) : value ? (
        <p className="submission-field-feedback valid">✓ Faculty selected</p>
      ) : (
        <p className="submission-field-help">Start typing to search eligible faculty.</p>
      )}
    </div>
  )
}
