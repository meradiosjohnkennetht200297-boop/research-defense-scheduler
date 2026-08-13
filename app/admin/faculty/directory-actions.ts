'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

function go(message: string, type: 'success' | 'error' = 'success'): never {
  redirect(`/admin/faculty?${type}=${encodeURIComponent(message)}`)
}

function text(value: FormDataEntryValue | null, max: number) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
}

function capabilityValues(formData: FormData) {
  return {
    can_serve_panel: formData.get('canServePanel') === 'on',
    can_chair: formData.get('canChair') === 'on',
    can_advise: formData.get('canAdvise') === 'on',
    can_teach_research: formData.get('canTeachResearch') === 'on',
  }
}

function writeError(error: { code?: string } | null, fallback: string) {
  return error?.code === '23505' ? 'A faculty record with this name already exists.' : fallback
}

function refresh() {
  revalidatePath('/admin/faculty')
  revalidatePath('/admin/groups')
  revalidatePath('/submit')
}

export async function addFacultyDirectory(formData: FormData) {
  const fullName = text(formData.get('fullName'), 150)
  const email = text(formData.get('email'), 254)
  const department = text(formData.get('department'), 120)
  if (!fullName) go('Faculty name is required.', 'error')

  const supabase = await requireAdmin()
  const { error } = await supabase.from('faculty').insert({
    full_name: fullName,
    email: email || null,
    department: department || null,
    is_active: true,
    ...capabilityValues(formData),
  })

  if (error) go(writeError(error, 'Unable to add faculty. Please check the information and try again.'), 'error')
  refresh()
  go('Faculty member added.')
}

export async function updateFacultyDirectory(formData: FormData) {
  const id = text(formData.get('id'), 36)
  const fullName = text(formData.get('fullName'), 150)
  const email = text(formData.get('email'), 254)
  const department = text(formData.get('department'), 120)
  if (!id || !fullName) go('Faculty name is required.', 'error')

  const supabase = await requireAdmin()
  const { error } = await supabase.from('faculty').update({
    full_name: fullName,
    email: email || null,
    department: department || null,
    ...capabilityValues(formData),
  }).eq('id', id)

  if (error) go(writeError(error, 'Unable to update faculty.'), 'error')
  refresh()
  go('Faculty information and capabilities updated.')
}

async function hasScheduledAssignment(supabase: Awaited<ReturnType<typeof createClient>>, facultyId: string) {
  const [researchResult, panelResult] = await Promise.all([
    supabase.from('research_groups').select('id').eq('status', 'scheduled')
      .or(`instructor_id.eq.${facultyId},adviser_id.eq.${facultyId}`).limit(1),
    supabase.from('panel_assignments').select('defense_schedule_id').eq('faculty_id', facultyId),
  ])

  if ((researchResult.data?.length ?? 0) > 0) return true
  const scheduleIds = [...new Set((panelResult.data ?? []).map((row) => row.defense_schedule_id).filter(Boolean))]
  if (scheduleIds.length === 0) return false

  const { data } = await supabase.from('defense_schedules')
    .select('id, research_groups!inner(status)')
    .in('id', scheduleIds)
    .eq('research_groups.status', 'scheduled')
    .limit(1)
  return (data?.length ?? 0) > 0
}

export async function toggleFacultyDirectory(formData: FormData) {
  const id = text(formData.get('id'), 36)
  const nextActive = String(formData.get('nextActive') ?? '') === 'true'
  if (!id) go('Faculty record was not found.', 'error')

  const supabase = await requireAdmin()
  if (!nextActive && await hasScheduledAssignment(supabase, id)) {
    go('This faculty member is assigned to a scheduled defense. Reassign or complete that defense before deactivating the record.', 'error')
  }

  const { error } = await supabase.from('faculty').update({ is_active: nextActive }).eq('id', id)
  if (error) go('Unable to change faculty status.', 'error')
  refresh()
  go(nextActive ? 'Faculty member activated.' : 'Faculty member deactivated.')
}
