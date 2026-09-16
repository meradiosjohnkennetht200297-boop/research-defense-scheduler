import SubmissionPortal from './submission-portal'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Submit Research' }

type Faculty = { id: string; full_name: string; can_advise: boolean; can_teach_research: boolean }

export default async function SubmitResearchPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('faculty').select('id, full_name, can_advise, can_teach_research').order('full_name', { ascending: true })
  return <section className="section lifecycle-submit-section"><div className="container"><header className="public-page-heading"><p className="eyebrow">Research services</p><h1>Submit your research</h1><p>Start a Title Defense request or continue to your next defense stage.</p></header>{error ? <div className="alert alert-warning" role="alert">Faculty names could not be loaded. Refresh this page to select your instructor or adviser, or leave these optional fields blank.</div> : null}<SubmissionPortal faculty={(data ?? []) as Faculty[]} /></div></section>
}
