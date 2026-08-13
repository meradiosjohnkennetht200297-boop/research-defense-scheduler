import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RecordActions from './record-actions'
import styles from './record.module.css'

function defenseLabel(value:string|null){return value==='title'?'Title Defense':value==='proposal'?'Proposal Defense':value==='final'?'Final Defense':'Not recorded'}
function dateLabel(value:string){const[y,m,d]=value.split('-').map(Number);return new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)))}

export default async function ResearchRecordOptions({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;cancelled?:string}>}){
 const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:claims}=await supabase.auth.getClaims();const uid=claims?.claims?.sub;if(!uid)redirect('/admin');const{data:admin}=await supabase.from('admin_profiles').select('user_id').eq('user_id',uid).eq('is_active',true).maybeSingle();if(!admin)redirect('/admin')
 const[{data:group},{data:schedule}]=await Promise.all([supabase.from('research_groups').select('id,public_code,title,program,major,defense_type,status').eq('id',id).maybeSingle(),supabase.from('defense_schedules').select('id,defense_date,start_time,end_time,venue,is_published').eq('research_group_id',id).maybeSingle()]);if(!group)notFound()
 const program=group.program?`${group.program}${group.major?` - ${group.major}`:''}`:'Not recorded'
 return <section className={`section ${styles.page}`}><div className="container">
  <div className={styles.topbar}><div className={styles.crumbs}><Link href="/admin/groups">Research Groups</Link><span>/</span><Link href={`/admin/groups/${id}`}>{group.public_code}</Link><span>/</span><span>Record Options</span></div><Link className="button button-secondary button-small" href={`/admin/groups/${id}`}>← Back to workspace</Link></div>
  {query.cancelled?<div className="alert alert-success">Research record cancelled and retained for administrative reference.</div>:null}{query.error?<div className="alert alert-error">{query.error}</div>:null}
  <div className={`card ${styles.summary}`}><div className={styles.labels}><span className="code">{group.public_code}</span><span className={`status-pill status-${group.status}`}>{group.status}</span></div><h1>{group.title}</h1><p>{program} · {defenseLabel(group.defense_type)}</p></div>
  <div className={`card ${styles.panel}`}><p className="eyebrow">Record Options</p><h2>Manage this research record</h2><p>Use cancellation when the record should be kept. Permanent deletion is restricted to Pending submissions that have never been scheduled.</p><div className={styles.facts}><div className={styles.fact}><span>Current status</span><strong>{group.status[0].toUpperCase()+group.status.slice(1)}</strong></div><div className={styles.fact}><span>Defense history</span><strong>{schedule?`${dateLabel(schedule.defense_date)} · ${schedule.venue}`:'No schedule created'}</strong></div></div><RecordActions groupId={group.id} publicCode={group.public_code} status={group.status} hasSchedule={Boolean(schedule)}/><div className={styles.note}>Cancelled records remain searchable under the Cancelled filter. Completed records are protected. A record with any defense schedule is never eligible for permanent deletion.</div></div>
 </div></section>
}
