import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PanelAccessControl from './panel-access-control'
import styles from './panel-access.module.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminPanelAccessPage() {
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

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('panel_portal_access')
    .select('access_token, created_at, rotated_at')
    .eq('id', 1)
    .maybeSingle()

  return <section className={`section ${styles.page}`}><div className={`container ${styles.container}`}>
    <header className={styles.heading}>
      <p className="eyebrow">Panel Access</p>
      <h1>Shared manuscript portal</h1>
      <p>One private, read-only link for all panel members. The page contains scheduled and completed defenses with direct manuscript access.</p>
    </header>

    {error || !data?.access_token ? <div className="alert alert-error">The shared Panel Access link is temporarily unavailable.</div> : <PanelAccessControl initialToken={data.access_token}/>} 

    <div className={styles.infoGrid}>
      <article className={styles.infoCard}><strong>What panel members see</strong><p>Research title, defense stage, program, schedule, venue, manuscript link, group members, adviser, instructor, and panel composition.</p></article>
      <article className={styles.infoCard}><strong>What stays private</strong><p>Research Codes, student contact details, administrative notes, scheduling controls, and other admin-only information are not shown.</p></article>
      <article className={styles.infoCard}><strong>Access model</strong><p>No account and no password. The private link creates a secure panel session and redirects to a clean /panel page.</p></article>
    </div>
  </div></section>
}
