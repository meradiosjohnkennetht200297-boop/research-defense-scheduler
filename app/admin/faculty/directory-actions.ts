'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(){const supabase=await createClient();const{data:claimsData}=await supabase.auth.getClaims();const userId=claimsData?.claims?.sub;if(!userId)redirect('/admin');const{data:profile}=await supabase.from('admin_profiles').select('user_id').eq('user_id',userId).eq('is_active',true).maybeSingle();if(!profile)redirect('/admin');return supabase}
function go(message:string,type:'success'|'error'='success'):never{redirect(`/admin/faculty?${type}=${encodeURIComponent(message)}`)}
function goRecord(id:string,message:string,type:'success'|'error'='success'):never{redirect(`/admin/faculty/${id}?${type}=${encodeURIComponent(message)}`)}
function text(value:FormDataEntryValue|null,max:number){return String(value??'').trim().replace(/\s+/g,' ').slice(0,max)}
function facultyId(value:FormDataEntryValue|null){const id=text(value,36);return/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)?id:''}
function capabilityValues(formData:FormData){return{can_serve_panel:formData.get('canServePanel')==='on',can_chair:formData.get('canChair')==='on',can_advise:formData.get('canAdvise')==='on',can_teach_research:formData.get('canTeachResearch')==='on'}}
function writeError(error:{code?:string}|null,fallback:string){return error?.code==='23505'?'A faculty record with this name already exists.':fallback}
function refresh(id?:string){revalidatePath('/admin/faculty');if(id)revalidatePath(`/admin/faculty/${id}`);revalidatePath('/admin/groups');revalidatePath('/admin/dashboard');revalidatePath('/admin/schedule');revalidatePath('/schedule');revalidatePath('/submit')}

async function scheduledAssignmentState(supabase:Awaited<ReturnType<typeof createClient>>,id:string){
 const[stageResult,panelResult]=await Promise.all([
  supabase.from('research_defenses').select('id').eq('status','scheduled').or(`instructor_id_snapshot.eq.${id},adviser_id_snapshot.eq.${id}`).limit(1),
  supabase.from('panel_assignments').select('defense_schedule_id').eq('faculty_id',id),
 ])
 if(stageResult.error||panelResult.error)return{assigned:true,failed:true}
 if((stageResult.data?.length??0)>0)return{assigned:true,failed:false}
 const scheduleIds=[...new Set((panelResult.data??[]).map(row=>row.defense_schedule_id).filter(Boolean))]
 if(!scheduleIds.length)return{assigned:false,failed:false}
 const scheduleResult=await supabase.from('defense_schedules').select('id, research_defenses!inner(status)').in('id',scheduleIds).eq('research_defenses.status','scheduled').limit(1)
 if(scheduleResult.error)return{assigned:true,failed:true}
 return{assigned:(scheduleResult.data?.length??0)>0,failed:false}
}

async function referenceState(supabase:Awaited<ReturnType<typeof createClient>>,id:string){
 const[currentResearchResult,stageResult,panelResult]=await Promise.all([
  supabase.from('research_groups').select('id').or(`instructor_id.eq.${id},adviser_id.eq.${id}`).limit(1),
  supabase.from('research_defenses').select('id').or(`instructor_id_snapshot.eq.${id},adviser_id_snapshot.eq.${id}`).limit(1),
  supabase.from('panel_assignments').select('defense_schedule_id').eq('faculty_id',id).limit(1),
 ])
 if(currentResearchResult.error||stageResult.error||panelResult.error)return{referenced:true,failed:true}
 return{referenced:(currentResearchResult.data?.length??0)>0||(stageResult.data?.length??0)>0||(panelResult.data?.length??0)>0,failed:false}
}

export async function addFacultyDirectory(formData:FormData){const fullName=text(formData.get('fullName'),150),email=text(formData.get('email'),254),department=text(formData.get('department'),120);if(!fullName)go('Faculty name is required.','error');const supabase=await requireAdmin();const{error}=await supabase.from('faculty').insert({full_name:fullName,email:email||null,department:department||null,is_active:true,...capabilityValues(formData)});if(error)go(writeError(error,'Unable to add faculty. Please check the information and try again.'),'error');refresh();go('Faculty member added.')}

export async function updateFacultyDirectory(formData:FormData){const id=facultyId(formData.get('id')),fullName=text(formData.get('fullName'),150),email=text(formData.get('email'),254),department=text(formData.get('department'),120);if(!id||!fullName)go('Faculty name is required.','error');const supabase=await requireAdmin();const{error}=await supabase.from('faculty').update({full_name:fullName,email:email||null,department:department||null,...capabilityValues(formData)}).eq('id',id);if(error)go(writeError(error,'Unable to update faculty.'),'error');refresh(id);go('Faculty information and capabilities updated.')}

export async function toggleFacultyDirectory(formData:FormData){const id=facultyId(formData.get('id')),nextActive=String(formData.get('nextActive')??'')==='true';if(!id)go('Faculty record was not found.','error');const supabase=await requireAdmin();if(!nextActive){const state=await scheduledAssignmentState(supabase,id);if(state.failed)go('Unable to verify current defense assignments. Faculty status was not changed.','error');if(state.assigned)go('This faculty member is assigned to a scheduled defense. Reassign or complete that defense before deactivating the record.','error')}const{error}=await supabase.from('faculty').update({is_active:nextActive}).eq('id',id);if(error)go('Unable to change faculty status.','error');refresh(id);go(nextActive?'Faculty member activated.':'Faculty member deactivated.')}

export async function updateFacultyRecord(formData:FormData){const id=facultyId(formData.get('id')),fullName=text(formData.get('fullName'),150),email=text(formData.get('email'),254),department=text(formData.get('department'),120);if(!id)redirect('/admin/faculty');if(!fullName)goRecord(id,'Faculty name is required.','error');const supabase=await requireAdmin();const{data:person}=await supabase.from('faculty').select('id').eq('id',id).maybeSingle();if(!person)goRecord(id,'Faculty record was not found.','error');const{error}=await supabase.from('faculty').update({full_name:fullName,email:email||null,department:department||null,...capabilityValues(formData)}).eq('id',id);if(error)goRecord(id,writeError(error,'Unable to update faculty.'),'error');refresh(id);goRecord(id,'Faculty information and capabilities updated.')}

export async function toggleFacultyRecord(formData:FormData){const id=facultyId(formData.get('id')),nextActive=String(formData.get('nextActive')??'')==='true';if(!id)redirect('/admin/faculty');const supabase=await requireAdmin();const{data:person}=await supabase.from('faculty').select('id').eq('id',id).maybeSingle();if(!person)goRecord(id,'Faculty record was not found.','error');if(!nextActive){const state=await scheduledAssignmentState(supabase,id);if(state.failed)goRecord(id,'Unable to verify current defense assignments. Faculty status was not changed.','error');if(state.assigned)goRecord(id,'This faculty member is assigned to a scheduled defense. Reassign or complete that defense before deactivating the record.','error')}const{error}=await supabase.from('faculty').update({is_active:nextActive}).eq('id',id);if(error)goRecord(id,'Unable to change faculty status.','error');refresh(id);goRecord(id,nextActive?'Faculty member activated.':'Faculty member deactivated.')}

export async function deleteFacultyRecord(formData:FormData){const id=facultyId(formData.get('id')),confirmation=text(formData.get('confirmation'),150);if(!id)redirect('/admin/faculty');const supabase=await requireAdmin();const{data:person,error:personError}=await supabase.from('faculty').select('full_name').eq('id',id).maybeSingle();if(personError||!person)goRecord(id,'Faculty record was not found.','error');if(confirmation!==text(person.full_name,150))goRecord(id,'Type the faculty name exactly to confirm permanent deletion.','error');const state=await referenceState(supabase,id);if(state.failed)goRecord(id,'Unable to verify faculty history. Permanent deletion was blocked.','error');if(state.referenced)goRecord(id,'This faculty member has research or defense history and cannot be permanently deleted. Deactivate the record instead.','error');const{error}=await supabase.from('faculty').delete().eq('id',id);if(error)goRecord(id,'Unable to permanently delete this faculty record.','error');refresh();go('Faculty record permanently deleted.')}
