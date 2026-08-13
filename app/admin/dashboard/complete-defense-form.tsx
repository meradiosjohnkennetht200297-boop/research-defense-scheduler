'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { confirmDefenseCompleted } from './completion-actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button className="button button-small" disabled={pending} type="submit">
      {pending ? 'Confirming…' : 'Mark Completed'}
    </button>
  )
}

export default function CompleteDefenseForm({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button className="button button-small" onClick={() => setOpen(true)} type="button">
        Confirm Done
      </button>
    )
  }

  return (
    <form action={confirmDefenseCompleted} className="completion-confirm-form">
      <input name="groupId" type="hidden" value={groupId} />
      <label htmlFor={`completion-note-${groupId}`}>
        Completion note <span>Optional</span>
      </label>
      <textarea
        id={`completion-note-${groupId}`}
        maxLength={500}
        name="completionNote"
        placeholder="Optional note, e.g., Defense completed as scheduled."
      />
      <p>Confirm only if the defense actually took place and is finished.</p>
      <div className="completion-confirm-actions">
        <button className="button button-secondary button-small" onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
        <SubmitButton />
      </div>
    </form>
  )
}
