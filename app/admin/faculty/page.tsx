import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addFacultyDirectory, updateFacultyDirectory } from './directory-actions'
import FacultyStatusForm from './faculty-status-form'
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
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function hasCapability(person: FacultyRow, capability: Capability | null) {
  if (!capability) return true
  if (capability === 'chair') return person.can_chair
  if (capability === 'panel') return person.can_serve_panel
  if (capability === 'adviser') return person.can_advise
  return person.can_teach_research
}

function CapabilityBadge({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <span className={`${styles.badge}${enabled ? '' : ` ${styles.badgeOff}`}`}>{children}</span>
}

function CapabilityChecks({ person }: { person?: FacultyRow }) {
  return (
    <div className={styles.capabilityBox}>
      <span>Faculty capabilities</span>
      <label className={styles.check}><input defaultChecked={person?.can_chair ?? true} name="canChair" type="checkbox" /> Can chair defenses</label>
      <label className={styles.check}><input defaultChecked={person?.can_serve_panel ?? true} name="canServePanel" type="checkbox" /> Can serve as panel member</label>
      <label className={styles.check}><input defaultChecked={person?.can_advise ?? true} name="canAdvise" type="checkbox" /> Can advise research</label>
      <label className={styles.check}><input defaultChecked={person?.can_teach_research ?? true} name="canTeachResearch" type="checkbox" /> Can teach / serve as research instructor</label>
    </div>
  )
}

export default async function FacultyManagementPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; capability?: string; department?: string; letter?: string; success?: string; error?: string }>
}) {
  const params = await searchParams
  const q = String(params.q ?? '').trim().slice(0, 120)
  const status = STATUS_OPTIONS.has(String(params.status ?? 'all')) ? String(params.status ?? 'all') : 'all'
  const capability = CAPABILITY_OPTIONS.has(params.capability as Capability) ? params.capability as Capability : null
  const requestedLetter = String(params.letter ?? '').toUpperCase()
  const letter = LETTERS.includes(requestedLetter) ? requestedLetter : ''
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
    if (letter && person.full_name.trim().charAt(0).toUpperCase() !== letter) return false
    if (qLower) {
      const haystack = `${person.full_name} ${person.email ?? ''} ${person.department ?? ''}`.toLowerCase()
      if (!haystack.includes(qLower)) return false
    }
    return true
  })

  const activeCount = faculty.filter((person) => person.is_active).length
  const chairCount = faculty.filter((person) => person.is_active && person.can_chair).length
  const panelCount = faculty.filter((person) => person.is_active && person.can_serve_panel).length

  return (
    <section className={`section ${styles.page}`}>
      <div className="container">
        <div className={styles.heading}>
          <div>
            <p className="eyebrow">Faculty Directory</p>
            <h2>Manage faculty and defense roles.</h2>
            <p>Search the directory, manage active status, and control which faculty can serve in each research-defense role.</p>
          </div>
          <Link className="button button-secondary button-small" href="/admin/dashboard">← Dashboard</Link>
        </div>

        {params.success ? <div className="alert alert-success">{params.success}</div> : null}
        {params.error ? <div className="alert alert-error">{params.error}</div> : null}
        {facultyError ? <div className="alert alert-error">The faculty directory could not be loaded completely.</div> : null}

        <div className={styles.summary}>
          <div className={`card ${styles.summaryCard}`}><span>Total faculty</span><strong>{faculty.length}</strong></div>
          <div className={`card ${styles.summaryCard}`}><span>Active</span><strong>{activeCount}</strong></div>
          <div className={`card ${styles.summaryCard}`}><span>Chair eligible</span><strong>{chairCount}</strong></div>
          <div className={`card ${styles.summaryCard}`}><span>Panel eligible</span><strong>{panelCount}</strong></div>
        </div>

        <form className={`card ${styles.filters}`} method="get">
          <div className="field">
            <label htmlFor="faculty-search">Search</label>
            <input defaultValue={q} id="faculty-search" name="q" placeholder="Name, email, or department" />
          </div>
          <div className="field">
            <label htmlFor="faculty-status">Status</label>
            <select defaultValue={status} id="faculty-status" name="status">
              <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="faculty-capability">Capability</label>
            <select defaultValue={capability ?? ''} id="faculty-capability" name="capability">
              <option value="">All capabilities</option><option value="chair">Can chair</option><option value="panel">Can serve as panel</option><option value="adviser">Can advise</option><option value="instructor">Can teach research</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="faculty-department">Department</label>
            <select defaultValue={department} id="faculty-department" name="department">
              <option value="">All departments</option>
              {departments.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="faculty-letter">Starts with</label>
            <select defaultValue={letter} id="faculty-letter" name="letter">
              <option value="">Any letter</option>{LETTERS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className={styles.filterActions}>
            <button className="button button-small" type="submit">Apply</button>
            <Link className={`button button-secondary button-small ${styles.clearLink}`} href="/admin/faculty">Clear</Link>
          </div>
        </form>

        <div className={styles.directoryLayout}>
          <aside className={`card ${styles.addCard}`}>
            <h3>Add faculty</h3>
            <p>New faculty are active immediately. Choose only the roles they are allowed to perform.</p>
            <form action={addFacultyDirectory} className={styles.form}>
              <div className="field"><label htmlFor="new-name">Full name</label><input id="new-name" maxLength={150} name="fullName" required /></div>
              <div className="field"><label htmlFor="new-email">Email <span className="optional-mark">Optional</span></label><input id="new-email" maxLength={254} name="email" type="email" /></div>
              <div className="field"><label htmlFor="new-department">Department / unit <span className="optional-mark">Optional</span></label><input id="new-department" maxLength={120} name="department" placeholder="e.g., College of Teacher Education" /></div>
              <CapabilityChecks />
              <button className="button" type="submit">Add Faculty</button>
            </form>
          </aside>

          <div>
            <div className={styles.resultsHead}>
              <p><strong>{filtered.length}</strong> of {faculty.length} faculty shown</p>
            </div>

            {filtered.length === 0 ? (
              <div className={`card ${styles.empty}`}><h3>No faculty match these filters.</h3><p>Try clearing a filter or searching another name.</p></div>
            ) : (
              <div className={styles.list}>
                {filtered.map((person) => (
                  <article className={`card ${styles.facultyCard}${person.is_active ? '' : ` ${styles.inactive}`}`} key={person.id}>
                    <div className={styles.cardHead}>
                      <div className={styles.identity}>
                        <span className={person.is_active ? 'status-pill status-published' : 'status-pill'}>{person.is_active ? 'Active' : 'Inactive'}</span>
                        <h3>{person.full_name}</h3>
                        <p>{person.department || 'Department not set'}</p>
                        {person.email ? <p>{person.email}</p> : null}
                      </div>
                      <FacultyStatusForm fullName={person.full_name} id={person.id} isActive={person.is_active} />
                    </div>

                    <div className={styles.badges} aria-label="Faculty capabilities">
                      <CapabilityBadge enabled={person.can_chair}>Chair</CapabilityBadge>
                      <CapabilityBadge enabled={person.can_serve_panel}>Panel</CapabilityBadge>
                      <CapabilityBadge enabled={person.can_advise}>Adviser</CapabilityBadge>
                      <CapabilityBadge enabled={person.can_teach_research}>Research Instructor</CapabilityBadge>
                    </div>

                    <details className={styles.details}>
                      <summary>Edit information and capabilities</summary>
                      <form action={updateFacultyDirectory} className={styles.editForm}>
                        <input name="id" type="hidden" value={person.id} />
                        <div className={styles.editGrid}>
                          <div className={`field ${styles.full}`}><label htmlFor={`name-${person.id}`}>Full name</label><input defaultValue={person.full_name} id={`name-${person.id}`} maxLength={150} name="fullName" required /></div>
                          <div className="field"><label htmlFor={`email-${person.id}`}>Email</label><input defaultValue={person.email ?? ''} id={`email-${person.id}`} maxLength={254} name="email" type="email" /></div>
                          <div className="field"><label htmlFor={`department-${person.id}`}>Department / unit</label><input defaultValue={person.department ?? ''} id={`department-${person.id}`} maxLength={120} name="department" /></div>
                        </div>
                        <CapabilityChecks person={person} />
                        <button className="button button-small" type="submit">Save Changes</button>
                      </form>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
