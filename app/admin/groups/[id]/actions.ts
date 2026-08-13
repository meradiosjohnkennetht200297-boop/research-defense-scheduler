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

  const { data: adminProfile } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!adminProfile) redirect('/admin')
  return supabase
}

export async function saveDefenseSchedule(formData: FormData) {
  const groupId = clean(formData.get('groupId'))
  const defenseType = clean(formData.get('defenseType')).toLowerCase()
  const defenseDate = clean(formData.get('defenseDate'))
  const startTime = clean(formData.get('startTime'))
  const endTime = clean(formData.get('endTime'))
  const venue = clean(formData.get('venue'))
  const notes = clean(formData.get('notes'))
  const chairId = clean(formData.get('chairId'))
  const status = clean(formData.get('status'))
  const isPublished = formData.get('isPublished') === 'on'
  const memberIds = formData
    .getAll('memberIds')
    .map((value) => String(value).trim())
    .filter(Boolean)

  if (!groupId || !defenseDate || !startTime || !endTime || !venue || !chairId) {
    redirect(`/admin/groups/${groupId}?error=${encodeURIComponent('Defense type, date, start time, end time, venue, and panel chair are required.')}`)
  }

  const allowedDefenseTypes = new Set(['title', 'proposal', 'final'])
  if (!allowedDefenseTypes.has(defenseType)) {
    redirect(`/admin/groups/${groupId}?error=${encodeURIComponent('Please select a valid defense type.')}`)
  }

  if (endTime <= startTime) {
    redirect(`/admin/groups/${groupId}?error=${encodeURIComponent('End time must be later than start time.')}`)
  }

  const allowedStatuses = new Set(['pending', 'scheduled', 'completed', 'cancelled'])
  const nextStatus = allowedStatuses.has(status) ? status : 'scheduled'
  const uniqueMembers = [...new Set(memberIds)].filter((id) => id !== chairId)

  const supabase = await requireAdmin()

  const { data: group } = await supabase
    .from('research_groups')
    .select('id')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) redirect('/admin/dashboard')

  const panelIds = [chairId, ...uniqueMembers]
  const { data: activeFaculty, error: facultyError } = await supabase
    .from('faculty')
    .select('id')
    .in('id', panelIds)
    .eq('is_active', true)

  if (facultyError || (activeFaculty?.length ?? 0) !== panelIds.length) {
    redirect(`/admin/groups/${groupId}?error=${encodeURIComponent('One or more selected panelists are unavailable. Please review the panel list.')}`)
  }

  const publishSchedule = isPublished && nextStatus === 'scheduled'

  const { data: schedule, error: scheduleError } = await supabase
    .from('defense_schedules')
    .upsert(
      {
        research_group_id: groupId,
        defense_date: defenseDate,
        start_time: startTime,
        end_time: endTime,
        venue,
        notes: notes || null,
        is_published: publishSchedule,
      },
      { onConflict: 'research_group_id' }
    )
    .select('id')
    .single()

  if (scheduleError || !schedule) {
    redirect(`/admin/groups/${groupId}?error=${encodeURIComponent('Unable to save the defense schedule. Please try again.')}`)
  }

  const { error: deleteError } = await supabase
    .from('panel_assignments')
    .delete()
    .eq('defense_schedule_id', schedule.id)

  if (deleteError) {
    redirect(`/admin/groups/${groupId}?error=${encodeURIComponent('Schedule saved, but the panel list could not be updated.')}`)
  }

  const assignments = [
    {
      defense_schedule_id: schedule.id,
      faculty_id: chairId,
      panel_role: 'chair',
      sort_order: 0,
    },
    ...uniqueMembers.map((facultyId, index) => ({
      defense_schedule_id: schedule.id,
      faculty_id: facultyId,
      panel_role: 'member',
      sort_order: index + 1,
    })),
  ]

  const { error: panelError } = await supabase.from('panel_assignments').insert(assignments)

  if (panelError) {
    redirect(`/admin/groups/${groupId}?error=${encodeURIComponent('Schedule saved, but the panel list could not be completed.')}`)
  }

  const { error: groupError } = await supabase
    .from('research_groups')
    .update({ status: nextStatus, defense_type: defenseType })
    .eq('id', groupId)

  if (groupError) {
    redirect(`/admin/groups/${groupId}?error=${encodeURIComponent('Schedule saved, but the research details could not be updated.')}`)
  }

  revalidatePath('/')
  revalidatePath('/admin/dashboard')
  revalidatePath(`/admin/groups/${groupId}`)
  redirect(`/admin/groups/${groupId}?saved=1`)
}
