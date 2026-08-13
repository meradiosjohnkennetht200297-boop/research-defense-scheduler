'use client'

import { toggleFacultyDirectory } from './directory-actions'

export default function FacultyStatusForm({
  id,
  fullName,
  isActive,
}: {
  id: string
  fullName: string
  isActive: boolean
}) {
  function confirmChange(event: React.FormEvent<HTMLFormElement>) {
    if (!isActive) return
    const confirmed = window.confirm(
      `Deactivate ${fullName}? They will no longer appear in new faculty selections. Existing scheduled assignments must be resolved first.`
    )
    if (!confirmed) event.preventDefault()
  }

  return (
    <form action={toggleFacultyDirectory} onSubmit={confirmChange}>
      <input name="id" type="hidden" value={id} />
      <input name="nextActive" type="hidden" value={String(!isActive)} />
      <button className="button button-secondary button-small" type="submit">
        {isActive ? 'Deactivate' : 'Activate'}
      </button>
    </form>
  )
}
