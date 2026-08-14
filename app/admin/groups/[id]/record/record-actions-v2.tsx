'use client'

import { useState } from 'react'
import { deletePendingResearchRecord } from './actions'
import styles from './record.module.css'

export default function RecordActionsV2({
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
  const [confirmCode, setConfirmCode] = useState('')
  const canDelete = !historyCheckFailed && status === 'pending' && !hasSchedule

  const deleteReason = historyCheckFailed
    ? 'Unavailable · Defense history could not be verified'
    : status === 'completed'
      ? 'Unavailable · Completed record'
      : status === 'cancelled'
        ? 'Unavailable · Legacy cancelled record retained'
        : hasSchedule
          ? 'Unavailable · Defense history exists'
          : 'Unavailable · Only Pending submissions can be deleted'

  return (
    <div className={styles.actions}>
      {status === 'completed' ? <p className={styles.recordState}>Record protected</p> : null}
      {status === 'cancelled' ? <p className={styles.recordState}>Legacy record retained</p> : null}

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
