'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function clean(value: FormDataEntryValue | null, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength)
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

export async function confirmDefenseCompleted(formData: FormData) {
  const returnTo = clean(formData.get('returnTo'), 20)
  const destination = returnTo === 'schedule' ? '/admin/schedule' : '/admin/dashboard'
  const groupId = clean(formData.get('groupId'), 36)
  const completionNote = clean(formData.get('completionNote'), 500)
  if (!groupId) redirect(`${destination}?error=Invalid%20research%20group.`)

  const supabase = await requireAdmin()
  const { data, error } = await supabase.rpc('complete_defense_schedule', {
    p_group_id: groupId,
    p_completion_note: completionNote || null,
  })

  if (error) {
    console.error('Defense completion failed:', error.message)
    redirect(`${destination}?error=Unable%20to%20confirm%20the%20defense%20as%20completed.`)
  }

  const result = (data ?? {}) as { ok?: boolean; error?: string }
  if (!result.ok) {
    redirect(`${destination}?error=${encodeURIComponent(result.error || 'Unable to confirm the defense as completed.')}`)
  }

  revalidatePath('/')
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/schedule')
  revalidatePath('/admin/history')
  revalidatePath('/admin/groups')
  revalidatePath(`/admin/groups/${groupId}`)
  redirect(`${destination}?confirmed=1#action-required`)
}
