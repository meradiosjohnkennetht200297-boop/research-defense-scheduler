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
}

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

export default async function CompletedDefenseHistory({ searchParams }: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const search = String(params.q ?? '').trim().slice(0, 150)
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

  const { data, error } = await supabase
    .from('defense_schedules')
    .select(`
      id, defense_date, start_time, end_time, venue,
      completed_at, completion_note, completed_by,
      research_groups!inner (
        id, public_code, title, program, major, defense_type, status
      ),
      admin_profiles!defense_schedules_completed_by_fkey (
        display_name
      )
    `)
    .eq('research_groups.status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('defense_date', { ascending: false })

  const rows = ((data ?? []) as HistoryRow[]).filter((row) => {
    if (!search) return true
    const group = one(row.research_groups)
    const haystack = `${group?.public_code ?? ''} ${group?.title ?? ''} ${group?.program ?? ''} ${group?.major ?? ''}`.toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  return (
    <section className={`section ${styles.page}`}>
      <div className="container">
        <div className={styles.heading}>
          <div>
            <p className="eyebrow">Completed Defense History</p>
            <h2>Completed defenses</h2>
            <p>Review defenses that were confirmed completed, including their schedule and completion note.</p>
          </div>
          <Link className="button button-secondary button-small" href="/admin/dashboard">← Dashboard</Link>
        </div>

        <form className={`card ${styles.search}`} method="get">
          <div className="field">
            <label htmlFor="history-search">Search completed defenses</label>
            <input id="history-search" name="q" defaultValue={search} placeholder="Research title, code, or program" />
          </div>
          <button className="button button-small" type="submit">Search</button>
          {search ? <Link className="button button-secondary button-small" href="/admin/history">Clear</Link> : null}
        </form>

        {error ? (
          <div className="card empty-state"><h3>History is temporarily unavailable.</h3><p>Please try again later.</p></div>
        ) : rows.length === 0 ? (
          <div className="card empty-state">
            <h3>{search ? 'No completed defenses match your search.' : 'No completed defenses yet.'}</h3>
            <p>{search ? 'Try another title, code, or program.' : 'Confirmed defenses will appear here automatically.'}</p>
          </div>
        ) : (
          <div className={styles.list}>
            {rows.map((row) => {
              const group = one(row.research_groups)
              if (!group) return null
              const completedBy = one(row.admin_profiles)?.display_name ?? 'Administrator'
              const program = group.program ? `${group.program}${group.major ? ` - ${group.major}` : ''}` : 'Program not recorded'

              return (
                <article className={`card ${styles.card}`} key={row.id}>
                  <div className={styles.main}>
                    <div className="schedule-labels">
                      <span className="code">{group.public_code}</span>
                      <span className="defense-type-pill">{defenseTypeLabel(group.defense_type)}</span>
                      <span className="status-pill status-completed">completed</span>
                    </div>
                    <h3>{group.title}</h3>
                    <p>{program}</p>
                  </div>

                  <dl className={styles.details}>
                    <div><dt>Defense schedule</dt><dd>{formatDate(row.defense_date)} · {formatTime(row.start_time)}–{formatTime(row.end_time)}</dd></div>
                    <div><dt>Venue</dt><dd>{row.venue}</dd></div>
                    <div><dt>Confirmed completed</dt><dd>{formatCompletedAt(row.completed_at)}</dd></div>
                    <div><dt>Confirmed by</dt><dd>{row.completed_at ? completedBy : 'Not recorded for legacy completion'}</dd></div>
                  </dl>

                  <div className={styles.note}>
                    <span>Completion note</span>
                    <p>{row.completion_note || 'No completion note was added.'}</p>
                  </div>

                  <Link className="button button-secondary button-small" href={`/admin/groups/${group.id}`}>Open Research</Link>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
