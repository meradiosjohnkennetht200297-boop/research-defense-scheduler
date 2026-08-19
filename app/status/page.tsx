import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { defenseLabel, normalizeResearchCode } from '@/lib/research-access'
import styles from './status.module.css'

type Stage = {
  id: string
  defense_type: string | null
  status: string
  requested_at: string
  completed_at: string | null
}

type Schedule = {
  research_defense_id: string
  defense_date: string
  start_time: string
  end_time: string
  venue: string
  is_published: boolean
}

type StageState = 'notRequested' | 'pending' | 'scheduled' | 'awaiting' | 'completed' | 'cancelled'

const STAGE_ORDER = ['title', 'proposal', 'final'] as const

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatTime(value: string) {
  const [h, m] = value.split(':')
  let hour = Number(h)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (!hour) hour = 12
  return `${hour}:${m ?? '00'} ${suffix}`
}

function ended(schedule: Schedule) {
  return new Date(`${schedule.defense_date}T${String(schedule.end_time).slice(0, 8)}+08:00`).getTime() <= Date.now()
}

function stageState(stage: Stage | undefined, schedule: Schedule | undefined): StageState {
  if (!stage) return 'notRequested'
  if (stage.status === 'pending') return 'pending'
  if (stage.status === 'completed') return 'completed'
  if (stage.status === 'cancelled') return 'cancelled'
  if (stage.status === 'scheduled' && schedule && ended(schedule)) return 'awaiting'
  if (stage.status === 'scheduled') return 'scheduled'
  return 'pending'
}

function statusLabel(state: StageState) {
  if (state === 'notRequested') return 'Not requested'
  if (state === 'pending') return 'Pending scheduling'
  if (state === 'scheduled') return 'Scheduled'
  if (state === 'awaiting') return 'Awaiting confirmation'
  if (state === 'completed') return 'Completed'
  return 'Cancelled'
}

function stateClass(state: StageState) {
  if (state === 'notRequested') return styles.notRequested
  if (state === 'pending') return styles.pending
  if (state === 'scheduled') return styles.scheduled
  if (state === 'awaiting') return styles.awaiting
  if (state === 'completed') return styles.completed
  return styles.cancelled
}

export default async function ResearchStatusPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams
  const code = normalizeResearchCode(params.code)
  const admin = createAdminClient()

  let group: { id: string; public_code: string; title: string; program: string | null; major: string | null } | null = null
  let stages: Stage[] = []
  let schedules: Schedule[] = []
  let lookupError = false

  if (code) {
    const { data, error } = await admin
      .from('research_groups')
      .select('id, public_code, title, program, major')
      .eq('public_code', code)
      .maybeSingle()

    if (error) lookupError = true
    group = data

    if (group) {
      const [stageResult, scheduleResult] = await Promise.all([
        admin
          .from('research_defenses')
          .select('id, defense_type, status, requested_at, completed_at')
          .eq('research_group_id', group.id)
          .order('requested_at'),
        admin
          .from('defense_schedules')
          .select('research_defense_id, defense_date, start_time, end_time, venue, is_published')
          .eq('research_group_id', group.id),
      ])

      lookupError = Boolean(stageResult.error || scheduleResult.error)
      stages = (stageResult.data ?? []) as Stage[]
      schedules = (scheduleResult.data ?? []) as Schedule[]
    }
  }

  const scheduleByStage = new Map(schedules.map((schedule) => [schedule.research_defense_id, schedule]))
  const stageByType = new Map<string, Stage>()
  for (const stage of stages) if (stage.defense_type) stageByType.set(stage.defense_type, stage)

  const typedStages = stages.filter((stage) => stage.defense_type)
  const latestStage = typedStages.at(-1)
  const latestSchedule = latestStage ? scheduleByStage.get(latestStage.id) : undefined
  const currentState = stageState(latestStage, latestSchedule)
  const currentStageLabel = latestStage?.defense_type ? defenseLabel(latestStage.defense_type) : 'Title Defense'
  const programLabel = group ? `${group.program ?? 'Program not recorded'}${group.major ? ` - ${group.major}` : ''}` : ''

  return (
    <section className={`section ${styles.page}`}>
      <div className={`container ${styles.container}`}>
        <header className={styles.hero}>
          <div>
            <p className="eyebrow">Research Status</p>
            <h1>Check your research</h1>
            <p>Enter your permanent Research ID to see your progress from Title Defense through Final Defense.</p>
          </div>
          <Link className={styles.homeLink} href="/">← Home</Link>
        </header>

        <form action="/status" className={`card ${styles.searchCard}`} method="get">
          <div className={styles.searchCopy}>
            <strong>Research ID</strong>
            <span>No Access Key is needed to view status.</span>
          </div>
          <div className={styles.searchControls}>
            <input
              aria-label="Research ID"
              autoCapitalize="characters"
              autoComplete="off"
              defaultValue={code}
              id="research-status-code"
              name="code"
              placeholder="RD-XXXXXXXX"
              required
            />
            <button className="button" type="submit">Check status</button>
          </div>
          <small className={styles.searchHint}>The same Research ID stays with your group across all defense stages.</small>
        </form>

        {lookupError ? (
          <div className={`alert alert-error ${styles.message}`}>Research status is temporarily unavailable. Please try again.</div>
        ) : null}

        {code && !lookupError && !group ? (
          <div className={`card ${styles.notFound}`}>
            <div className={styles.notFoundMark}>?</div>
            <div>
              <h2>Research ID not found</h2>
              <p>Check the letters and numbers in <strong>{code}</strong>, then try again.</p>
            </div>
          </div>
        ) : null}

        {!code ? (
          <div className={styles.introNote}>
            <span>One Research ID</span>
            <p>Use it to follow scheduling, completion, and your next defense stage without exposing your Access Key.</p>
          </div>
        ) : null}

        {group && !lookupError ? (
          <div className={styles.results}>
            <article className={`card ${styles.summary}`}>
              <div className={styles.summaryMain}>
                <div className={styles.summaryLabels}>
                  <span className="code">{group.public_code}</span>
                  <span className={styles.recordLabel}>Research record</span>
                </div>
                <h2>{group.title}</h2>
                <p>{programLabel}</p>
              </div>
              <div className={styles.currentProgress}>
                <span>Current progress</span>
                <strong>{currentStageLabel}</strong>
                <span className={`${styles.stateBadge} ${stateClass(currentState)}`}>{statusLabel(currentState)}</span>
              </div>
            </article>

            <section className={styles.progressSection} aria-labelledby="defense-progress-heading">
              <div className={styles.progressHeading}>
                <div>
                  <p className="eyebrow">Defense Progress</p>
                  <h2 id="defense-progress-heading">Your research journey</h2>
                </div>
                <p>Each stage stays connected to the same Research ID.</p>
              </div>

              <div className={styles.timeline}>
                {STAGE_ORDER.map((type, index) => {
                  const stage = stageByType.get(type)
                  const schedule = stage ? scheduleByStage.get(stage.id) : undefined
                  const state = stageState(stage, schedule)
                  const showPublishedDetails = state === 'scheduled' && Boolean(schedule?.is_published)

                  return (
                    <article className={`${styles.stage} ${stateClass(state)}`} key={type}>
                      <div className={styles.rail} aria-hidden="true">
                        <span className={styles.marker}>{state === 'completed' ? '✓' : index + 1}</span>
                        {index < STAGE_ORDER.length - 1 ? <span className={styles.connector} /> : null}
                      </div>

                      <div className={styles.stageBody}>
                        <div className={styles.stageHeader}>
                          <h3>{defenseLabel(type)}</h3>
                          <span className={`${styles.stateBadge} ${stateClass(state)}`}>{statusLabel(state)}</span>
                        </div>

                        <div className={styles.stageDetail}>
                          {state === 'notRequested' ? <p>This stage has not been requested yet.</p> : null}
                          {state === 'pending' ? <p>Your request has been received and is waiting for the administrator to schedule it.</p> : null}
                          {state === 'awaiting' ? <p>The scheduled defense time has ended and is awaiting administrator confirmation.</p> : null}
                          {state === 'scheduled' && !showPublishedDetails ? <p>Your defense is scheduled. Details will appear here once they are published.</p> : null}
                          {showPublishedDetails && schedule ? (
                            <div className={styles.scheduleBox}>
                              <div>
                                <span>Date</span>
                                <strong>{formatDate(schedule.defense_date)}</strong>
                              </div>
                              <div>
                                <span>Time</span>
                                <strong>{formatTime(schedule.start_time)}–{formatTime(schedule.end_time)}</strong>
                              </div>
                              <div>
                                <span>Venue</span>
                                <strong>{schedule.venue}</strong>
                              </div>
                            </div>
                          ) : null}
                          {state === 'completed' ? <p>{schedule ? `Completed on ${formatDate(schedule.defense_date)}.` : 'This defense stage is completed.'}</p> : null}
                          {state === 'cancelled' ? <p>Please contact the research administrator about this defense record.</p> : null}
                        </div>
                      </div>
                    </article>
                  )
                })}

                {stages.some((stage) => !stage.defense_type) ? (
                  <article className={`${styles.legacy} card`}>
                    <strong>Legacy defense record</strong>
                    <p>An older defense exists without a recorded stage. Contact the administrator if this must be corrected before continuing.</p>
                  </article>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </section>
  )
}
