'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { cancelResearchRecord, deletePendingResearchRecord } from './record/actions'
import recordStyles from './workspace-record-options.module.css'

type RecordMeta = {
  groupId: string
  publicCode: string
  status: string
  hasSchedule: boolean
}

export default function WorkspaceFormControlsV5() {
  const { pending } = useFormStatus()
  const rootRef = useRef<HTMLDivElement>(null)
  const [dirty, setDirty] = useState(false)
  const [recordMeta, setRecordMeta] = useState<RecordMeta | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmCode, setConfirmCode] = useState('')
  const [recordPending, startRecordTransition] = useTransition()

  useEffect(() => {
    const form = rootRef.current?.closest('form')
    if (!form) return

    const statusSelect = form.querySelector<HTMLSelectElement>('select[name="status"]')
    if (statusSelect) {
      statusSelect.value = 'scheduled'
      statusSelect.disabled = true
      statusSelect.closest<HTMLElement>('.field')?.style.setProperty('display', 'none', 'important')

      const section = statusSelect.closest<HTMLElement>('.workspace-form-section')
      const heading = section?.querySelector<HTMLElement>('.workspace-section-heading h3')
      const description = section?.querySelector<HTMLElement>('.workspace-section-heading p')
      const help = section?.querySelector<HTMLElement>('.workspace-publish-copy small')
      const grid = section?.querySelector<HTMLElement>('.workspace-status-grid')

      if (grid) grid.style.gridTemplateColumns = '1fr'
      if (heading) heading.textContent = 'Public visibility'
      if (description) description.textContent = 'Choose whether this scheduled defense appears on the public schedule.'
      if (help) help.textContent = 'Turn this on when the defense is ready to appear publicly. It disappears automatically after the end time.'
    }

    const rescheduleAlert = Array.from(document.querySelectorAll<HTMLElement>('.alert-warning'))
      .find((element) => element.textContent?.includes('keep the status as Scheduled'))
    if (rescheduleAlert) rescheduleAlert.textContent = 'Enter the new date and time, then save the assignment. The defense will automatically remain Scheduled.'

    const groupId = form.querySelector<HTMLInputElement>('input[name="groupId"]')?.value ?? ''
    const publicCode = document.querySelector<HTMLElement>('.workspace-research-labels .code')?.textContent?.trim() ?? ''
    const currentStatus = document.querySelector<HTMLElement>('.workspace-research-labels .status-pill')?.textContent?.trim().toLowerCase() ?? ''
    const hasSchedule = Boolean(form.querySelector<HTMLInputElement>('input[name="defenseDate"]')?.defaultValue)
    if (groupId && publicCode && currentStatus) setRecordMeta({ groupId, publicCode, status: currentStatus, hasSchedule })

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

  function cancelChanges() {
    rootRef.current?.closest('form')?.reset()
    setDirty(false)
  }

  function runRecordAction(action: (formData: FormData) => Promise<void>, groupId: string) {
    const formData = new FormData()
    formData.set('groupId', groupId)
    startRecordTransition(() => {
      void action(formData)
    })
  }

  const statusLabel = recordMeta?.status ? recordMeta.status[0].toUpperCase() + recordMeta.status.slice(1) : ''
  const canCancel = recordMeta?.status === 'pending' || recordMeta?.status === 'scheduled'
  const canDelete = recordMeta?.status === 'pending' && !recordMeta.hasSchedule
  const deleteReason = recordMeta?.status === 'completed'
    ? 'Unavailable · Completed record'
    : recordMeta?.status === 'cancelled'
      ? 'Unavailable · Cancelled record retained'
      : recordMeta?.hasSchedule
        ? 'Unavailable · Defense history exists'
        : 'Unavailable · Only Pending submissions can be deleted'

  return (
    <>
      <div className="workspace-form-actions" ref={rootRef}>
        <div className="workspace-save-note">
          <strong>{dirty ? 'Changes have not been saved.' : 'No unsaved changes.'}</strong>
        </div>
        <div className="workspace-action-buttons">
          <button className="button button-secondary workspace-cancel-button" disabled={!dirty || pending} onClick={cancelChanges} type="button">Cancel Changes</button>
          <button className="button workspace-save-button" disabled={pending} type="submit">{pending ? 'Saving…' : 'Save Schedule'}</button>
        </div>
      </div>

      {recordMeta ? (
        <details className={recordStyles.shell}>
          <summary className={recordStyles.summary}>
            <span>Record Options</span>
            <span className={recordStyles.summaryStatus}>{statusLabel}</span>
          </summary>
          <div className={recordStyles.body}>
            <div className={recordStyles.statusRow}><span>Status</span><strong>{statusLabel}</strong></div>

            {dirty ? <p className={recordStyles.state}>Save or discard schedule changes before managing this record.</p> : null}

            {canCancel ? (
              confirmCancel ? (
                <div className={recordStyles.confirmBox}>
                  <strong>{recordMeta.status === 'scheduled' ? 'Cancel this defense?' : 'Cancel this submission?'}</strong>
                  <p>{recordMeta.status === 'scheduled' ? 'The schedule will be unpublished and the record kept.' : 'The submission will be kept as a Cancelled record.'}</p>
                  <div className={recordStyles.confirmActions}>
                    <button
                      className="button"
                      disabled={dirty || recordPending}
                      onClick={() => runRecordAction(cancelResearchRecord, recordMeta.groupId)}
                      type="button"
                    >{recordPending ? 'Working…' : 'Confirm Cancellation'}</button>
                    <button className="button button-secondary" disabled={recordPending} onClick={() => setConfirmCancel(false)} type="button">Keep Active</button>
                  </div>
                </div>
              ) : (
                <button
                  className="button button-secondary"
                  disabled={dirty || recordPending}
                  onClick={() => setConfirmCancel(true)}
                  type="button"
                >{recordMeta.status === 'scheduled' ? 'Cancel Defense' : 'Cancel Submission'}</button>
              )
            ) : recordMeta.status === 'completed' ? (
              <p className={recordStyles.state}>Record protected</p>
            ) : recordMeta.status === 'cancelled' ? (
              <p className={recordStyles.state}>Record retained</p>
            ) : null}

            <details className={recordStyles.danger}>
              <summary>Danger zone</summary>
              <div className={recordStyles.dangerBody}>
                <strong>Delete permanently</strong>
                {canDelete ? (
                  <>
                    <label htmlFor={`workspace-confirm-code-${recordMeta.groupId}`}>Type <b>{recordMeta.publicCode}</b> to confirm</label>
                    <input
                      autoComplete="off"
                      disabled={dirty || recordPending}
                      id={`workspace-confirm-code-${recordMeta.groupId}`}
                      onChange={(event) => setConfirmCode(event.target.value)}
                      value={confirmCode}
                    />
                    <button
                      className={recordStyles.deleteButton}
                      disabled={dirty || recordPending || confirmCode.trim() !== recordMeta.publicCode}
                      onClick={() => runRecordAction(deletePendingResearchRecord, recordMeta.groupId)}
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
      ) : null}
    </>
  )
}
