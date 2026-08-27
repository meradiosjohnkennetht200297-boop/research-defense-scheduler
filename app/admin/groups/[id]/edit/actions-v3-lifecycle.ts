'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RESEARCH_DESIGN_VALUES } from '@/lib/research-design'

const PROGRAMS = new Set(['BEED', 'BSED', 'BSA', 'BSAIS', 'BSBA'])
const BSED = new Set(['English', 'Filipino', 'Mathematics', 'Science'])
const BSBA = new Set(['MM', 'FM', 'HRM'])
const clean = (value: FormDataEntryValue | null) => String(value ?? '').trim()
function fail(id: string, message: string): never { redirect(`/admin/groups/${id}/edit?error=${encodeURIComponent(message)}`) }

export async function saveResearchGroupEdits(formData: FormData) {
  const id = clean(formData.get('groupId'))
  const title = clean(formData.get('title'))
  const program = clean(formData.get('program')).toUpperCase()
  let major = clean(formData.get('major'))
  const researchDesign = clean(formData.get('researchDesign'))
  let researchDesignOther = clean(formData.get('researchDesignOther'))
  const contact = clean(formData.get('contactPerson'))
  const email = clean(formData.get('contactEmail'))
  const number = clean(formData.get('contactNumber'))
  const file = clean(formData.get('researchFileUrl'))
  const instructor = clean(formData.get('instructorId')) || null
  const adviser = clean(formData.get('adviserId')) || null
  const members = clean(formData.get('members')).split(/\r?\n/).map((value) => value.trim()).filter(Boolean)

  if (!id) redirect('/admin/groups')
  if (!title) fail(id, 'Research title is required.')
  if (!contact) fail(id, 'Contact person is required.')
  if (!PROGRAMS.has(program)) fail(id, 'Select a valid program.')
  if (members.length < 1 || members.length > 20) fail(id, 'Enter between 1 and 20 group members, one name per line.')
  if (program === 'BSED' && !BSED.has(major)) fail(id, 'Select a valid BSED major.')
  if (program === 'BSBA' && !BSBA.has(major)) fail(id, 'Select a valid BSBA major.')
  if (['BEED', 'BSA', 'BSAIS'].includes(program)) major = ''
  if (researchDesign && !RESEARCH_DESIGN_VALUES.has(researchDesign)) fail(id, 'Select a valid research design.')
  if (researchDesign === 'other' && !researchDesignOther) fail(id, 'Specify the research design.')
  if (researchDesign !== 'other') researchDesignOther = ''
  if (file && !/^https:\/\/(drive|docs)\.google\.com\//i.test(file)) fail(id, 'Enter a valid Google Drive research file link.')

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const uid = claims?.claims?.sub
  if (!uid) redirect('/admin')
  const { data: admin } = await supabase.from('admin_profiles').select('user_id').eq('user_id', uid).eq('is_active', true).maybeSingle()
  if (!admin) redirect('/admin')

  const [currentResult, oldMembersResult, defenseResult] = await Promise.all([
    supabase.from('research_groups').select('instructor_id, adviser_id, status, defense_type').eq('id', id).maybeSingle(),
    supabase.from('group_members').select('id, sort_order').eq('research_group_id', id).order('sort_order'),
    supabase.from('research_defenses').select('id, status, defense_type').eq('research_group_id', id).order('requested_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const current = currentResult.data
  const activeDefense = defenseResult.data
  if (!current || !activeDefense) fail(id, 'Research record not found.')
  if (!['pending', 'scheduled'].includes(activeDefense.status)) redirect(`/admin/groups/${id}?error=${encodeURIComponent('Completed or cancelled defense stages are protected. Students must request the next stage before the research details can be edited.')}`)

  if (instructor && instructor !== current.instructor_id) {
    const { data } = await supabase.from('faculty').select('id').eq('id', instructor).eq('is_active', true).eq('can_teach_research', true).maybeSingle()
    if (!data) fail(id, 'Selected research instructor is unavailable.')
  }
  if (adviser && adviser !== current.adviser_id) {
    const { data } = await supabase.from('faculty').select('id').eq('id', adviser).eq('is_active', true).eq('can_advise', true).maybeSingle()
    if (!data) fail(id, 'Selected research adviser is unavailable.')
  }

  const { error: groupError } = await supabase.from('research_groups').update({
    title,
    program,
    major: major || null,
    research_design: researchDesign || null,
    research_design_other: researchDesign === 'other' ? researchDesignOther : null,
    contact_person: contact,
    contact_email: email || null,
    contact_number: number || null,
    research_file_url: file || null,
    instructor_id: instructor,
    adviser_id: adviser,
    defense_type: activeDefense.defense_type,
  }).eq('id', id)
  if (groupError) fail(id, 'Unable to save the research information. Please try again.')

  const old = oldMembersResult.data ?? []
  const rows = members.map((full_name, index) => ({ id: old[index]?.id ?? crypto.randomUUID(), research_group_id: id, full_name, sort_order: index }))
  const { error: memberError } = await supabase.from('group_members').upsert(rows)
  if (memberError) fail(id, 'Research information was saved, but the group members could not be updated.')
  const obsolete = old.slice(members.length).map((row) => row.id)
  if (obsolete.length) {
    const { error } = await supabase.from('group_members').delete().in('id', obsolete)
    if (error) fail(id, 'The group was updated, but older member rows could not be removed.')
  }

  const { error: snapshotError } = await supabase.from('research_defenses').update({ title_snapshot: title, program_snapshot: program, major_snapshot: major || null, research_file_url: file || null, adviser_id_snapshot: adviser, instructor_id_snapshot: instructor, members_snapshot: members }).eq('id', activeDefense.id)
  if (snapshotError) fail(id, 'The research was updated, but the current defense snapshot could not be synchronized.')

  for (const path of ['/', '/schedule', '/status', '/admin/dashboard', '/admin/groups', `/admin/groups/${id}`, `/admin/groups/${id}/edit`, '/admin/schedule', '/admin/history']) revalidatePath(path)
  redirect(`/admin/groups/${id}/edit?saved=1`)
}
