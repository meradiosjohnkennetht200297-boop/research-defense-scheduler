import Link from 'next/link'
import CompleteDefenseForm from './complete-defense-form'
import { defenseLabel, endedLabel, one } from './dashboard-v2-utils'

export default function ActionRequired({rows}:{rows:any[]}){
  if(!rows.length)return null
  return <section className="card confirmation-panel" id="action-required">
    <div className="confirmation-panel-head"><div><p className="eyebrow">Action Required</p><h3>Ended defenses awaiting confirmation</h3><p>Confirm defenses that finished, or reschedule those that did not proceed.</p></div><span className="status-pill status-warning">{rows.length} waiting</span></div>
    <div className="confirmation-list">{rows.map(s=>{const g:any=one(s.research_groups);if(!g)return null;const panel=[...(s.panel_assignments??[])].sort((a:any,b:any)=>a.sort_order-b.sort_order);const chair=panel.find((x:any)=>x.panel_role==='chair');const chairName=(one<any>(chair?.faculty))?.full_name??'Not recorded';return <div className="confirmation-item confirmation-item-refined" key={s.id}>
      <div className="confirmation-copy"><div className="schedule-labels"><span className="code">{g.public_code}</span><span className="defense-type-pill">{defenseLabel(g.defense_type)}</span></div><strong>{g.title}</strong><div className="ended-defense-meta"><span><b>Ended</b>{endedLabel(s.defense_date,s.end_time)}</span><span><b>Venue</b>{s.venue}</span><span><b>Chair</b>{chairName}</span></div></div>
      <div className="confirmation-actions confirmation-actions-refined"><CompleteDefenseForm groupId={g.id}/><Link className="button button-secondary button-small" href={`/admin/groups/${g.id}?reschedule=1`}>Reschedule</Link></div>
    </div>})}</div>
  </section>
}
