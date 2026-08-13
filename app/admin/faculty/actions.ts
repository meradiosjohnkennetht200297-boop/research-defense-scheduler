'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

function facultyRedirect(message: string, type: 'success' | 'error' = 'success'): never {
  redirect(`/admin/faculty?${type}=${encodeURIComponent(message)}`)
}

export async function addFaculty(formData: FormData) {
  const fullName = String(formData.get('fullName') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()

  if (!fullName) facultyRedirect('Faculty name is required.', 'error')
  if (fullName.length > 150) facultyRedirect('Faculty name is too long.', 'error')
  if (email.length > 254) facultyRedirect('Email address is too long.', 'error')

  const supabase = await requireAdmin()
  const { error } = await supabase.from('faculty').insert({
    full_name: fullName,
    email: email || null,
    is_active: true,
  })

  if (error) facultyRedirect('Unable to add faculty. Please check the information and try again.', 'error')

  revalidatePath('/admin/faculty')
  revalidatePath('/submit')
  facultyRedirect('Faculty member added.')
}

export async function updateFaculty(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const fullName = String(formData.get('fullName') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()

  if (!id || !fullName) facultyRedirect('Faculty name is required.', 'error')
  if (fullName.length > 150) facultyRedirect('Faculty name is too long.', 'error')
  if (email.length > 254) facultyRedirect('Email address is too long.', 'error')

  const supabase = await requireAdmin()
  const { error } = await supabase
    .from('faculty')
    .update({ full_name: fullName, email: email || null })
    .eq('id', id)

  if (error) facultyRedirect('Unable to update faculty.', 'error')

  revalidatePath('/admin/faculty')
  revalidatePath('/submit')
  facultyRedirect('Faculty information updated.')
}

export async function toggleFaculty(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const nextActive = String(formData.get('nextActive') ?? '') === 'true'

  if (!id) facultyRedirect('Faculty record was not found.', 'error')

  const supabase = await requireAdmin()
  const { error } = await supabase
    .from('faculty')
    .update({ is_active: nextActive })
    .eq('id', id)

  if (error) facultyRedirect('Unable to change faculty status.', 'error')

  revalidatePath('/admin/faculty')
  revalidatePath('/submit')
  facultyRedirect(nextActive ? 'Faculty member activated.' : 'Faculty member deactivated.')
}
