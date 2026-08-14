'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type ScheduleConflict = {
  kind: 'venue' | 'faculty'
  public_code: string
  title: string
  defense_date: string
  start_time: string
  end_time: string
  venue: string
  faculty_name?: string
  new_roles?: string[]
  existing_roles?: string[]
}

type SaveResult = {
  ok?: boolean
  error?: string
  conflicts?: ScheduleConflict[]
}

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

function groupError(groupId: string, message: string): never {
  redirect(`/admin/groups/${groupId}?error=${encodeURIComponent(message)}`)
}

function conflictRedirect(groupId: string, conflicts: ScheduleConflict[]) {
  const details = conflicts.slice(0, 5).map((conflict) => {
    if (conflict.kind === 'venue') {
      return `Venue ${conflict.venue} overlaps with ${conflict.public_code} (${conflict.title})`
    }
    return `${conflict.faculty_name ?? 'A faculty member'} is already assigned to ${conflict.public_code} (${conflict.title}) as ${(conflict.existing_roles ?? []).join(', ') || 'faculty'}`
  })
  const message = `Schedule not saved because of conflict${conflicts.length === 1 ? '' : 's'}: ${details.join('; ')}.`
  groupError(groupId, message)
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
  const isPublished = formData.get('isPublished') === 'on'
  const memberIds = [...new Set(
    formData
      .getAll('memberIds')
      .map((value) => String(value).trim())
      .filter(Boolean)
  )]
    .filter((id) => id !== chairId)
    .slice(0, 4)

  if (!groupId || !defenseType || !defenseDate || !startTime || !endTime || !venue || !chairId) {
    groupError(groupId, 'Defense type, date, start time, end time, venue, and panel chair are required.')
  }

  const allowedDefenseTypes = new Set(['title', 'proposal', 'final'])
  if (!allowedDefenseTypes.has(defenseType)) {
    groupError(groupId, 'Please select a valid defense type.')
  }

  if (endTime <= startTime) {
    groupError(groupId, 'End time must be later than start time.')
  }

  const supabase = await requireAdmin()
  const { data: group, error: groupLookupError } = await supabase
    .from('research_groups')
    .select('id, status')
    .eq('id', groupId)
    .maybeSingle()

  if (groupLookupError || !group) {
    groupError(groupId, 'The research record could not be verified. No schedule change was made.')
  }
  if (group.status === 'completed') {
    groupError(groupId, 'Completed research records are protected. The schedule was not changed.')
  }
  if (group.status === 'cancelled') {
    groupError(groupId, 'This is a legacy Cancelled record and cannot be rescheduled from this workspace.')
  }
  if (!['pending', 'scheduled'].includes(group.status)) {
    groupError(groupId, 'This research record cannot be scheduled.')
  }

  const { data, error } = await supabase.rpc('save_defense_schedule_checked', {
    p_group_id: groupId,
    p_defense_type: defenseType,
    p_defense_date: defenseDate,
    p_start_time: startTime,
    p_end_time: endTime,
    p_venue: venue,
    p_notes: notes || null,
    p_chair_id: chairId,
    p_member_ids: memberIds,
    p_status: 'scheduled',
    p_is_published: isPublished,
  })

  if (error) {
    console.error('Conflict-checked schedule save failed:', error.message)
    groupError(groupId, 'Unable to save the defense schedule. Please try again.')
  }

  const result = (data ?? {}) as SaveResult

  if (!result.ok) {
    if (Array.isArray(result.conflicts) && result.conflicts.length > 0) {
      conflictRedirect(groupId, result.conflicts)
    }
    groupError(groupId, result.error || 'Unable to save the defense schedule. Please review the details and try again.')
  }

  revalidatePath('/')
  revalidatePath('/schedule')
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/groups')
  revalidatePath(`/admin/groups/${groupId}`)
  revalidatePath('/admin/schedule')
  redirect(`/admin/groups/${groupId}?saved=1`)
}
