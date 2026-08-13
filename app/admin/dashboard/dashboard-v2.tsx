import { requireDashboardAdmin } from './dashboard-v2-auth'
import { loadDashboardData } from './dashboard-v2-data'
import { one, stamp, todayKey } from './dashboard-v2-utils'
import Summary from './dashboard-v2-summary'
import ActionRequired from './dashboard-v2-actions'
import PendingSection from './dashboard-v2-pending'
import Today from './dashboard-v2-today'
import NextDefense from './dashboard-v2-next'

export default async function DashboardV2({searchParams}:{searchParams:Promise<{confirmed?:string;error?:string}>}){
 const params=await searchParams;await requireDashboardAdmin();const data=await loadDashboardData();const now=Date.now(),today=todayKey(),rows=data.schedules as any[]
 const actions=rows.filter(s=>{const g:any=one(s.research_groups);return g?.status==='scheduled'&&stamp(s.defense_date,s.end_time)<=now})
 const active=rows.filter(s=>{const g:any=one(s.research_groups);return g?.status==='scheduled'&&stamp(s.defense_date,s.end_time)>now}).sort((a,b)=>stamp(a.defense_date,a.start_time)-stamp(b.defense_date,b.start_time))
 const todayRows=active.filter(s=>s.defense_date===today),next=active.find(s=>s.defense_date>today)??null
 return <section className="section admin-dashboard-page"><div className="container"><div className="dashboard-heading"><div><p className="eyebrow">Admin Dashboard</p><h2>What needs your attention?</h2><p className="dashboard-intro">Review pending submissions, today&apos;s defenses, and any defense that needs follow-up.</p></div></div>{params.confirmed?<div className="alert alert-success">Defense confirmed completed and added to history.</div>:null}{params.error?<div className="alert alert-error">{params.error}</div>:null}<Summary pending={data.pendingCount} scheduled={data.scheduledCount} actions={actions.length}/><ActionRequired rows={actions}/><PendingSection groups={data.pending as any[]}/><Today rows={todayRows}/><NextDefense row={next}/></div></section>
}
