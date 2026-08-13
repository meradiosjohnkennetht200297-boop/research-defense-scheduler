import SubmissionForm from './submission-form-v2'
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
      <section className="page-head">
        <div className="container">
          <p className="eyebrow">Student Submission</p>
          <h1>Submit your research group.</h1>
          <p className="lead">
            Complete the form below. Your contact details remain private and scheduling information
            will be assigned by the administrator.
          </p>
        </div>
      </section>

      <section>
        <div className="container">
          <SubmissionForm faculty={(data ?? []) as Faculty[]} />
        </div>
      </section>
    </>
  )
}
