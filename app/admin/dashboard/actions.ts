'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function clean(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (!userId) redirect('/admin')

  const { data: profile } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!profile) redirect('/admin')
  return supabase
}

export async function markDefenseCompleted(formData: FormData) {
  const groupId = clean(formData.get('groupId'))
  if (!groupId) redirect('/admin/dashboard?error=Invalid%20research%20group.')

  const supabase = await requireAdmin()
  const { data: schedule } = await supabase
    .from('defense_schedules')
    .select('id, defense_date, end_time')
    .eq('research_group_id', groupId)
    .maybeSingle()

  if (!schedule?.end_time) {
    redirect('/admin/dashboard?error=No%20completed%20schedule%20was%20found.')
  }

  const endTimestamp = new Date(
    `${schedule.defense_date}T${String(schedule.end_time).slice(0, 8)}+08:00`
  ).getTime()

  if (endTimestamp > Date.now()) {
    redirect('/admin/dashboard?error=This%20defense%20has%20not%20ended%20yet.')
  }

  const { error: scheduleError } = await supabase
    .from('defense_schedules')
    .update({ is_published: false })
    .eq('id', schedule.id)

  if (scheduleError) {
    redirect('/admin/dashboard?error=Unable%20to%20update%20the%20schedule.')
  }

  const { error: groupError } = await supabase
    .from('research_groups')
    .update({ status: 'completed' })
    .eq('id', groupId)

  if (groupError) {
    redirect('/admin/dashboard?error=Schedule%20was%20hidden%2C%20but%20the%20status%20could%20not%20be%20updated.')
  }

  revalidatePath('/')
  revalidatePath('/admin/dashboard')
  revalidatePath(`/admin/groups/${groupId}`)
  redirect('/admin/dashboard?confirmed=1')
}
