import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requireDashboardAdmin(){
  const supabase=await createClient()
  const {data}=await supabase.auth.getClaims()
  const userId=data?.claims?.sub
  if(!userId)redirect('/admin')
  const {data:profile}=await supabase.from('admin_profiles').select('user_id').eq('user_id',userId).eq('is_active',true).maybeSingle()
  if(!profile)redirect('/admin')
}
