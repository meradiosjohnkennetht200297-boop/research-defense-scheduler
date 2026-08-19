import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPanelAccessToken } from '@/lib/panel-portal'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    const userId = claimsData?.claims?.sub
    if (!userId) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('admin_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()
    if (!profile) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const token = createPanelAccessToken()
    const admin = createAdminClient()
    const { error } = await admin
      .from('panel_portal_access')
      .update({ access_token: token, rotated_at: new Date().toISOString(), rotated_by: userId })
      .eq('id', 1)

    if (error) {
      console.error('Panel access reset failed:', error.message)
      return NextResponse.json({ error: 'The Panel Access link could not be reset.' }, { status: 500 })
    }

    const response = NextResponse.json({ token })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.error('Panel access reset route error:', error)
    return NextResponse.json({ error: 'Panel Access is temporarily unavailable.' }, { status: 503 })
  }
}
