import Link from 'next/link'
import { defenseLabel } from './dashboard-v2-utils'

export default function PendingSection({groups}:{groups:any[]}){
  return <section className="dashboard-section">
    <div className="dashboard-section-heading">
      <div><p className="eyebrow">Pending Submissions</p><h3>Waiting to be scheduled</h3><p>Oldest pending submissions are shown first.</p></div>
      <Link className="button button-secondary button-small" href="/admin/groups?status=pending">View All Pending</Link>
    </div>
    <div className="card dashboard-panel">
      {!groups.length?<div className="dashboard-mini-empty"><strong>No pending submissions.</strong><span>New student submissions will appear here.</span></div>:
      <div className="dashboard-defense-list">{groups.map(g=><Link className="dashboard-defense-row" href={`/admin/groups/${g.id}`} key={g.id}>
        <span className="code">{g.public_code}</span>
        <span className="dashboard-defense-copy"><strong>{g.title}</strong><small>{g.program?`${g.program}${g.major?` - ${g.major}`:''}`:'Program not recorded'} · {defenseLabel(g.defense_type)}</small></span>
        <span aria-hidden="true">→</span>
      </Link>)}</div>}
    </div>
  </section>
}
