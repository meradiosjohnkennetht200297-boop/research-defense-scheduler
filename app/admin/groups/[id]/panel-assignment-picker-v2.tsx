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
      <div className={value ? 'workspace-panel-input selected' : 'workspace-panel-input'}>
        <input autoComplete="off" disabled={faculty.length === 0} id={id} list={listId} onChange={(event) => update(event.target.value)} placeholder={faculty.length ? 'Search faculty name' : 'No eligible faculty available'} value={query} />
        {value ? <span className="workspace-panel-check" aria-label="Selected">✓</span> : null}
      </div>
      <datalist id={listId}>{faculty.filter((person) => person.id === value || !blockedIds.includes(person.id)).map((person) => <option key={person.id} value={person.full_name} />)}</datalist>
      {duplicate ? <p className="workspace-picker-feedback invalid">Already assigned to this panel.</p> : query.trim() && !value ? <p className="workspace-picker-feedback invalid">Choose an eligible name from the suggestions.</p> : null}
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

  return (
    <div className="workspace-panel-picker workspace-panel-picker-clean" ref={rootRef}>
      <input name="chairId" type="hidden" value={chairId} />
      {memberIds.filter(Boolean).map((id, index) => <input key={`${id}-${index}`} name="memberIds" type="hidden" value={id} />)}

      {!eligibility && !eligibilityError ? <p className="workspace-picker-help">Loading eligible faculty…</p> : null}
      {eligibilityError ? <p className="workspace-picker-feedback invalid">Eligibility filter could not be loaded. Eligibility will still be checked when the schedule is saved.</p> : null}

      <SearchField blockedIds={memberIds.filter(Boolean)} faculty={chairOptions} id="chair-search" label="Chair" onChange={setChairId} required value={chairId} />

      <div className="workspace-panel-members-heading">
        <div><strong>Panel members</strong><small>Add up to four members.</small></div>
        <button className="button button-secondary button-small workspace-add-panel" disabled={memberIds.length >= 4} onClick={addMember} type="button">+ Add member</button>
      </div>

      <div className="workspace-member-pickers workspace-member-pickers-clean">
        {memberIds.map((id, index) => (
          <div className="workspace-panel-picker-row workspace-panel-picker-row-clean" key={index}>
            <SearchField blockedIds={[chairId, ...memberIds.filter((_, i) => i !== index)].filter(Boolean)} faculty={memberOptions} id={`member-search-${index}`} label={`Member ${index + 1}`} onChange={(value) => setMemberIds((current) => current.map((currentId, i) => i === index ? value : currentId))} value={id} />
            <button aria-label={`Remove panel member ${index + 1}`} className="workspace-remove-panel-clean" onClick={() => removeMember(index)} title="Remove member" type="button">×</button>
          </div>
        ))}
      </div>
    </div>
  )
}
