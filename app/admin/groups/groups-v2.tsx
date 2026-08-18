import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import styles from './groups-v2.module.css'

type Params = { q?: string; status?: string; program?: string; defense?: string; page?: string }
type Schedule = { defense_date: string; start_time: string; venue: string }
type Group = {
  id: string
  public_code: string
  title: string
  program: string | null
  major: string | null
  defense_type: string | null
  status: string
  adviser_id: string | null
  group_members: { full_name: string }[] | null
  defense_schedules: Schedule[] | Schedule | null
}

const PAGE_SIZE = 20
const STATUSES = new Set(['pending', 'scheduled', 'completed', 'cancelled'])
const PROGRAMS = new Set(['BEED', 'BSED', 'BSA', 'BSAIS', 'BSBA'])
const DEFENSES = new Set(['title', 'proposal', 'final'])

function one<T>(value: T | T[] | null | undefined) {
  return !value ? null : Array.isArray(value) ? value[0] ?? null : value
}

function defenseLabel(value: string | null) {
  return value === 'title' ? 'Title Defense' : value === 'proposal' ? 'Proposal Defense' : value === 'final' ? 'Final Defense' : 'Not recorded'
}

function statusLabel(value: string) {
  return value === 'cancelled' ? 'legacy cancelled' : value
}

function programLabel(group: Group) {
  return group.program ? `${group.program}${group.major ? ` - ${group.major}` : ''}` : 'Program not recorded'
}

function dateLabel(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}

function timeLabel(value: string) {
  const [hourText, minute = '00'] = value.split(':')
  let hour = Number(hourText)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (!hour) hour = 12
  return `${hour}:${minute} ${suffix}`
}

function href(params: Params, page: number) {
  const query = new URLSearchParams()
  for (const key of ['q', 'status', 'program', 'defense'] as const) {
    if (params[key]) query.set(key, String(params[key]))
  }
  if (page > 1) query.set('page', String(page))
  const value = query.toString()
  return value ? `/admin/groups?${value}` : '/admin/groups'
}

export default async function ResearchGroupsV2({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const search = String(params.q ?? '').trim().slice(0, 150)
  const status = STATUSES.has(String(params.status)) ? String(params.status) : null
  const programValue = String(params.program ?? '').toUpperCase()
  const program = PROGRAMS.has(programValue) ? programValue : null
  const defense = DEFENSES.has(String(params.defense)) ? String(params.defense) : null
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect('/admin')

  const { data: admin } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (!admin) redirect('/admin')

  let ids: string[] | null = null
  if (search) {
    const pattern = `%${search}%`
    const [titles, codes, contacts, members] = await Promise.all([
      supabase.from('research_groups').select('id').ilike('title', pattern).limit(500),
      supabase.from('research_groups').select('id').ilike('public_code', pattern).limit(500),
      supabase.from('research_groups').select('id').ilike('contact_person', pattern).limit(500),
      supabase.from('group_members').select('research_group_id').ilike('full_name', pattern).limit(500),
    ])
    ids = [...new Set([
      ...(titles.data ?? []).map((row) => row.id),
      ...(codes.data ?? []).map((row) => row.id),
      ...(contacts.data ?? []).map((row) => row.id),
      ...(members.data ?? []).map((row) => row.research_group_id),
    ])]
  }

  let query = supabase
    .from('research_groups')
    .select('id,public_code,title,program,major,defense_type,status,adviser_id,group_members(full_name),defense_schedules(defense_date,start_time,venue)', { count: 'exact' })
    .order('submitted_at', { ascending: false })

  if (ids) query = ids.length ? query.in('id', ids) : query.in('id', ['00000000-0000-0000-0000-000000000000'])
  if (status) query = query.eq('status', status)
  if (program) query = query.eq('program', program)
  if (defense) query = query.eq('defense_type', defense)

  const from = (page - 1) * PAGE_SIZE
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1)
  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (page > pages && total) redirect(href(params, pages))

  const groups = (data ?? []) as Group[]
  const adviserIds = [...new Set(groups.map((group) => group.adviser_id).filter((value): value is string => Boolean(value)))]
  const adviserNames = new Map<string, string>()

  if (adviserIds.length) {
    const { data: advisers } = await supabase.from('faculty').select('id,full_name').in('id', adviserIds)
    for (const adviser of advisers ?? []) adviserNames.set(adviser.id, adviser.full_name)
  }

  const filters = [status, program, defense].filter(Boolean).length

  return (
    <section className={`section ${styles.page}`}>
      <div className="container">
        <div className={styles.heading}>
          <div>
            <p className="eyebrow">Research Groups</p>
            <h2>Research submissions</h2>
            <p>Open a submission to review its information and manage its defense.</p>
          </div>
          <Link className="button button-secondary button-small" href="/admin/dashboard">← Dashboard</Link>
        </div>

        <form className={`card ${styles.toolbar}`} method="get">
          <div className={styles.searchRow}>
            <div className="field">
              <label htmlFor="q">Search</label>
              <input defaultValue={search} id="q" name="q" placeholder="Research title, code, member, or contact person" type="search" />
            </div>
            <button className="button" type="submit">Search</button>
          </div>
          <details className={styles.filters} open={filters > 0}>
            <summary>Filters{filters ? ` (${filters})` : ''}</summary>
            <div className={styles.filterGrid}>
              <div className="field">
                <label htmlFor="status">Status</label>
                <select defaultValue={status ?? ''} id="status" name="status">
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Legacy Cancelled</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="program">Program</label>
                <select defaultValue={program ?? ''} id="program" name="program">
                  <option value="">All programs</option>
                  {['BEED', 'BSED', 'BSA', 'BSAIS', 'BSBA'].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="defense">Defense type</label>
                <select defaultValue={defense ?? ''} id="defense" name="defense">
                  <option value="">All defense types</option>
                  <option value="title">Title Defense</option>
                  <option value="proposal">Proposal Defense</option>
                  <option value="final">Final Defense</option>
                </select>
              </div>
              <button className="button button-secondary" type="submit">Apply Filters</button>
            </div>
          </details>
          {(search || filters) ? <Link className="button button-secondary button-small" href="/admin/groups">Clear search and filters</Link> : null}
        </form>

        <div className={styles.results}>
          <span><strong>{total}</strong> {total === 1 ? 'research group' : 'research groups'}</span>
          <span>Page {page} of {pages}</span>
        </div>

        {error ? (
          <div className={`card ${styles.empty}`}><h3>Research groups could not be loaded.</h3><p>Please try again.</p></div>
        ) : !groups.length ? (
          <div className={`card ${styles.empty}`}><h3>No matching research groups.</h3><p>Adjust the search or filters to see other submissions.</p></div>
        ) : (
          <>
            <div className="admin-desktop-only admin-table-shell">
              <table className="admin-data-table admin-groups-table">
                <thead>
                  <tr>
                    <th scope="col">Research</th>
                    <th scope="col">Program</th>
                    <th scope="col">Defense</th>
                    <th scope="col">Status</th>
                    <th scope="col">Adviser</th>
                    <th scope="col">Schedule</th>
                    <th scope="col"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const schedule = one(group.defense_schedules)
                    const members = group.group_members?.length ?? 0
                    const adviser = group.adviser_id ? adviserNames.get(group.adviser_id) ?? 'Not found' : 'Not assigned'
                    return (
                      <tr key={group.id}>
                        <td>
                          <div className="admin-table-research">
                            <span className="code">{group.public_code}</span>
                            <strong>{group.title}</strong>
                            <small>{members} {members === 1 ? 'member' : 'members'}</small>
                          </div>
                        </td>
                        <td>{programLabel(group)}</td>
                        <td>{defenseLabel(group.defense_type)}</td>
                        <td><span className={`status-pill status-${group.status}`}>{statusLabel(group.status)}</span></td>
                        <td>{adviser}</td>
                        <td>
                          {schedule ? (
                            <>
                              <span className="admin-table-nowrap">{dateLabel(schedule.defense_date)} · {timeLabel(schedule.start_time)}</span>
                              <small className="admin-table-muted">{schedule.venue}</small>
                            </>
                          ) : <span className="admin-table-muted">Not scheduled</span>}
                        </td>
                        <td className="admin-table-action"><Link className="button button-small" href={`/admin/groups/${group.id}`}>Open</Link></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className={`admin-mobile-only ${styles.list}`}>
              {groups.map((group) => {
                const schedule = one(group.defense_schedules)
                const members = group.group_members?.length ?? 0
                return (
                  <article className={`card ${styles.row}`} key={group.id}>
                    <div className={styles.main}>
                      <div className={styles.labels}>
                        <span className="code">{group.public_code}</span>
                        <span className={`status-pill status-${group.status}`}>{statusLabel(group.status)}</span>
                      </div>
                      <h3>{group.title}</h3>
                      <div className={styles.meta}>
                        <span>{programLabel(group)}</span>
                        <span>{defenseLabel(group.defense_type)}</span>
                        <span>{members} {members === 1 ? 'member' : 'members'}</span>
                      </div>
                      <div className={styles.schedule}>
                        {schedule ? `Defense: ${dateLabel(schedule.defense_date)} · ${timeLabel(schedule.start_time)} · ${schedule.venue}` : 'Not scheduled'}
                      </div>
                    </div>
                    <div className={styles.actions}><Link className="button" href={`/admin/groups/${group.id}`}>Open</Link></div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {pages > 1 ? (
          <nav className={styles.pagination} aria-label="Research groups pagination">
            {page > 1 ? <Link className="button button-secondary button-small" href={href(params, page - 1)}>← Previous</Link> : <span />}
            <span>Page <strong>{page}</strong> of <strong>{pages}</strong></span>
            {page < pages ? <Link className="button button-secondary button-small" href={href(params, page + 1)}>Next →</Link> : <span />}
          </nav>
        ) : null}
      </div>
    </section>
  )
}
