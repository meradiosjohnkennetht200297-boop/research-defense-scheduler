'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

export default function WorkspaceFormControls() {
  const { pending } = useFormStatus()
  const rootRef = useRef<HTMLDivElement>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const form = rootRef.current?.closest('form')
    if (!form) return

    const statusSelect = form.querySelector<HTMLSelectElement>('select[name="status"]')
    if (statusSelect) {
      statusSelect.value = 'scheduled'
      statusSelect.disabled = true
      const statusField = statusSelect.closest<HTMLElement>('.field')
      if (statusField) statusField.hidden = true

      const section = statusSelect.closest<HTMLElement>('.workspace-form-section')
      const heading = section?.querySelector<HTMLElement>('.workspace-section-heading h3')
      const description = section?.querySelector<HTMLElement>('.workspace-section-heading p')
      const publishHelp = section?.querySelector<HTMLElement>('.workspace-publish-copy small')

      if (heading) heading.textContent = 'Public visibility'
      if (description) description.textContent = 'Choose whether this scheduled defense appears on the public schedule.'
      if (publishHelp) publishHelp.textContent = 'Turn this on when the defense is ready to appear publicly. It disappears automatically after the end time.'
    }

    const rescheduleAlert = Array.from(document.querySelectorAll<HTMLElement>('.alert-warning'))
      .find((element) => element.textContent?.includes('keep the status as Scheduled'))
    if (rescheduleAlert) {
      rescheduleAlert.textContent = 'Enter the new date and time, then save the assignment. The defense will automatically remain Scheduled.'
    }

    const markDirty = () => setDirty(true)
    const clearDirty = () => setDirty(false)
    const markPanelButtonChange = (event: Event) => {
      const target = event.target as Element | null
      if (target?.closest('.workspace-add-panel,.workspace-remove-panel')) setDirty(true)
    }

    form.addEventListener('input', markDirty)
    form.addEventListener('change', markDirty)
    form.addEventListener('click', markPanelButtonChange)
    form.addEventListener('reset', clearDirty)
    form.addEventListener('submit', clearDirty)

    return () => {
      form.removeEventListener('input', markDirty)
      form.removeEventListener('change', markDirty)
      form.removeEventListener('click', markPanelButtonChange)
      form.removeEventListener('reset', clearDirty)
      form.removeEventListener('submit', clearDirty)
    }
  }, [])

  useEffect(() => {
    if (!dirty) return

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const linkGuard = (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank') return
      if (!window.confirm('You have unsaved schedule changes. Leave this page?')) event.preventDefault()
    }

    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', linkGuard)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', linkGuard)
    }
  }, [dirty])

  function cancelChanges() {
    rootRef.current?.closest('form')?.reset()
    setDirty(false)
  }

  return (
    <div className="workspace-form-actions" ref={rootRef}>
      <div className="workspace-save-note">
        <strong>{dirty ? 'Changes have not been saved.' : 'No unsaved changes.'}</strong>
        <span>Ended published schedules are removed from the public schedule automatically.</span>
      </div>
      <div className="workspace-action-buttons">
        <button className="button button-secondary" disabled={!dirty || pending} onClick={cancelChanges} type="button">
          Cancel Changes
        </button>
        <button className="button workspace-save-button" disabled={pending} type="submit">
          {pending ? 'Saving…' : 'Save Schedule'}
        </button>
      </div>
    </div>
  )
}
