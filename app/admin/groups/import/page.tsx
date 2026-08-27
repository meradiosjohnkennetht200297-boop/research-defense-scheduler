import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ExistingResearchImportForm from './existing-research-import-form'
import styles from './import.module.css'

type Faculty = {
  id: string
  full_name: string
  is_active: boolean
  can_teach_research: boolean
  can_advise: boolean
  can_chair: boolean
  can_serve_panel: boolean
}

export default async function ImportExistingResearchPage() {
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

  const { data } = await supabase
    .from('faculty')
    .select('id, full_name, is_active, can_teach_research, can_advise, can_chair, can_serve_panel')
    .eq('is_active', true)
    .order('full_name')

  return (
    <section className={`section ${styles.page}`}>
      <div className={`container ${styles.container}`}>
        <div className={styles.topbar}>
          <div>
            <p className="eyebrow">Research Records</p>
            <h1>Add existing research</h1>
            <p>Add a research record that already reached Title, Proposal, or Final Defense before using the system.</p>
          </div>
          <Link className="button button-secondary button-small" href="/admin/groups">← Research Records</Link>
        </div>
        <ExistingResearchImportForm faculty={(data ?? []) as Faculty[]} />
      </div>
    </section>
  )
}
