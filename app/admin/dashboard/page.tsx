import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logoutAdmin } from '../actions'

type ResearchGroupRow = {
  id: string
  public_code: string
  title: string
  contact_person: string
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
  submitted_at: string
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (!userId) redirect('/admin')

  const { data: adminProfile } = await supabase
    .from('admin_profiles')
    .select('display_name, role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!adminProfile) redirect('/admin')

  const [allCount, pendingCount, scheduledCount, recentGroups] = await Promise.all([
    supabase.from('research_groups').select('*', { count: 'exact', head: true }),
    supabase.from('research_groups').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('research_groups').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
    supabase
      .from('research_groups')
      .select('id, public_code, title, contact_person, status, submitted_at')
      .order('submitted_at', { ascending: false })
      .limit(20),
  ])

  const groups = (recentGroups.data ?? []) as ResearchGroupRow[]

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h2>Research defense management</h2>
            <p>Signed in as {adminProfile.display_name}</p>
          </div>
          <form action={logoutAdmin}>
            <button className="button button-secondary button-small" type="submit">Sign out</button>
          </form>
        </div>

        <div className="dashboard-grid">
          <div className="card stat-card">
            <span>Total submissions</span>
            <strong>{allCount.count ?? 0}</strong>
          </div>
          <div className="card stat-card">
            <span>Pending</span>
            <strong>{pendingCount.count ?? 0}</strong>
          </div>
          <div className="card stat-card">
            <span>Scheduled</span>
            <strong>{scheduledCount.count ?? 0}</strong>
          </div>
        </div>

        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Research title</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={5}>No research submissions yet.</td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr key={group.id}>
                    <td><span className="code">{group.public_code}</span></td>
                    <td>{group.title}</td>
                    <td>{group.contact_person}</td>
                    <td>{group.status}</td>
                    <td>{new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(group.submitted_at))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
