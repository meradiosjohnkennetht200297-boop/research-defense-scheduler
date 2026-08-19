import SubmissionPortal from './submission-portal'
import { createClient } from '@/lib/supabase/server'

type Faculty = { id: string; full_name: string; can_advise: boolean; can_teach_research: boolean }

export default async function SubmitResearchPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('faculty').select('id, full_name, can_advise, can_teach_research').order('full_name', { ascending: true })
  return <section className="section lifecycle-submit-section"><div className="container"><SubmissionPortal faculty={(data ?? []) as Faculty[]} /></div></section>
}
