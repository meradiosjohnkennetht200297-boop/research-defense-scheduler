import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type DefenseType = 'title' | 'proposal' | 'final'
type ResearchStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled'
type SortOption = 'newest' | 'oldest' | 'title' | 'defense_date'

type MemberRow = {
  full_name: string
  sort_order: number
}

type ScheduleRow = {
  defense_date: string
  start_time: string
  end_time: string
  venue: string
  is_published: boolean
}

type ResearchGroupRow = {
  id: string
  public_code: string
  title: string
  program: string | null
  major: string | null
  defense_type: DefenseType | null
  contact_person: string
  status: ResearchStatus
  submitted_at: string
  group_members: MemberRow[] | null
  defense_schedules: ScheduleRow[] | ScheduleRow | null
}

type SearchParams = {
  q?: string
  status?: string
  program?: string
  major?: string
  defense?: string
  sort?: string
  page?: string
}

const PAGE_SIZE = 15
const STATUSES = new Set<ResearchStatus>(['pending', 'scheduled', 'completed', 'cancelled'])
const PROGRAMS = new Set(['BEED', 'BSED', 'BSA', 'BSAIS', 'BSBA'])
const DEFENSE_TYPES = new Set<DefenseType>(['title', 'proposal', 'final'])
const SORT_OPTIONS = new Set<SortOption>(['newest', 'oldest', 'title', 'defense_date'])
const MAJORS = new Set(['English', 'Filipino', 'Mathematics', 'Science', 'MM', 'FM', 'HRM'])

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function defenseTypeLabel(value: DefenseType | null) {
  if (value === 'title') return 'Title Defense'
  if (value === 'proposal') return 'Proposal Defense'
  if (value === 'final') return 'Final Defense'
  return 'Not recorded'
}

function programLabel(program: string | null, major: string | null) {
  if (!program) return 'Not recorded'
  return `${program}${major ? ` - ${major}` : ''}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value))
}

function formatScheduleDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
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

function buildGroupsHref(params: SearchParams, page: number) {
  const query = new URLSearchParams()
  const values = {
    q: params.q,
    status: params.status,
    program: params.program,
    major: params.major,
    defense: params.defense,
    sort: params.sort,
  }

  for (const [key, value] of Object.entries(values)) {
    if (value) query.set(key, value)
  }

  if (page > 1) query.set('page', String(page))
  const suffix = query.toString()
  return suffix ? `/admin/groups?${suffix}` : '/admin/groups'
}

export default async function ResearchGroupsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const search = String(params.q ?? '').trim().slice(0, 150)
  const status = STATUSES.has(params.status as ResearchStatus)
    ? (params.status as ResearchStatus)
    : null
  const program = PROGRAMS.has(String(params.program ?? '').toUpperCase())
    ? String(params.program).toUpperCase()
    : null
  const major = MAJORS.has(String(params.major ?? '')) ? String(params.major) : null
  const defenseType = DEFENSE_TYPES.has(params.defense as DefenseType)
    ? (params.defense as DefenseType)
    : null
  const sort = SORT_OPTIONS.has(params.sort as SortOption)
    ? (params.sort as SortOption)
    : 'newest'
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)

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

  let searchIds: string[] | null = null

  if (search) {
    const pattern = `%${search}%`
    const [titleMatches, codeMatches, contactMatches, memberMatches] = await Promise.all([
      supabase.from('research_groups').select('id').ilike('title', pattern).limit(500),
      supabase.from('research_groups').select('id').ilike('public_code', pattern).limit(500),
      supabase.from('research_groups').select('id').ilike('contact_person', pattern).limit(500),
      supabase.from('group_members').select('research_group_id').ilike('full_name', pattern).limit(500),
    ])

    searchIds = [
      ...new Set([
        ...(titleMatches.data ?? []).map((row) => row.id),
        ...(codeMatches.data ?? []).map((row) => row.id),
        ...(contactMatches.data ?? []).map((row) => row.id),
        ...(memberMatches.data ?? []).map((row) => row.research_group_id),
      ]),
    ]
  }

  if (searchIds && searchIds.length === 0) {
    return (
      <section className="section research-groups-page">
        <div className="container">
          <div className="groups-page-heading">
            <div>
              <p className="eyebrow">Research Groups</p>
              <h2>Manage research submissions</h2>
              <p>Search, filter, and open submitted research groups from one workspace.</p>
            </div>
            <Link className="button button-secondary button-small" href="/admin/dashboard">← Dashboard</Link>
          </div>
          <GroupsFilterForm params={params} />
          <div className="card groups-empty-state">
            <h3>No matching research groups</h3>
            <p>Try a different search term or clear the filters.</p>
            <Link className="button button-secondary button-small" href="/admin/groups">Clear all filters</Link>
          </div>
        </div>
      </section>
    )
  }

  let groupsQuery = supabase
    .from('research_groups')
    .select(
      `
        id,
        public_code,
        title,
        program,
        major,
        defense_type,
        contact_person,
        status,
        submitted_at,
        group_members (
          full_name,
          sort_order
        ),
        defense_schedules (
          defense_date,
          start_time,
          end_time,
          venue,
          is_published
        )
      `,
      { count: 'exact' }
    )

  if (searchIds) groupsQuery = groupsQuery.in('id', searchIds)
  if (status) groupsQuery = groupsQuery.eq('status', status)
  if (program) groupsQuery = groupsQuery.eq('program', program)
  if (major) groupsQuery = groupsQuery.eq('major', major)
  if (defenseType) groupsQuery = groupsQuery.eq('defense_type', defenseType)

  if (sort === 'oldest') {
    groupsQuery = groupsQuery.order('submitted_at', { ascending: true })
  } else if (sort === 'title') {
    groupsQuery = groupsQuery.order('title', { ascending: true })
  } else if (sort === 'defense_date') {
    groupsQuery = groupsQuery
      .order('defense_schedules(defense_date)', { ascending: true, nullsFirst: false })
      .order('defense_schedules(start_time)', { ascending: true, nullsFirst: false })
      .order('submitted_at', { ascending: false })
  } else {
    groupsQuery = groupsQuery.order('submitted_at', { ascending: false })
  }

  const from = (requestedPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, count, error } = await groupsQuery.range(from, to)

  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  if (requestedPage > totalPages && totalCount > 0) {
    redirect(buildGroupsHref(params, totalPages))
  }

  const groups = (data ?? []) as ResearchGroupRow[]
  const activeFilterCount = [search, status, program, major, defenseType].filter(Boolean).length

  return (
    <section className="section research-groups-page">
      <div className="container">
        <div className="groups-page-heading">
          <div>
            <p className="eyebrow">Research Groups</p>
            <h2>Manage research submissions</h2>
            <p>Search, filter, sort, and open submitted research groups from one workspace.</p>
          </div>
          <Link className="button button-secondary button-small" href="/admin/dashboard">← Dashboard</Link>
        </div>

        <GroupsFilterForm params={params} />

        <div className="groups-results-bar">
          <div>
            <strong>{totalCount}</strong> {totalCount === 1 ? 'research group' : 'research groups'}
            {activeFilterCount > 0 ? <span> · {activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'}</span> : null}
          </div>
          <span>Page {requestedPage} of {totalPages}</span>
        </div>

        {error ? (
          <div className="card groups-empty-state">
            <h3>Research groups could not be loaded.</h3>
            <p>Please refresh the page or try again.</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="card groups-empty-state">
            <h3>No research groups match this view.</h3>
            <p>Adjust the filters or clear them to see all submissions.</p>
          </div>
        ) : (
          <>
            <div className="card groups-desktop-table table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Research</th>
                    <th>Program</th>
                    <th>Defense</th>
                    <th>Status</th>
                    <th>Schedule</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const schedule = one(group.defense_schedules)
                    const members = [...(group.group_members ?? [])].sort((a, b) => a.sort_order - b.sort_order)

                    return (
                      <tr key={group.id}>
                        <td className="research-cell groups-research-cell">
                          <span className="code">{group.public_code}</span>
                          <Link className="table-link" href={`/admin/groups/${group.id}`}>{group.title}</Link>
                          <small>{members.length} {members.length === 1 ? 'member' : 'members'}</small>
                        </td>
                        <td>{programLabel(group.program, group.major)}</td>
                        <td>{defenseTypeLabel(group.defense_type)}</td>
                        <td><span className={`status-pill status-${group.status}`}>{group.status}</span></td>
                        <td>
                          {schedule ? (
                            <span className="groups-schedule-cell">
                              <strong>{formatScheduleDate(schedule.defense_date)}</strong>
                              <small>{formatTime(schedule.start_time)} · {schedule.venue}</small>
                            </span>
                          ) : (
                            <span className="groups-unscheduled">Not scheduled</span>
                          )}
                        </td>
                        <td>{formatDate(group.submitted_at)}</td>
                        <td><Link className="button button-secondary button-small" href={`/admin/groups/${group.id}`}>Open</Link></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="groups-mobile-list" aria-label="Research groups">
              {groups.map((group) => {
                const schedule = one(group.defense_schedules)
                const members = [...(group.group_members ?? [])].sort((a, b) => a.sort_order - b.sort_order)
                const memberPreview = members.slice(0, 3).map((member) => member.full_name).join(', ')

                return (
                  <article className="card groups-mobile-card" key={group.id}>
                    <div className="groups-mobile-card-head">
                      <span className="code">{group.public_code}</span>
                      <span className={`status-pill status-${group.status}`}>{group.status}</span>
                    </div>
                    <h3>{group.title}</h3>
                    <div className="groups-card-tags">
                      <span>{programLabel(group.program, group.major)}</span>
                      <span>{defenseTypeLabel(group.defense_type)}</span>
                    </div>
                    <dl className="groups-mobile-details">
                      <div>
                        <dt>Members</dt>
                        <dd>{memberPreview || 'No members recorded'}{members.length > 3 ? ` +${members.length - 3} more` : ''}</dd>
                      </div>
                      <div>
                        <dt>Schedule</dt>
                        <dd>{schedule ? `${formatScheduleDate(schedule.defense_date)}, ${formatTime(schedule.start_time)} · ${schedule.venue}` : 'Not scheduled'}</dd>
                      </div>
                      <div>
                        <dt>Submitted</dt>
                        <dd>{formatDate(group.submitted_at)}</dd>
                      </div>
                    </dl>
                    <Link className="button groups-open-button" href={`/admin/groups/${group.id}`}>Open Research Group</Link>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {totalPages > 1 ? (
          <nav className="groups-pagination" aria-label="Research groups pagination">
            {requestedPage > 1 ? (
              <Link className="button button-secondary button-small" href={buildGroupsHref(params, requestedPage - 1)}>← Previous</Link>
            ) : <span />}
            <span>Page <strong>{requestedPage}</strong> of <strong>{totalPages}</strong></span>
            {requestedPage < totalPages ? (
              <Link className="button button-secondary button-small" href={buildGroupsHref(params, requestedPage + 1)}>Next →</Link>
            ) : <span />}
          </nav>
        ) : null}
      </div>
    </section>
  )
}

function GroupsFilterForm({ params }: { params: SearchParams }) {
  return (
    <form className="card groups-filter-panel" method="get">
      <div className="groups-search-row">
        <div className="field groups-search-field">
          <label htmlFor="q">Search research groups</label>
          <input
            defaultValue={params.q ?? ''}
            id="q"
            maxLength={150}
            name="q"
            placeholder="Title, reference code, member, or contact person"
            type="search"
          />
        </div>
        <button className="button" type="submit">Search</button>
      </div>

      <div className="groups-filter-grid">
        <div className="field">
          <label htmlFor="status">Status</label>
          <select defaultValue={params.status ?? ''} id="status" name="status">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="program">Program</label>
          <select defaultValue={params.program ?? ''} id="program" name="program">
            <option value="">All programs</option>
            <option value="BEED">BEED</option>
            <option value="BSED">BSED</option>
            <option value="BSA">BSA</option>
            <option value="BSAIS">BSAIS</option>
            <option value="BSBA">BSBA</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="major">Major</label>
          <select defaultValue={params.major ?? ''} id="major" name="major">
            <option value="">All majors</option>
            <optgroup label="BSED">
              <option value="English">English</option>
              <option value="Filipino">Filipino</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Science">Science</option>
            </optgroup>
            <optgroup label="BSBA">
              <option value="MM">MM</option>
              <option value="FM">FM</option>
              <option value="HRM">HRM</option>
            </optgroup>
          </select>
        </div>

        <div className="field">
          <label htmlFor="defense">Defense type</label>
          <select defaultValue={params.defense ?? ''} id="defense" name="defense">
            <option value="">All defense types</option>
            <option value="title">Title Defense</option>
            <option value="proposal">Proposal Defense</option>
            <option value="final">Final Defense</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select defaultValue={params.sort ?? 'newest'} id="sort" name="sort">
            <option value="newest">Newest submission</option>
            <option value="oldest">Oldest submission</option>
            <option value="title">Research title A-Z</option>
            <option value="defense_date">Defense date</option>
          </select>
        </div>
      </div>

      <div className="groups-filter-actions">
        <span>Filters apply when you select <strong>Apply Filters</strong>.</span>
        <div>
          <Link className="button button-secondary button-small" href="/admin/groups">Clear</Link>
          <button className="button button-small" type="submit">Apply Filters</button>
        </div>
      </div>
    </form>
  )
}
