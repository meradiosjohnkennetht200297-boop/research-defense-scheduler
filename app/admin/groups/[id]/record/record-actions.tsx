'use client'

import { useState } from 'react'
import { cancelResearchRecord, deletePendingResearchRecord } from './actions'
import styles from './record.module.css'

export default function RecordActions({ groupId, publicCode, status, hasSchedule }: { groupId:string; publicCode:string; status:string; hasSchedule:boolean }) {
  const [mode,setMode]=useState<'cancel'|'delete'|null>(null)
  const [confirmCode,setConfirmCode]=useState('')
  const canCancel=status==='pending'||status==='scheduled'
  const canDelete=status==='pending'&&!hasSchedule
  if(status==='completed')return <div className={styles.protected}><strong>Historical record protected</strong><p>Completed research records are retained and cannot be cancelled or permanently deleted.</p></div>
  if(status==='cancelled')return <div className={styles.protected}><strong>Cancelled record retained</strong><p>This record remains available under the Cancelled filter and is kept for administrative reference.</p></div>
  return <div className={styles.actions}>
    {mode===null?<>{canCancel?<button className="button button-secondary" onClick={()=>setMode('cancel')} type="button">Cancel and keep record</button>:null}{canDelete?<button className={styles.deleteButton} onClick={()=>setMode('delete')} type="button">Delete permanently</button>:null}</>:null}
    {mode==='cancel'?<div className={styles.confirmBox}><strong>Cancel this research record?</strong><p>The status will become Cancelled. Any published defense schedule will be hidden, while the submission, schedule, and panel history remain stored.</p><div className={styles.confirmActions}><form action={cancelResearchRecord}><input name="groupId" type="hidden" value={groupId}/><button className="button" type="submit">Confirm cancellation</button></form><button className="button button-secondary" onClick={()=>setMode(null)} type="button">Keep active</button></div></div>:null}
    {mode==='delete'?<div className={`${styles.confirmBox} ${styles.deleteConfirm}`}><strong>Permanently delete this submission?</strong><p>This action cannot be undone. The submission and its group members will be removed. Permanent deletion is available only because no defense schedule exists.</p><label htmlFor="confirm-code">Type <b>{publicCode}</b> to confirm</label><input autoComplete="off" id="confirm-code" onChange={e=>setConfirmCode(e.target.value)} value={confirmCode}/><div className={styles.confirmActions}><form action={deletePendingResearchRecord}><input name="groupId" type="hidden" value={groupId}/><button className={styles.deleteButton} disabled={confirmCode.trim()!==publicCode} type="submit">Delete permanently</button></form><button className="button button-secondary" onClick={()=>{setMode(null);setConfirmCode('')}} type="button">Keep submission</button></div></div>:null}
  </div>
}
