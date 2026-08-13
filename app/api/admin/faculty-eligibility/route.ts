import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (!userId) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const { data, error } = await supabase
    .from('faculty')
    .select('id, is_active, can_chair, can_serve_panel')

  if (error) return NextResponse.json({ error: 'Unable to load faculty eligibility.' }, { status: 500 })

  const active = data ?? []
  return NextResponse.json({
    chairIds: active.filter((person) => person.is_active && person.can_chair).map((person) => person.id),
    panelIds: active.filter((person) => person.is_active && person.can_serve_panel).map((person) => person.id),
  })
}
