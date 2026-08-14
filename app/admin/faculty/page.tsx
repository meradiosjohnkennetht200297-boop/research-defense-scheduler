import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addFacultyDirectory } from './directory-actions'
import styles from './faculty.module.css'

type FacultyRow = {
  id: string
  full_name: string
  email: string | null
  department: string | null
  is_active: boolean
  can_serve_panel: boolean
  can_chair: boolean
  can_advise: boolean
  can_teach_research: boolean
}

type Capability = 'chair' | 'panel' | 'adviser' | 'instructor'
const STATUS_OPTIONS = new Set(['all', 'active', 'inactive'])
const CAPABILITY_OPTIONS = new Set<Capability>(['chair', 'panel', 'adviser', 'instructor'])

function hasCapability(person: FacultyRow, capability: Capability | null) {
  if (!capability) return true
  if (capability === 'chair') return person.can_chair
  if (capability === 'panel') return person.can_serve_panel
  if (capability === 'adviser') return person.can_advise
  return person.can_teach_research
}

function capabilityLabels(person: FacultyRow) {
  const labels: string[] = []
  if (person.can_serve_panel) labels.push('Panel')
  if (person.can_chair) labels.push('Chair')
  if (person.can_advise) labels.push('Adviser')
  if (person.can_teach_research) labels.push('Research Instructor')
  return labels
}

function AddFacultyForm() {
  return (
    <details className={`card ${styles.addPanel}`}>
      <summary>+ Add faculty</summary>
      <form action={addFacultyDirectory} className={styles.addForm}>
        <div className={styles.editGrid}>
          <div className={`field ${styles.full}`}>
            <label htmlFor="new-name">Full name</label>
            <input id="new-name" maxLength={150} name="fullName" required />
          </div>
          <div className="field">
            <label htmlFor="new-email">Email <span className="optional-mark">Optional</span></label>
            <input id="new-email" maxLength={254} name="email" type="email" />
          </div>
          <div className="field">
            <label htmlFor="new-department">Department / unit <span className="optional-mark">Optional</span></label>
            <input id="new-department" maxLength={120} name="department" />
          </div>
        </div>
        <div className={styles.capabilityBox}>
          <strong>Capabilities</strong>
          <label className={styles.check}><input defaultChecked name="canServePanel" type="checkbox" /> Can serve as Panel Member</label>
          <label className={styles.check}><input defaultChecked name="canChair" type="checkbox" /> Can serve as Chair</label>
          <label className={styles.check}><input defaultChecked name="canAdvise" type="checkbox" /> Can serve as Research Adviser</label>
          <label className={styles.check}><input defaultChecked name="canTeachResearch" type="checkbox" /> Can teach Research</label>
        </div>
        <button className="button" type="submit">Add Faculty</button>
      </form>
    </details>
  )
}

export default async function FacultyManagementPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; capability?: string; department?: string; success?: string; error?: string }>
}) {
  const params = await searchParams
  const q = String(params.q ?? '').trim().slice(0, 120)
  const status = STATUS_OPTIONS.has(String(params.status ?? 'all')) ? String(params.status ?? 'all') : 'all'
  const capability = CAPABILITY_OPTIONS.has(params.capability as Capability) ? params.capability as Capability : null
  const requestedDepartment = String(params.department ?? '').trim().slice(0, 120)

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

  const { data, error: facultyError } = await supabase
    .from('faculty')
    .select('id, full_name, email, department, is_active, can_serve_panel, can_chair, can_advise, can_teach_research')
    .order('full_name', { ascending: true })

  const faculty = (data ?? []) as FacultyRow[]
  const departments = [...new Set(faculty.map((person) => person.department).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b))
  const department = departments.includes(requestedDepartment) ? requestedDepartment : ''
  const qLower = q.toLowerCase()

  const filtered = faculty.filter((person) => {
    if (status === 'active' && !person.is_active) return false
    if (status === 'inactive' && person.is_active) return false
    if (!hasCapability(person, capability)) return false
    if (department && person.department !== department) return false
    if (qLower) {
      const haystack = `${person.full_name} ${person.email ?? ''} ${person.department ?? ''}`.toLowerCase()
      if (!haystack.includes(qLower)) return false
    }
    return true
  })

  const activeFilterCount = [status !== 'all' ? status : '', capability, department].filter(Boolean).length

  return (
    <section className={`section ${styles.page}`}>
      <div className="container">
        <div className={styles.heading}>
          <div>
            <p className="eyebrow">Faculty</p>
            <h2>Faculty directory</h2>
            <p>Find a faculty member, review their roles, or open the record to make changes.</p>
          </div>
        </div>

        {params.success ? <div className="alert alert-success">{params.success}</div> : null}
        {params.error ? <div className="alert alert-error">{params.error}</div> : null}
        {facultyError ? <div className="alert alert-error">The faculty directory could not be loaded completely.</div> : null}

        <form className={`card ${styles.toolbar}`} method="get">
          <div className={styles.searchRow}>
            <div className="field">
              <label htmlFor="faculty-search">Search</label>
              <input defaultValue={q} id="faculty-search" name="q" placeholder="Name, email, or department" type="search" />
            </div>
            <button className="button" type="submit">Search</button>
          </div>
          <details className={styles.filters} open={activeFilterCount > 0}>
            <summary>Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</summary>
            <div className={styles.filterGrid}>
              <div className="field">
                <label htmlFor="faculty-status">Status</label>
                <select defaultValue={status} id="faculty-status" name="status">
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="faculty-capability">Capability</label>
                <select defaultValue={capability ?? ''} id="faculty-capability" name="capability">
                  <option value="">All capabilities</option>
                  <option value="panel">Panel Member</option>
                  <option value="chair">Chair</option>
                  <option value="adviser">Research Adviser</option>
                  <option value="instructor">Research Instructor</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="faculty-department">Department</label>
                <select defaultValue={department} id="faculty-department" name="department">
                  <option value="">All departments</option>
                  {departments.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <button className="button button-secondary" type="submit">Apply Filters</button>
            </div>
          </details>
          {(q || activeFilterCount) ? <Link className="button button-secondary button-small" href="/admin/faculty">Clear search and filters</Link> : null}
        </form>

        <AddFacultyForm />

        <div className={styles.results}>
          <span><strong>{filtered.length}</strong> of {faculty.length} faculty shown</span>
        </div>

        {filtered.length === 0 ? (
          <div className={`card ${styles.empty}`}>
            <h3>No faculty match this view.</h3>
            <p>Try another search or clear the filters.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map((person) => {
              const roles = capabilityLabels(person)
              return (
                <article className={`card ${styles.facultyCard}${person.is_active ? '' : ` ${styles.inactive}`}`} key={person.id}>
                  <div className={styles.cardHead}>
                    <div className={styles.identity}>
                      <span className={person.is_active ? 'status-pill status-published' : 'status-pill'}>{person.is_active ? 'Active' : 'Inactive'}</span>
                      <h3>{person.full_name}</h3>
                      <p>{person.department || 'Department not set'}</p>
                    </div>
                    <Link className="button button-secondary button-small" href={`/admin/faculty/${person.id}`}>Edit</Link>
                  </div>
                  <div className={styles.badges} aria-label="Faculty capabilities">
                    {roles.length ? roles.map((role) => <span className={styles.badge} key={role}>{role}</span>) : <span className={styles.noRoles}>No defense roles enabled</span>}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
