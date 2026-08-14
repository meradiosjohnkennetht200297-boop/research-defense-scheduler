import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RecordActions from './record-actions'
import styles from './record.module.css'

function defenseLabel(value: string | null) {
  if (value === 'title') return 'Title Defense'
  if (value === 'proposal') return 'Proposal Defense'
  if (value === 'final') return 'Final Defense'
  return 'Not recorded'
}

function dateLabel(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function statusLabel(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : 'Unknown'
}

export default async function ResearchRecordOptions({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; cancelled?: string }>
}) {
  const { id } = await params
  const query = await searchParams
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

  const [groupResult, scheduleResult] = await Promise.all([
    supabase
      .from('research_groups')
      .select('id, public_code, title, program, major, defense_type, status')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('defense_schedules')
      .select('id, defense_date, start_time, end_time, venue, is_published')
      .eq('research_group_id', id)
      .maybeSingle(),
  ])

  const group = groupResult.data
  if (!group) notFound()

  const schedule = scheduleResult.data
  const program = group.program
    ? `${group.program}${group.major ? ` - ${group.major}` : ''}`
    : 'Not recorded'

  return (
    <section className={`section ${styles.page}`}>
      <div className="container">
        <div className={styles.topbar}>
          <div className={styles.crumbs}>
            <Link href="/admin/groups">Research Groups</Link>
            <span>/</span>
            <Link href={`/admin/groups/${id}`}>{group.public_code}</Link>
            <span>/</span>
            <span>Record Options</span>
          </div>
          <Link className="button button-secondary button-small" href={`/admin/groups/${id}`}>
            ← Back to workspace
          </Link>
        </div>

        {query.cancelled ? (
          <div className="alert alert-success">Research record cancelled.</div>
        ) : null}
        {query.error ? <div className="alert alert-error">{query.error}</div> : null}

        <div className={`card ${styles.summary}`}>
          <div className={styles.labels}>
            <span className="code">{group.public_code}</span>
            <span className={`status-pill status-${group.status}`}>{group.status}</span>
          </div>
          <h1>{group.title}</h1>
          <p>{program} · {defenseLabel(group.defense_type)}</p>
        </div>

        <div className={`card ${styles.panel}`}>
          <h2>Record options</h2>

          <div className={styles.recordMeta}>
            <div className={styles.metaRow}>
              <span>Status</span>
              <strong>{statusLabel(group.status)}</strong>
            </div>
            {schedule ? (
              <div className={styles.metaRow}>
                <span>Defense</span>
                <strong>{dateLabel(schedule.defense_date)}</strong>
              </div>
            ) : null}
          </div>

          {schedule ? (
            <Link className={`button button-secondary button-small ${styles.defenseLink}`} href={`/admin/groups/${id}`}>
              {group.status === 'completed' ? 'View Defense History →' : 'View Defense →'}
            </Link>
          ) : null}

          {scheduleResult.error ? (
            <p className={styles.lookupWarning}>Defense history could not be verified.</p>
          ) : null}

          <RecordActions
            groupId={group.id}
            publicCode={group.public_code}
            status={group.status}
            hasSchedule={Boolean(schedule)}
            historyCheckFailed={Boolean(scheduleResult.error)}
          />
        </div>
      </div>
    </section>
  )
}
