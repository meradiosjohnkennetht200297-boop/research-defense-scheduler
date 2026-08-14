'use client'

import { useState } from 'react'
import { cancelResearchRecord, deletePendingResearchRecord } from './actions'
import styles from './record.module.css'

export default function RecordActions({
  groupId,
  publicCode,
  status,
  hasSchedule,
  historyCheckFailed,
}: {
  groupId: string
  publicCode: string
  status: string
  hasSchedule: boolean
  historyCheckFailed: boolean
}) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmCode, setConfirmCode] = useState('')

  const canCancel = status === 'pending' || status === 'scheduled'
  const canDelete = !historyCheckFailed && status === 'pending' && !hasSchedule
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
    <div className={styles.actions}>
      {canCancel ? (
        confirmCancel ? (
          <div className={styles.confirmBox}>
            <strong>{status === 'scheduled' ? 'Cancel this defense?' : 'Cancel this submission?'}</strong>
            <p>
              {status === 'scheduled'
                ? 'The schedule will be unpublished and the record kept as Cancelled.'
                : 'The submission will be kept as a Cancelled record.'}
            </p>
            <div className={styles.confirmActions}>
              <form action={cancelResearchRecord}>
                <input name="groupId" type="hidden" value={groupId} />
                <button className="button" type="submit">Confirm Cancellation</button>
              </form>
              <button className="button button-secondary" onClick={() => setConfirmCancel(false)} type="button">
                Keep Active
              </button>
            </div>
          </div>
        ) : (
          <button className="button button-secondary" onClick={() => setConfirmCancel(true)} type="button">
            {cancelLabel}
          </button>
        )
      ) : status === 'completed' ? (
        <p className={styles.recordState}>Record protected</p>
      ) : status === 'cancelled' ? (
        <p className={styles.recordState}>Record retained</p>
      ) : null}

      <details className={styles.danger}>
        <summary>Danger zone</summary>
        <div className={styles.dangerBody}>
          <strong>Delete permanently</strong>
          {canDelete ? (
            <>
              <label htmlFor="confirm-code">Type <b>{publicCode}</b> to confirm</label>
              <input
                autoComplete="off"
                id="confirm-code"
                onChange={(event) => setConfirmCode(event.target.value)}
                value={confirmCode}
              />
              <form action={deletePendingResearchRecord}>
                <input name="groupId" type="hidden" value={groupId} />
                <button className={styles.deleteButton} disabled={confirmCode.trim() !== publicCode} type="submit">
                  Delete Permanently
                </button>
              </form>
            </>
          ) : (
            <p className={styles.unavailable}>{deleteReason}</p>
          )}
        </div>
      </details>
    </div>
  )
}
