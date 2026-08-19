'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type ScheduleConflict={kind:'venue'|'faculty';public_code:string;title:string;venue:string;faculty_name?:string;existing_roles?:string[]}
type SaveResult={ok?:boolean;error?:string;conflicts?:ScheduleConflict[]}
type LegacyTypeResult={ok?:boolean;error?:string;defense_type?:string}
const clean=(value:FormDataEntryValue|null)=>String(value??'').trim()
async function requireAdmin(){const supabase=await createClient();const{data:claimsData}=await supabase.auth.getClaims();const userId=claimsData?.claims?.sub;if(!userId)redirect('/admin');const{data:adminProfile}=await supabase.from('admin_profiles').select('user_id').eq('user_id',userId).eq('is_active',true).maybeSingle();if(!adminProfile)redirect('/admin');return supabase}
function groupError(groupId:string,message:string):never{redirect(`/admin/groups/${groupId}?error=${encodeURIComponent(message)}`)}
function conflictRedirect(groupId:string,conflicts:ScheduleConflict[]){const details=conflicts.slice(0,5).map(c=>c.kind==='venue'?`Venue ${c.venue} overlaps with ${c.public_code} (${c.title})`:`${c.faculty_name??'A faculty member'} is already assigned to ${c.public_code} (${c.title}) as ${(c.existing_roles??[]).join(', ')||'faculty'}`);groupError(groupId,`Schedule not saved because of conflict${conflicts.length===1?'':'s'}: ${details.join('; ')}.`)}

export async function saveDefenseSchedule(formData:FormData){
 const groupId=clean(formData.get('groupId')),defenseId=clean(formData.get('defenseId')),legacyDefenseType=clean(formData.get('defenseType')).toLowerCase(),defenseDate=clean(formData.get('defenseDate')),startTime=clean(formData.get('startTime')),endTime=clean(formData.get('endTime')),venue=clean(formData.get('venue')),notes=clean(formData.get('notes')),chairId=clean(formData.get('chairId')),isPublished=formData.get('isPublished')==='on',memberIds=[...new Set(formData.getAll('memberIds').map(v=>String(v).trim()).filter(Boolean))].filter(id=>id!==chairId).slice(0,4)
 if(!groupId||!defenseId||!defenseDate||!startTime||!endTime||!venue||!chairId)groupError(groupId,'Date, start time, end time, venue, and panel chair are required.');if(endTime<=startTime)groupError(groupId,'End time must be later than start time.')
 const supabase=await requireAdmin();const{data:defense,error:lookupError}=await supabase.from('research_defenses').select('id, research_group_id, defense_type, status').eq('id',defenseId).maybeSingle();if(lookupError||!defense||defense.research_group_id!==groupId)groupError(groupId,'The defense stage could not be verified. No schedule change was made.');if(!['pending','scheduled'].includes(defense.status))groupError(groupId,'Only Pending or Scheduled defense stages can be scheduled.')
 if(!defense.defense_type){
   if(!['title','proposal','final'].includes(legacyDefenseType))groupError(groupId,'Select the correct defense type for this legacy record.')
   const{data:legacyData,error:legacyError}=await supabase.rpc('set_legacy_defense_type_checked',{p_defense_id:defenseId,p_defense_type:legacyDefenseType})
   if(legacyError){console.error('Legacy defense type update failed:',legacyError.message);groupError(groupId,'Unable to record the defense type for this legacy record.')}
   const legacyResult=(legacyData??{}) as LegacyTypeResult
   if(!legacyResult.ok)groupError(groupId,legacyResult.error||'Unable to record the defense type for this legacy record.')
 }
 const{data,error}=await supabase.rpc('save_defense_schedule_checked_v2',{p_defense_id:defenseId,p_defense_date:defenseDate,p_start_time:startTime,p_end_time:endTime,p_venue:venue,p_notes:notes||null,p_chair_id:chairId,p_member_ids:memberIds,p_is_published:isPublished});if(error){console.error('Stage-aware schedule save failed:',error.message);groupError(groupId,'Unable to save the defense schedule. Please try again.')}const result=(data??{}) as SaveResult;if(!result.ok){if(Array.isArray(result.conflicts)&&result.conflicts.length)conflictRedirect(groupId,result.conflicts);groupError(groupId,result.error||'Unable to save the defense schedule.')}
 for(const path of ['/','/schedule','/status','/admin/dashboard','/admin/groups',`/admin/groups/${groupId}`,'/admin/schedule','/admin/history'])revalidatePath(path);redirect(`/admin/groups/${groupId}?saved=1`)
}
