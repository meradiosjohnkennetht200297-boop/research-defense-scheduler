import { createClient } from '@/lib/supabase/server'
import AdminNavigation from './admin-navigation'
import './admin.css'
import './admin-refinement.css'
import './groups-page.css'
import './progressive-disclosure.css'
import './adaptive-admin.css'
import './dashboard-calendar.css'
import './lifecycle-admin.css'
import './workspace-focus.css'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  let displayName: string | null = null
  if (userId) {
    const { data: adminProfile } = await supabase.from('admin_profiles').select('display_name').eq('user_id', userId).eq('is_active', true).maybeSingle()
    displayName = adminProfile?.display_name ?? null
  }
  return <>{displayName ? <AdminNavigation displayName={displayName} /> : null}<div className={displayName ? 'admin-content-shell' : undefined}>{children}</div></>
}
