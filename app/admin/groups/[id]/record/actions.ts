'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function clean(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

function fail(id: string, message: string): never {
  redirect(`/admin/groups/${id}?error=${encodeURIComponent(message)}`)
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/admin')
  const { data: profile } = await supabase.from('admin_profiles').select('user_id').eq('user_id', userId).eq('is_active', true).maybeSingle()
  if (!profile) redirect('/admin')
  return supabase
}

function refreshRecordViews(id: string) {
  for (const path of ['/', '/schedule', '/admin/dashboard', '/admin/groups', `/admin/groups/${id}`, `/admin/groups/${id}/record`, '/admin/schedule', '/admin/history']) revalidatePath(path)
}

export async function cancelResearchRecord(formData: FormData) {
  const id = clean(formData.get('groupId'))
  if (!id) redirect('/admin/groups')
  const supabase = await requireAdmin()
  const { data: group, error: groupLookupError } = await supabase.from('research_groups').select('id,status').eq('id', id).maybeSingle()
  if (groupLookupError) fail(id, 'The research record could not be verified. No change was made.')
  if (!group) fail(id, 'Research group not found.')
  if (group.status === 'completed') fail(id, 'Completed research records are protected and cannot be cancelled.')
  if (group.status === 'cancelled') redirect(`/admin/groups/${id}`)
  if (!['pending', 'scheduled'].includes(group.status)) fail(id, 'This research record cannot be cancelled.')

  const { error: scheduleError } = await supabase.from('defense_schedules').update({ is_published: false }).eq('research_group_id', id)
  if (scheduleError) fail(id, 'The public schedule could not be hidden. No status change was made.')
  const { error: groupError } = await supabase.from('research_groups').update({ status: 'cancelled' }).eq('id', id)
  if (groupError) fail(id, 'The schedule was hidden, but the record could not be marked Cancelled. Please try again.')
  refreshRecordViews(id)
  redirect(`/admin/groups/${id}`)
}

export async function deletePendingResearchRecord(formData: FormData) {
  const id = clean(formData.get('groupId'))
  if (!id) redirect('/admin/groups')
  const supabase = await requireAdmin()
  const [groupResult, scheduleResult] = await Promise.all([
    supabase.from('research_groups').select('id,status').eq('id', id).maybeSingle(),
    supabase.from('defense_schedules').select('id').eq('research_group_id', id).maybeSingle(),
  ])
  if (groupResult.error || scheduleResult.error) fail(id, 'The record history could not be verified. Nothing was deleted.')
  const group = groupResult.data
  if (!group) fail(id, 'Research group not found.')
  if (group.status !== 'pending') fail(id, 'Only Pending submissions can be permanently deleted.')
  if (scheduleResult.data) fail(id, 'This research record has defense history and cannot be permanently deleted.')

  const { error } = await supabase.from('research_groups').delete().eq('id', id)
  if (error) fail(id, 'The submission could not be deleted. Please try again.')
  refreshRecordViews(id)
  redirect('/admin/groups')
}
