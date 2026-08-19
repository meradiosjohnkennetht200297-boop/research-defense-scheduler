'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function clean(value:FormDataEntryValue|null,maxLength=500){return String(value??'').trim().slice(0,maxLength)}
async function requireAdmin(){const supabase=await createClient(),{data:claimsData}=await supabase.auth.getClaims(),userId=claimsData?.claims?.sub;if(!userId)redirect('/admin');const{data:profile}=await supabase.from('admin_profiles').select('user_id').eq('user_id',userId).eq('is_active',true).maybeSingle();if(!profile)redirect('/admin');return supabase}

export async function confirmDefenseCompleted(formData:FormData){
  const returnTo=clean(formData.get('returnTo'),20)
  const destination=returnTo==='schedule'?'/admin/schedule':'/admin/dashboard'
  const defenseId=clean(formData.get('defenseId'),36)
  const completionNote=clean(formData.get('completionNote'),500)
  if(!defenseId)redirect(`${destination}?error=Invalid%20defense%20stage.`)

  const supabase=await requireAdmin()
  const{data,error}=await supabase.rpc('complete_defense_schedule_v2',{p_defense_id:defenseId,p_completion_note:completionNote||null})
  if(error){console.error('Defense completion failed:',error.message);redirect(`${destination}?error=Unable%20to%20confirm%20the%20defense%20as%20completed.`)}
  const result=(data??{}) as{ok?:boolean;error?:string;research_group_id?:string}
  if(!result.ok)redirect(`${destination}?error=${encodeURIComponent(result.error||'Unable to confirm the defense as completed.')}`)

  const groupId=result.research_group_id
  for(const path of ['/','/schedule','/status','/admin/dashboard','/admin/schedule','/admin/history','/admin/groups'])revalidatePath(path)
  if(groupId)revalidatePath(`/admin/groups/${groupId}`)
  redirect(destination==='/admin/dashboard'?'/admin/dashboard?confirmed=1#action-required':'/admin/schedule?confirmed=1')
}
