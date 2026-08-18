import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAccessKey, hashAccessKey } from '@/lib/research-access'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 })
  const { data: profile } = await supabase.from('admin_profiles').select('user_id').eq('user_id', userId).eq('is_active', true).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const accessKey = generateAccessKey()
  const admin = createAdminClient()
  const { data: group, error: lookupError } = await admin.from('research_groups').select('id, public_code').eq('id', id).maybeSingle()
  if (lookupError || !group) return NextResponse.json({ error: 'Research group not found.' }, { status: 404 })
  const { error } = await admin.from('research_groups').update({ access_key_hash: hashAccessKey(accessKey), access_key_created_at: new Date().toISOString() }).eq('id', id)
  if (error) {
    console.error('Access key reset failed:', error.message)
    return NextResponse.json({ error: 'Unable to generate an Access Key.' }, { status: 500 })
  }
  return NextResponse.json({ publicCode: group.public_code, accessKey })
}
