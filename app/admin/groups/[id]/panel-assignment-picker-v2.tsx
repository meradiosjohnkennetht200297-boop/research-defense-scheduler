'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Faculty = { id: string; full_name: string }
type Eligibility = { chairIds: string[]; panelIds: string[] }

type Props = {
  faculty: Faculty[]
  initialChairId: string
  initialMemberIds: string[]
}

function SearchField({ id, label, faculty, value, blockedIds, required, onChange }: {
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
  const listId = `${id}-list`

  useEffect(() => setQuery(selectedName), [selectedName])

  function update(next: string) {
    setQuery(next)
    const match = faculty.find((person) => person.full_name.toLowerCase() === next.trim().toLowerCase())
    if (match && blockedIds.includes(match.id) && match.id !== value) {
      onChange('')
      return
    }
    onChange(match?.id ?? '')
  }

  const duplicate = Boolean(query.trim() && !value && faculty.some((person) => blockedIds.includes(person.id) && person.full_name.toLowerCase() === query.trim().toLowerCase()))

  return (
    <div className="field workspace-panel-search">
      <label htmlFor={id}>{label}{required ? <span className="required-mark"> *</span> : null}</label>
      <input autoComplete="off" disabled={faculty.length === 0} id={id} list={listId} onChange={(event) => update(event.target.value)} placeholder={faculty.length ? 'Type a faculty name' : 'No eligible faculty available'} value={query} />
      <datalist id={listId}>{faculty.filter((person) => person.id === value || !blockedIds.includes(person.id)).map((person) => <option key={person.id} value={person.full_name} />)}</datalist>
      {duplicate ? <p className="workspace-picker-feedback invalid">Already assigned to this panel.</p> : value ? <p className="workspace-picker-feedback valid">✓ Selected</p> : query.trim() ? <p className="workspace-picker-feedback invalid">Choose an eligible name from the suggestions.</p> : <p className="workspace-picker-help">Start typing to search eligible faculty.</p>}
    </div>
  )
}

export default function PanelAssignmentPickerV2({ faculty, initialChairId, initialMemberIds }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [chairId, setChairId] = useState(initialChairId)
  const [memberIds, setMemberIds] = useState(initialMemberIds.length ? initialMemberIds : [''])
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [eligibilityError, setEligibilityError] = useState(false)

  useEffect(() => {
    let mounted = true
    fetch('/api/admin/faculty-eligibility')
      .then(async (response) => {
        if (!response.ok) throw new Error('Eligibility unavailable')
        return response.json() as Promise<Eligibility>
      })
      .then((data) => { if (mounted) setEligibility(data) })
      .catch(() => { if (mounted) setEligibilityError(true) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const form = rootRef.current?.closest('form')
    if (!form) return
    const reset = () => {
      setChairId(initialChairId)
      setMemberIds(initialMemberIds.length ? initialMemberIds : [''])
    }
    form.addEventListener('reset', reset)
    return () => form.removeEventListener('reset', reset)
  }, [initialChairId, initialMemberIds])

  const chairOptions = useMemo(() => {
    if (!eligibility) return eligibilityError ? faculty : faculty.filter((person) => person.id === initialChairId)
    const allowed = new Set(eligibility.chairIds)
    return faculty.filter((person) => allowed.has(person.id) || person.id === initialChairId)
  }, [eligibility, eligibilityError, faculty, initialChairId])

  const memberOptions = useMemo(() => {
    if (!eligibility) return eligibilityError ? faculty : faculty.filter((person) => initialMemberIds.includes(person.id))
    const allowed = new Set(eligibility.panelIds)
    return faculty.filter((person) => allowed.has(person.id) || initialMemberIds.includes(person.id))
  }, [eligibility, eligibilityError, faculty, initialMemberIds])

  function addMember() {
    if (memberIds.length < 4) setMemberIds((current) => [...current, ''])
  }

  function removeMember(index: number) {
    setMemberIds((current) => {
      const next = current.filter((_, i) => i !== index)
      return next.length ? next : ['']
    })
  }

  const selectedCount = [chairId, ...memberIds].filter(Boolean).length

  return (
    <div className="workspace-panel-picker" ref={rootRef}>
      <input name="chairId" type="hidden" value={chairId} />
      {memberIds.filter(Boolean).map((id, index) => <input key={`${id}-${index}`} name="memberIds" type="hidden" value={id} />)}

      {!eligibility && !eligibilityError ? <p className="workspace-picker-help">Loading eligible faculty roles…</p> : null}
      {eligibilityError ? <p className="workspace-picker-feedback invalid">Eligibility filter could not be loaded. Role eligibility will still be checked when you save.</p> : null}

      <SearchField blockedIds={memberIds.filter(Boolean)} faculty={chairOptions} id="chair-search" label="Panel chair" onChange={setChairId} required value={chairId} />

      <div className="workspace-member-pickers">
        {memberIds.map((id, index) => (
          <div className="workspace-panel-picker-row" key={index}>
            <SearchField blockedIds={[chairId, ...memberIds.filter((_, i) => i !== index)].filter(Boolean)} faculty={memberOptions} id={`member-search-${index}`} label={`Panel member ${index + 1}`} onChange={(value) => setMemberIds((current) => current.map((currentId, i) => i === index ? value : currentId))} value={id} />
            <button aria-label={`Remove panel member ${index + 1}`} className="button button-secondary button-small workspace-remove-panel" onClick={() => removeMember(index)} type="button">Remove</button>
          </div>
        ))}
      </div>

      <button className="button button-secondary button-small workspace-add-panel" disabled={memberIds.length >= 4} onClick={addMember} type="button">+ Add Panel Member</button>

      <div className="workspace-selected-panel">
        <span className="workspace-selected-label">Selected panel</span>
        <div className="workspace-panel-chips">
          {chairId ? <span className="workspace-panel-chip chair"><strong>Chair</strong>{faculty.find((person) => person.id === chairId)?.full_name}</span> : null}
          {memberIds.filter(Boolean).map((id, index) => <span className="workspace-panel-chip" key={id}><strong>Member {index + 1}</strong>{faculty.find((person) => person.id === id)?.full_name}</span>)}
          {selectedCount === 0 ? <span className="workspace-no-panel">No panel selected yet.</span> : null}
        </div>
      </div>
    </div>
  )
}
