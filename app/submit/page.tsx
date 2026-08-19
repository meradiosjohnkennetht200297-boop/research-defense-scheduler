import SubmissionPortal from './submission-portal'
import { createClient } from '@/lib/supabase/server'

type Faculty = { id: string; full_name: string; can_advise: boolean; can_teach_research: boolean }

export default async function SubmitResearchPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('faculty').select('id, full_name, can_advise, can_teach_research').order('full_name', { ascending: true })
  return <>
    <section className="page-head submission-page-head"><div className="container"><p className="eyebrow">Research Defense</p><h1>Submit or continue your research.</h1><p className="lead">One Research ID follows your group from Title Defense through Proposal and Final Defense.</p></div></section>
    <section className="section lifecycle-submit-section"><div className="container"><SubmissionPortal faculty={(data ?? []) as Faculty[]} /></div></section>
  </>
}
