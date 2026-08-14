import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import styles from './history.module.css'

type DefenseType = 'title' | 'proposal' | 'final'
type GroupRow = {
  id: string
  public_code: string
  title: string
  program: string | null
  major: string | null
  defense_type: DefenseType | null
  status: string
}
type AdminProfile = { display_name: string }
type FacultyName = { full_name: string }
type PanelAssignment = {
  panel_role: 'chair' | 'member'
  sort_order: number
  faculty: FacultyName | FacultyName[] | null
}
type HistoryRow = {
  id: string
  defense_date: string
  start_time: string
  end_time: string
  venue: string
  completed_at: string | null
  completion_note: string | null
  completed_by: string | null
  research_groups: GroupRow | GroupRow[] | null
  admin_profiles: AdminProfile | AdminProfile[] | null
  panel_assignments: PanelAssignment[] | null
}
type Params = { q?: string; program?: string; defense?: string; from?: string; to?: string }

const PROGRAMS = new Set(['BEED', 'BSED', 'BSA', 'BSAIS', 'BSBA'])
const DEFENSES = new Set(['title', 'proposal', 'final'])

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function defenseTypeLabel(value: DefenseType | null) {
  if (value === 'title') return 'Title Defense'
  if (value === 'proposal') return 'Proposal Defense'
  if (value === 'final') return 'Final Defense'
  return 'Research Defense'
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatTime(value: string) {
  const [hourText, minuteText] = value.split(':')
  let hour = Number(hourText)
  const minute = minuteText ?? '00'
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (hour === 0) hour = 12
  return `${hour}:${minute} ${suffix}`
}

function formatCompletedAt(value: string | null) {
  if (!value) return 'Confirmation time not recorded'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

function validDate(value: string | undefined) {
  const candidate = String(value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : ''
}

export default async function CompletedDefenseHistory({ searchParams }: {
  searchParams: Promise<Params>
}) {
  const params = await searchParams
  const search = String(params.q ?? '').trim().slice(0, 150)
  const programValue = String(params.program ?? '').toUpperCase()
  const program = PROGRAMS.has(programValue) ? programValue : ''
  const defenseValue = String(params.defense ?? '').toLowerCase()
  const defense = DEFENSES.has(defenseValue) ? defenseValue : ''
  const from = validDate(params.from)
  const to = validDate(params.to)
  const activeFilters = [program, defense, from, to].filter(Boolean).length

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/admin')

  const { data: profile } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (!profile) redirect('/admin')

  let historyQuery = supabase
    .from('defense_schedules')
    .select(`
      id, defense_date, start_time, end_time, venue,
      completed_at, completion_note, completed_by,
      research_groups!inner (
        id, public_code, title, program, major, defense_type, status
      ),
      admin_profiles!defense_schedules_completed_by_fkey (
        display_name
      ),
      panel_assignments (
        panel_role, sort_order,
        faculty ( full_name )
      )
    `)
    .eq('research_groups.status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('defense_date', { ascending: false })

  if (program) historyQuery = historyQuery.eq('research_groups.program', program)
  if (defense) historyQuery = historyQuery.eq('research_groups.defense_type', defense)
  if (from) historyQuery = historyQuery.gte('defense_date', from)
  if (to) historyQuery = historyQuery.lte('defense_date', to)

  const [historyResult, legacyResult] = await Promise.all([
    historyQuery,
    supabase.from('research_groups').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
  ])

  const legacyCount = legacyResult.count ?? 0
  const rows = ((historyResult.data ?? []) as HistoryRow[]).filter((row) => {
    if (!search) return true
    const group = one(row.research_groups)
    const panel = row.panel_assignments ?? []
    const panelText = panel.map((assignment) => one(assignment.faculty)?.full_name ?? '').join(' ')
    const haystack = `${group?.public_code ?? ''} ${group?.title ?? ''} ${group?.program ?? ''} ${group?.major ?? ''} ${row.venue} ${panelText}`.toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  return (
    <section className={`section ${styles.page}`}>
      <div className="container">
        <div className={styles.heading}>
          <div>
            <p className="eyebrow">Completed Defense History</p>
            <h2>Defense history</h2>
            <p>Review the final, protected record of defenses that were confirmed completed.</p>
          </div>
          <div className={styles.headingActions}>
            <Link className="button button-secondary button-small" href="/admin/schedule">Defense Schedule</Link>
            <Link className="button button-secondary button-small" href="/admin/dashboard">← Dashboard</Link>
          </div>
        </div>

        <div className={styles.historyNotice}>
          <div>
            <strong>Completed records are read-only.</strong>
            <span>Open a record when you need its full audit or research details.</span>
          </div>
          <Link className="button button-secondary button-small" href="/admin/groups?status=cancelled">
            Legacy Cancelled{legacyCount ? ` (${legacyCount})` : ''}
          </Link>
        </div>

        <form className={`card ${styles.search}`} method="get">
          <div className={styles.searchRow}>
            <div className="field">
              <label htmlFor="history-search">Search completed defenses</label>
              <input id="history-search" name="q" defaultValue={search} placeholder="Title, code, program, venue, or panelist" type="search" />
            </div>
            <button className="button button-small" type="submit">Search</button>
          </div>

          <details className={styles.filters} open={activeFilters > 0}>
            <summary>Filters{activeFilters ? ` (${activeFilters})` : ''}</summary>
            <div className={styles.filterGrid}>
              <div className="field">
                <label htmlFor="history-program">Program</label>
                <select defaultValue={program} id="history-program" name="program">
                  <option value="">All programs</option>
                  {['BEED', 'BSED', 'BSA', 'BSAIS', 'BSBA'].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="history-defense">Defense type</label>
                <select defaultValue={defense} id="history-defense" name="defense">
                  <option value="">All defense types</option>
                  <option value="title">Title Defense</option>
                  <option value="proposal">Proposal Defense</option>
                  <option value="final">Final Defense</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="history-from">Defense date from</label>
                <input defaultValue={from} id="history-from" name="from" type="date" />
              </div>
              <div className="field">
                <label htmlFor="history-to">Defense date to</label>
                <input defaultValue={to} id="history-to" name="to" type="date" />
              </div>
              <button className="button button-secondary" type="submit">Apply Filters</button>
            </div>
          </details>

          {(search || activeFilters) ? <Link className="button button-secondary button-small" href="/admin/history">Clear search and filters</Link> : null}
        </form>

        <div className={styles.results}>
          <span><strong>{rows.length}</strong> {rows.length === 1 ? 'completed defense' : 'completed defenses'}</span>
          <span>Confirmed records only</span>
        </div>

        {historyResult.error ? (
          <div className="card empty-state"><h3>History is temporarily unavailable.</h3><p>Please try again later.</p></div>
        ) : rows.length === 0 ? (
          <div className="card empty-state">
            <h3>{search || activeFilters ? 'No completed defenses match your search or filters.' : 'No completed defenses yet.'}</h3>
            <p>{search || activeFilters ? 'Adjust the search or filters to see other completed records.' : 'Confirmed defenses will appear here automatically.'}</p>
          </div>
        ) : (
          <div className={styles.list}>
            {rows.map((row) => {
              const group = one(row.research_groups)
              if (!group) return null
              const completedBy = one(row.admin_profiles)?.display_name ?? 'Administrator'
              const programLabel = group.program ? `${group.program}${group.major ? ` - ${group.major}` : ''}` : 'Program not recorded'
              const panel = [...(row.panel_assignments ?? [])].sort((a, b) => a.sort_order - b.sort_order)
              const chairName = one(panel.find((assignment) => assignment.panel_role === 'chair')?.faculty)?.full_name ?? 'Not recorded'
              const memberNames = panel
                .filter((assignment) => assignment.panel_role === 'member')
                .map((assignment) => one(assignment.faculty)?.full_name)
                .filter(Boolean) as string[]

              return (
                <article className={`card ${styles.card}`} key={row.id}>
                  <div className={styles.main}>
                    <div className="schedule-labels">
                      <span className="code">{group.public_code}</span>
                      <span className="defense-type-pill">{defenseTypeLabel(group.defense_type)}</span>
                      <span className="status-pill status-completed">completed</span>
                    </div>
                    <h3>{group.title}</h3>
                    <p>{programLabel}</p>
                  </div>

                  <dl className={styles.details}>
                    <div><dt>Defense schedule</dt><dd>{formatDate(row.defense_date)} · {formatTime(row.start_time)}–{formatTime(row.end_time)}</dd></div>
                    <div><dt>Venue</dt><dd>{row.venue}</dd></div>
                    <div><dt>Panel chair</dt><dd>{chairName}</dd></div>
                  </dl>

                  <details className={styles.auditDetails}>
                    <summary>
                      <span>Completion &amp; panel details</span>
                      <small>{memberNames.length} {memberNames.length === 1 ? 'panel member' : 'panel members'} · audit available</small>
                    </summary>
                    <div className={styles.auditBody}>
                      <dl className={styles.auditGrid}>
                        <div><dt>Panel members</dt><dd>{memberNames.length ? memberNames.join(', ') : 'No panel members recorded'}</dd></div>
                        <div><dt>Confirmed completed</dt><dd>{formatCompletedAt(row.completed_at)}</dd></div>
                        <div><dt>Confirmed by</dt><dd>{row.completed_at ? completedBy : 'Not recorded for legacy completion'}</dd></div>
                      </dl>
                      <div className={styles.note}>
                        <span>Completion note</span>
                        <p>{row.completion_note || 'No completion note was added.'}</p>
                      </div>
                    </div>
                  </details>

                  <div className={styles.cardFooter}>
                    <span className={styles.protected}>Protected record</span>
                    <Link className="button button-secondary button-small" href={`/admin/groups/${group.id}`}>View Record</Link>
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
