'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function loginAdmin(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/admin?error=Enter%20your%20email%20and%20password.')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/admin?error=Invalid%20email%20or%20password.')
  }

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (!userId) {
    await supabase.auth.signOut()
    redirect('/admin?error=Unable%20to%20verify%20this%20account.')
  }

  const { data: adminProfile } = await supabase
    .from('admin_profiles')
    .select('user_id, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!adminProfile) {
    await supabase.auth.signOut()
    redirect('/admin?error=This%20account%20is%20not%20an%20authorized%20administrator.')
  }

  redirect('/admin/dashboard')
}

export async function logoutAdmin() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin')
}
