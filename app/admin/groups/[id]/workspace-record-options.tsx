'use client'

import { useState } from 'react'
import { deletePendingResearchRecord } from './record/actions'
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
  const [confirmCode, setConfirmCode] = useState('')
  const canDelete = !historyCheckFailed && status === 'pending' && !hasSchedule
  const statusLabel = status ? status[0].toUpperCase() + status.slice(1) : 'Unknown'

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
    <details className={`card ${styles.shell}`} open={initialOpen || undefined}>
      <summary className={styles.summary}>
        <span>Record Options</span>
        <span className={styles.summaryStatus}>{statusLabel}</span>
      </summary>

      <div className={styles.body}>
        {status === 'completed' ? <p className={styles.state}>Record protected</p> : null}
        {status === 'cancelled' ? <p className={styles.state}>Legacy record retained</p> : null}

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
