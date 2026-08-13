'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Faculty = { id: string; full_name: string }

type PickerProps = {
  faculty: Faculty[]
  initialChairId: string
  initialMemberIds: string[]
}

function SearchField({
  id,
  label,
  faculty,
  value,
  blockedIds,
  required,
  onChange,
}: {
  id: string
  label: string
  faculty: Faculty[]
  value: string
  blockedIds: string[]
  required?: boolean
  onChange: (id: string) => void
}) {
  const selectedName = faculty.find((person) => person.id === value)?.full_name ?? ''
  const [query, setQuery] = useState(selectedName)
  const [duplicate, setDuplicate] = useState(false)
  const listId = `${id}-list`

  useEffect(() => {
    setQuery(selectedName)
    setDuplicate(false)
  }, [selectedName])

  function update(next: string) {
    setQuery(next)
    const match = faculty.find((person) => person.full_name.toLowerCase() === next.trim().toLowerCase())
    if (match && blockedIds.includes(match.id) && match.id !== value) {
      setDuplicate(true)
      onChange('')
      return
    }
    setDuplicate(false)
    onChange(match?.id ?? '')
  }

  return (
    <div className="field workspace-panel-search">
      <label htmlFor={id}>{label}{required ? <span className="required-mark"> *</span> : null}</label>
      <input
        autoComplete="off"
        id={id}
        list={listId}
        onChange={(event) => update(event.target.value)}
        placeholder="Type a faculty name"
        value={query}
      />
      <datalist id={listId}>
        {faculty
          .filter((person) => person.id === value || !blockedIds.includes(person.id))
          .map((person) => <option key={person.id} value={person.full_name} />)}
      </datalist>
      {duplicate ? (
        <p className="workspace-picker-feedback invalid">Already assigned to this panel.</p>
      ) : value ? (
        <p className="workspace-picker-feedback valid">✓ Selected</p>
      ) : query.trim() ? (
        <p className="workspace-picker-feedback invalid">Choose the exact name from the suggestions.</p>
      ) : (
        <p className="workspace-picker-help">Start typing to search the faculty directory.</p>
      )}
    </div>
  )
}

export default function PanelAssignmentPicker({ faculty, initialChairId, initialMemberIds }: PickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const initialMembers = initialMemberIds.length ? initialMemberIds : ['']
  const [chairId, setChairId] = useState(initialChairId)
  const [memberIds, setMemberIds] = useState(initialMembers)

  const selected = useMemo(() => [chairId, ...memberIds].filter(Boolean), [chairId, memberIds])

  useEffect(() => {
    const form = rootRef.current?.closest('form')
    if (!form) return
    const reset = () => {
      setChairId(initialChairId)
      setMemberIds(initialMembers)
    }
    form.addEventListener('reset', reset)
    return () => form.removeEventListener('reset', reset)
  }, [initialChairId, initialMemberIds])

  function addMember() {
    if (memberIds.length < 4) setMemberIds((current) => [...current, ''])
  }

  function updateMember(index: number, id: string) {
    setMemberIds((current) => current.map((value, i) => (i === index ? id : value)))
  }

  function removeMember(index: number) {
    setMemberIds((current) => {
      const next = current.filter((_, i) => i !== index)
      return next.length ? next : ['']
    })
  }

  return (
    <div className="workspace-panel-picker" ref={rootRef}>
      <input name="chairId" type="hidden" value={chairId} />
      {memberIds.filter(Boolean).map((id, index) => <input key={`${id}-${index}`} name="memberIds" type="hidden" value={id} />)}

      <SearchField
        blockedIds={memberIds.filter(Boolean)}
        faculty={faculty}
        id="chair-search"
        label="Panel chair"
        onChange={setChairId}
        required
        value={chairId}
      />

      <div className="workspace-member-pickers">
        {memberIds.map((id, index) => (
          <div className="workspace-panel-picker-row" key={index}>
            <SearchField
              blockedIds={[chairId, ...memberIds.filter((_, i) => i !== index)].filter(Boolean)}
              faculty={faculty}
              id={`member-search-${index}`}
              label={`Panel member ${index + 1}`}
              onChange={(value) => updateMember(index, value)}
              value={id}
            />
            <button
              aria-label={`Remove panel member ${index + 1}`}
              className="button button-secondary button-small workspace-remove-panel"
              onClick={() => removeMember(index)}
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button className="button button-secondary button-small workspace-add-panel" disabled={memberIds.length >= 4} onClick={addMember} type="button">
        + Add Panel Member
      </button>

      <div className="workspace-selected-panel">
        <span className="workspace-selected-label">Selected panel</span>
        <div className="workspace-panel-chips">
          {chairId ? (
            <span className="workspace-panel-chip chair"><strong>Chair</strong>{faculty.find((person) => person.id === chairId)?.full_name}</span>
          ) : null}
          {memberIds.filter(Boolean).map((id, index) => (
            <span className="workspace-panel-chip" key={id}><strong>Member {index + 1}</strong>{faculty.find((person) => person.id === id)?.full_name}</span>
          ))}
          {selected.length === 0 ? <span className="workspace-no-panel">No panel selected yet.</span> : null}
        </div>
      </div>
    </div>
  )
}
