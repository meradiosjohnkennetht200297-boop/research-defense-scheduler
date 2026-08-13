import SubmissionForm from './submission-form-v2'
import SubmissionEnterGuard from './submission-enter-guard'
import { createClient } from '@/lib/supabase/server'

type Faculty = {
  id: string
  full_name: string
  can_advise: boolean
  can_teach_research: boolean
}

export default async function SubmitResearchPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('faculty')
    .select('id, full_name, can_advise, can_teach_research')
    .order('full_name', { ascending: true })

  return (
    <>
      <section className="page-head submission-page-head">
        <div className="container">
          <p className="eyebrow">Student Submission</p>
          <h1>Submit your research.</h1>
          <p className="lead">Enter the research and group details, review them, then submit for defense scheduling.</p>
        </div>
      </section>

      <section>
        <div className="container">
          <SubmissionEnterGuard>
            <SubmissionForm faculty={(data ?? []) as Faculty[]} />
          </SubmissionEnterGuard>
        </div>
      </section>
    </>
  )
}
