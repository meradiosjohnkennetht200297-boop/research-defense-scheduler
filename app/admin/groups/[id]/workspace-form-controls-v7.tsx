'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { deletePendingResearchRecord } from './record/actions'
import recordStyles from './workspace-record-options.module.css'

type Props = {
  groupId: string
  publicCode: string
  status: string
  hasSchedule: boolean
  locked: boolean
}

export default function WorkspaceFormControlsV7({ groupId, publicCode, status, hasSchedule, locked }: Props) {
  const { pending } = useFormStatus()
  const rootRef = useRef<HTMLDivElement>(null)
  const [dirty, setDirty] = useState(false)
  const [confirmCode, setConfirmCode] = useState('')
  const [recordPending, startRecordTransition] = useTransition()

  useEffect(() => {
    const form = rootRef.current?.closest('form')
    if (!form) return

    const markDirty = () => setDirty(true)
    const clearDirty = () => setDirty(false)
    const panelChange = (event: Event) => {
      const target = event.target as Element | null
      if (target?.closest('.workspace-add-panel,.workspace-remove-panel')) setDirty(true)
    }

    form.addEventListener('input', markDirty)
    form.addEventListener('change', markDirty)
    form.addEventListener('click', panelChange)
    form.addEventListener('reset', clearDirty)
    form.addEventListener('submit', clearDirty)
    return () => {
      form.removeEventListener('input', markDirty)
      form.removeEventListener('change', markDirty)
      form.removeEventListener('click', panelChange)
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
      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null
      if (anchor && anchor.target !== '_blank' && !window.confirm('You have unsaved schedule changes. Leave this page?')) event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', linkGuard)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', linkGuard)
    }
  }, [dirty])

  function discardChanges() {
    rootRef.current?.closest('form')?.reset()
    setDirty(false)
  }

  function deleteRecord() {
    const formData = new FormData()
    formData.set('groupId', groupId)
    startRecordTransition(() => {
      void deletePendingResearchRecord(formData)
    })
  }

  const statusLabel = status ? status[0].toUpperCase() + status.slice(1) : 'Unknown'
  const canDelete = status === 'pending' && !hasSchedule
  const deleteReason = status === 'completed'
    ? 'Unavailable · Completed record'
    : status === 'cancelled'
      ? 'Unavailable · Legacy cancelled record retained'
      : hasSchedule
        ? 'Unavailable · Defense history exists'
        : 'Unavailable · Only Pending submissions can be deleted'
  const saveLabel = locked ? 'Record Locked' : hasSchedule ? 'Save Changes' : 'Schedule Defense'

  return (
    <>
      <div className="workspace-form-actions" ref={rootRef}>
        <div className="workspace-save-note">
          <strong>{locked ? 'Schedule editing is disabled.' : dirty ? 'Changes have not been saved.' : 'No unsaved changes.'}</strong>
        </div>
        <div className="workspace-action-buttons">
          <button className="button button-secondary workspace-cancel-button" disabled={!dirty || pending || locked} onClick={discardChanges} type="button">Discard Changes</button>
          <button className="button workspace-save-button" disabled={pending || locked} type="submit">{pending ? 'Saving…' : saveLabel}</button>
        </div>
      </div>

      <details className={recordStyles.shell}>
        <summary className={recordStyles.summary}>
          <span>Record Options</span>
          <span className={recordStyles.summaryStatus}>{statusLabel}</span>
        </summary>
        <div className={recordStyles.body}>
          {dirty ? <p className={recordStyles.state}>Save or discard schedule changes before managing this record.</p> : null}
          {status === 'completed' ? <p className={recordStyles.state}>Record protected</p> : null}
          {status === 'cancelled' ? <p className={recordStyles.state}>Legacy record retained</p> : null}

          <details className={recordStyles.danger}>
            <summary>Danger zone</summary>
            <div className={recordStyles.dangerBody}>
              <strong>Delete permanently</strong>
              {canDelete ? (
                <>
                  <label htmlFor={`workspace-confirm-code-${groupId}`}>Type <b>{publicCode}</b> to confirm</label>
                  <input
                    autoComplete="off"
                    disabled={dirty || recordPending || locked}
                    id={`workspace-confirm-code-${groupId}`}
                    onChange={(event) => setConfirmCode(event.target.value)}
                    value={confirmCode}
                  />
                  <button
                    className={recordStyles.deleteButton}
                    disabled={dirty || recordPending || locked || confirmCode.trim() !== publicCode}
                    onClick={deleteRecord}
                    type="button"
                  >{recordPending ? 'Working…' : 'Delete Permanently'}</button>
                </>
              ) : (
                <p className={recordStyles.unavailable}>{deleteReason}</p>
              )}
            </div>
          </details>
        </div>
      </details>
    </>
  )
}
