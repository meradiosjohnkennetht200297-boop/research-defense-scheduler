'use client'

import { useState } from 'react'
import { cancelResearchRecord, deletePendingResearchRecord } from './record/actions'
import styles from './workspace-record-options.module.css'

export default function WorkspaceRecordOptions({
  groupId,
  publicCode,
  status,
  hasSchedule,
  historyCheckFailed,
  initialOpen = false,
}: {
  groupId: string
  publicCode: string
  status: string
  hasSchedule: boolean
  historyCheckFailed: boolean
  initialOpen?: boolean
}) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmCode, setConfirmCode] = useState('')

  const canCancel = status === 'pending' || status === 'scheduled'
  const canDelete = !historyCheckFailed && status === 'pending' && !hasSchedule
  const statusLabel = status ? status[0].toUpperCase() + status.slice(1) : 'Unknown'
  const cancelLabel = status === 'scheduled' ? 'Cancel Defense' : 'Cancel Submission'

  const deleteReason = historyCheckFailed
    ? 'Unavailable · Defense history could not be verified'
    : status === 'completed'
      ? 'Unavailable · Completed record'
      : status === 'cancelled'
        ? 'Unavailable · Cancelled record retained'
        : hasSchedule
          ? 'Unavailable · Defense history exists'
          : 'Unavailable · Only Pending submissions can be deleted'

  return (
    <details className={`card ${styles.shell}`} open={initialOpen || undefined}>
      <summary className={styles.summary}>
        <span>Record Options</span>
        <span className={styles.summaryStatus}>{statusLabel}</span>
      </summary>

      <div className={styles.body}>
        <div className={styles.statusRow}>
          <span>Status</span>
          <strong>{statusLabel}</strong>
        </div>

        {canCancel ? (
          confirmCancel ? (
            <div className={styles.confirmBox}>
              <strong>{status === 'scheduled' ? 'Cancel this defense?' : 'Cancel this submission?'}</strong>
              <p>{status === 'scheduled' ? 'The schedule will be unpublished and the record kept.' : 'The submission will be kept as a Cancelled record.'}</p>
              <div className={styles.confirmActions}>
                <form action={cancelResearchRecord}>
                  <input name="groupId" type="hidden" value={groupId} />
                  <button className="button" type="submit">Confirm Cancellation</button>
                </form>
                <button className="button button-secondary" onClick={() => setConfirmCancel(false)} type="button">Keep Active</button>
              </div>
            </div>
          ) : (
            <button className="button button-secondary" onClick={() => setConfirmCancel(true)} type="button">{cancelLabel}</button>
          )
        ) : status === 'completed' ? (
          <p className={styles.state}>Record protected</p>
        ) : status === 'cancelled' ? (
          <p className={styles.state}>Record retained</p>
        ) : null}

        <details className={styles.danger}>
          <summary>Danger zone</summary>
          <div className={styles.dangerBody}>
            <strong>Delete permanently</strong>
            {canDelete ? (
              <>
                <label htmlFor={`confirm-code-${groupId}`}>Type <b>{publicCode}</b> to confirm</label>
                <input
                  autoComplete="off"
                  id={`confirm-code-${groupId}`}
                  onChange={(event) => setConfirmCode(event.target.value)}
                  value={confirmCode}
                />
                <form action={deletePendingResearchRecord}>
                  <input name="groupId" type="hidden" value={groupId} />
                  <button className={styles.deleteButton} disabled={confirmCode.trim() !== publicCode} type="submit">Delete Permanently</button>
                </form>
              </>
            ) : (
              <p className={styles.unavailable}>{deleteReason}</p>
            )}
          </div>
        </details>
      </div>
    </details>
  )
}
