'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const PROGRAMS = new Set(['BEED', 'BSED', 'BSA', 'BSAIS', 'BSBA'])
const BSED_MAJORS = new Set(['English', 'Filipino', 'Mathematics', 'Science'])
const BSBA_MAJORS = new Set(['MM', 'FM', 'HRM'])
const DEFENSE_TYPES = new Set(['title', 'proposal', 'final'])

function clean(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

function fail(groupId: string, message: string): never {
  redirect(`/admin/groups/${groupId}/edit?error=${encodeURIComponent(message)}`)
}

export async function saveResearchGroupEdits(formData: FormData) {
  const groupId = clean(formData.get('groupId'))
  const title = clean(formData.get('title'))
  const program = clean(formData.get('program')).toUpperCase()
  let major = clean(formData.get('major'))
  const defenseType = clean(formData.get('defenseType')).toLowerCase()
  const contactPerson = clean(formData.get('contactPerson'))
  const contactEmail = clean(formData.get('contactEmail'))
  const contactNumber = clean(formData.get('contactNumber'))
  const researchFileUrl = clean(formData.get('researchFileUrl'))
  const instructorId = clean(formData.get('instructorId')) || null
  const adviserId = clean(formData.get('adviserId')) || null
  const members = clean(formData.get('members')).split(/\r?\n/).map((name) => name.trim()).filter(Boolean)

  if (!groupId) redirect('/admin/groups')
  if (!title) fail(groupId, 'Research title is required.')
  if (!contactPerson) fail(groupId, 'Contact person is required.')
  if (!PROGRAMS.has(program)) fail(groupId, 'Select a valid program.')
  if (!DEFENSE_TYPES.has(defenseType)) fail(groupId, 'Select a valid defense type.')
  if (members.length < 1 || members.length > 20) fail(groupId, 'Enter between 1 and 20 group members, one name per line.')
  if (program === 'BSED' && !BSED_MAJORS.has(major)) fail(groupId, 'Select a valid BSED major.')
  if (program === 'BSBA' && !BSBA_MAJORS.has(major)) fail(groupId, 'Select a valid BSBA major.')
  if (['BEED', 'BSA', 'BSAIS'].includes(program)) major = ''
  if (researchFileUrl && !/^https:\/\/(drive|docs)\.google\.com\//i.test(researchFileUrl)) fail(groupId, 'Enter a valid Google Drive research file link.')

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/admin')

  const { data: adminProfile } = await supabase.from('admin_profiles').select('user_id').eq('user_id', userId).eq('is_active', true).maybeSingle()
  if (!adminProfile) redirect('/admin')

  const [{ data: currentGroup }, { data: currentMembers }] = await Promise.all([
    supabase.from('research_groups').select('instructor_id, adviser_id').eq('id', groupId).maybeSingle(),
    supabase.from('group_members').select('id, sort_order').eq('research_group_id', groupId).order('sort_order', { ascending: true }),
  ])
  if (!currentGroup) fail(groupId, 'Research group not found.')

  if (instructorId && instructorId !== currentGroup.instructor_id) {
    const { data: instructor } = await supabase.from('faculty').select('id').eq('id', instructorId).eq('is_active', true).eq('can_teach_research', true).maybeSingle()
    if (!instructor) fail(groupId, 'Selected research instructor is unavailable.')
  }
  if (adviserId && adviserId !== currentGroup.adviser_id) {
    const { data: adviser } = await supabase.from('faculty').select('id').eq('id', adviserId).eq('is_active', true).eq('can_advise', true).maybeSingle()
    if (!adviser) fail(groupId, 'Selected research adviser is unavailable.')
  }

  const { error: groupError } = await supabase.from('research_groups').update({
    title, program, major: major || null, defense_type: defenseType,
    contact_person: contactPerson, contact_email: contactEmail || null,
    contact_number: contactNumber || null, research_file_url: researchFileUrl || null,
    instructor_id: instructorId, adviser_id: adviserId,
  }).eq('id', groupId)
  if (groupError) fail(groupId, 'Unable to save the research information. Please try again.')

  const existing = currentMembers ?? []
  const rows = members.map((fullName, index) => ({
    ...(existing[index]?.id ? { id: existing[index].id } : {}),
    research_group_id: groupId,
    full_name: fullName,
    sort_order: index,
  }))
  const { error: memberError } = await supabase.from('group_members').upsert(rows)
  if (memberError) fail(groupId, 'Research information was saved, but the group members could not be updated. Please try again.')

  const obsoleteIds = existing.slice(members.length).map((row) => row.id)
  if (obsoleteIds.length) {
    const { error: deleteError } = await supabase.from('group_members').delete().in('id', obsoleteIds)
    if (deleteError) fail(groupId, 'The group was updated, but older member rows could not be removed. Please review the member list.')
  }

  revalidatePath('/')
  revalidatePath('/schedule')
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/groups')
  revalidatePath(`/admin/groups/${groupId}`)
  revalidatePath(`/admin/groups/${groupId}/edit`)
  revalidatePath('/admin/schedule')
  redirect(`/admin/groups/${groupId}/edit?saved=1`)
}
