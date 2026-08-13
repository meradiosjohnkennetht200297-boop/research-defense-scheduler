import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addFaculty, toggleFaculty, updateFaculty } from './actions'

type FacultyRow = {
  id: string
  full_name: string
  email: string | null
  is_active: boolean
}

export default async function FacultyManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (!userId) redirect('/admin')

  const { data: adminProfile } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!adminProfile) redirect('/admin')

  const { data } = await supabase
    .from('faculty')
    .select('id, full_name, email, is_active')
    .order('is_active', { ascending: false })
    .order('full_name', { ascending: true })

  const faculty = (data ?? []) as FacultyRow[]
  const activeCount = faculty.filter((person) => person.is_active).length

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading admin-heading">
          <div>
            <p className="eyebrow">Admin · Faculty</p>
            <h2>Faculty directory</h2>
            <p>{activeCount} active of {faculty.length} faculty records</p>
          </div>
          <Link className="button button-secondary button-small" href="/admin/dashboard">
            Back to Dashboard
          </Link>
        </div>

        {params.success ? <div className="alert alert-success">{params.success}</div> : null}
        {params.error ? <div className="alert alert-error">{params.error}</div> : null}

        <div className="admin-two-column">
          <div className="card faculty-add-card">
            <p className="eyebrow">Add Faculty</p>
            <h3>New directory entry</h3>
            <p className="muted-copy">
              Active faculty automatically become available as instructor and adviser choices on the student form.
            </p>

            <form action={addFaculty} className="faculty-form">
              <div className="field">
                <label htmlFor="fullName">Full name</label>
                <input id="fullName" name="fullName" maxLength={150} required />
              </div>
              <div className="field">
                <label htmlFor="email">Email address <span className="optional">optional</span></label>
                <input id="email" name="email" type="email" maxLength={254} />
              </div>
              <button className="button" type="submit">Add Faculty</button>
            </form>
          </div>

          <div className="faculty-list">
            {faculty.length === 0 ? (
              <div className="card empty-state compact-empty">
                <h3>No faculty records yet.</h3>
                <p>Add your first faculty member using the form.</p>
              </div>
            ) : (
              faculty.map((person) => (
                <div className="card faculty-card" key={person.id}>
                  <div className="faculty-card-head">
                    <div>
                      <span className={`status-pill ${person.is_active ? 'status-active' : 'status-inactive'}`}>
                        {person.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <form action={toggleFaculty}>
                      <input name="id" type="hidden" value={person.id} />
                      <input name="nextActive" type="hidden" value={String(!person.is_active)} />
                      <button className="button button-secondary button-small" type="submit">
                        {person.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </form>
                  </div>

                  <form action={updateFaculty} className="faculty-edit-form">
                    <input name="id" type="hidden" value={person.id} />
                    <div className="field">
                      <label htmlFor={`name-${person.id}`}>Full name</label>
                      <input
                        defaultValue={person.full_name}
                        id={`name-${person.id}`}
                        maxLength={150}
                        name="fullName"
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`email-${person.id}`}>Email address <span className="optional">optional</span></label>
                      <input
                        defaultValue={person.email ?? ''}
                        id={`email-${person.id}`}
                        maxLength={254}
                        name="email"
                        type="email"
                      />
                    </div>
                    <button className="button button-secondary button-small" type="submit">Save Changes</button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
