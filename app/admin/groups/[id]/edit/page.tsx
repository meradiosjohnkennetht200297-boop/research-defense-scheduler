import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditResearchForm from './edit-form'

type FacultyRow = { id: string; full_name: string; is_active: boolean; can_advise: boolean; can_teach_research: boolean }
type MemberRow = { full_name: string; sort_order: number }

export default async function EditResearchSubmission({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/admin')

  const { data: adminProfile } = await supabase.from('admin_profiles').select('user_id').eq('user_id', userId).eq('is_active', true).maybeSingle()
  if (!adminProfile) redirect('/admin')

  const [groupResult, membersResult, facultyResult] = await Promise.all([
    supabase.from('research_groups').select('id, public_code, title, program, major, defense_type, contact_person, contact_email, contact_number, research_file_url, instructor_id, adviser_id, status').eq('id', id).maybeSingle(),
    supabase.from('group_members').select('full_name, sort_order').eq('research_group_id', id).order('sort_order', { ascending: true }),
    supabase.from('faculty').select('id, full_name, is_active, can_advise, can_teach_research').order('full_name', { ascending: true }),
  ])

  const group = groupResult.data
  if (!group) notFound()
  if (group.status === 'completed') {
    redirect(`/admin/groups/${group.id}?error=${encodeURIComponent('Completed research records are protected and cannot be edited.')}`)
  }
  if (group.status === 'cancelled') {
    redirect(`/admin/groups/${group.id}?error=${encodeURIComponent('Legacy Cancelled records are protected and cannot be edited.')}`)
  }

  const memberNames = ((membersResult.data ?? []) as MemberRow[]).sort((a, b) => a.sort_order - b.sort_order).map((member) => member.full_name)
  const faculty = (facultyResult.data ?? []) as FacultyRow[]

  return (
    <section className="section workspace-page">
      <div className="container workspace-layout">
        <div className="workspace-topbar workspace-refined-topbar">
          <div className="workspace-breadcrumbs"><Link href="/admin/groups">Research Groups</Link><span aria-hidden="true">/</span><Link href={`/admin/groups/${group.id}`}>{group.public_code}</Link><span aria-hidden="true">/</span><span>Edit</span></div>
          <Link className="button button-secondary button-small" href={`/admin/groups/${group.id}`}>← Back to Research Group</Link>
        </div>

        {query.saved ? <div className="alert alert-success">Submission information saved successfully.</div> : null}
        {query.error ? <div className="alert alert-error">{query.error}</div> : null}

        <div className="card workspace-research-header">
          <div className="workspace-research-heading">
            <div className="workspace-research-labels"><span className="code">{group.public_code}</span><span className={`status-pill status-${group.status}`}>{group.status}</span></div>
            <h1>Edit submission information</h1>
            <p>Correct student-submitted information without changing the defense workflow.</p>
          </div>
        </div>

        {group.status === 'scheduled' ? (
          <div className="alert alert-warning">This research is already scheduled. Changes here update submission information only. The defense schedule, panel assignment, and publication state are not changed.</div>
        ) : null}

        <EditResearchForm group={group} faculty={faculty} memberNames={memberNames} />
      </div>
    </section>
  )
}
