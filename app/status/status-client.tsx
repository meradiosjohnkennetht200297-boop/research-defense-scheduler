'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { defenseLabel } from '@/lib/research-access'
import styles from './status.module.css'

type StageState = 'notRequested' | 'pending' | 'scheduled' | 'awaiting' | 'completed' | 'cancelled'
type Stage = {
  type: 'title' | 'proposal' | 'final'
  state: StageState
  completedAt: string | null
  schedule: { defenseDate: string; startTime: string; endTime: string; venue: string } | null
}
type Result = {
  research: { title: string; program: string | null; major: string | null }
  stages: Stage[]
  hasLegacy: boolean
}

function formatDate(value: string) {
  const dateOnly = value.includes('T') ? value.slice(0, 10) : value
  const [year, month, day] = dateOnly.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatTime(value: string) {
  const [h, m] = value.split(':')
  let hour = Number(h)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (!hour) hour = 12
  return `${hour}:${m ?? '00'} ${suffix}`
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

export default function ResearchStatusClient() {
  const [researchCode, setResearchCode] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch('/api/research-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchCode }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to check research status.')
      setResult(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to check research status.')
    } finally {
      setLoading(false)
    }
  }

  const currentStage = result ? [...result.stages].reverse().find((stage) => stage.state !== 'notRequested') : null
  const programLabel = result ? `${result.research.program ?? 'Program not recorded'}${result.research.major ? ` - ${result.research.major}` : ''}` : ''

  return (
    <section className={`section ${styles.page}`}>
      <div className={`container ${styles.container}`}>
        <header className={styles.hero}>
          <div>
            <p className="eyebrow">Research Status</p>
            <h1>Check your research</h1>
            <p>Enter your private 4-character Research Code.</p>
          </div>
          <Link className={styles.homeLink} href="/">← Home</Link>
        </header>

        <form className={`card ${styles.searchCard}`} onSubmit={submit}>
          <div className={styles.searchCopy}>
            <strong>Research Code</strong>
            <span>Keep this code private.</span>
          </div>
          <div className={styles.searchControls}>
            <input
              aria-label="Research Code"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={4}
              onChange={(event) => setResearchCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
              placeholder="K7M4"
              required
              value={researchCode}
            />
            <button className="button" disabled={loading} type="submit">{loading ? 'Checking…' : 'Check status'}</button>
          </div>
        </form>

        {error ? <div className={`alert alert-error ${styles.message}`}>{error}</div> : null}

        {result ? (
          <div className={styles.results}>
            <article className={`card ${styles.summary}`}>
              <div className={styles.summaryMain}>
                <div className={styles.summaryLabels}><span className={styles.recordLabel}>Research record</span></div>
                <h2>{result.research.title}</h2>
                <p>{programLabel}</p>
              </div>
              <div className={styles.currentProgress}>
                <span>Current progress</span>
                <strong>{currentStage ? defenseLabel(currentStage.type) : 'Title Defense'}</strong>
                <span className={`${styles.stateBadge} ${stateClass(currentStage?.state ?? 'notRequested')}`}>{statusLabel(currentStage?.state ?? 'notRequested')}</span>
              </div>
            </article>

            <section className={styles.progressSection} aria-labelledby="defense-progress-heading">
              <div className={styles.progressHeading}>
                <div>
                  <p className="eyebrow">Defense Progress</p>
                  <h2 id="defense-progress-heading">Your research journey</h2>
                </div>
              </div>

              <div className={styles.timeline}>
                {result.stages.map((stage, index) => (
                  <article className={`${styles.stage} ${stateClass(stage.state)}`} key={stage.type}>
                    <div className={styles.rail} aria-hidden="true">
                      <span className={styles.marker}>{stage.state === 'completed' ? '✓' : index + 1}</span>
                      {index < result.stages.length - 1 ? <span className={styles.connector} /> : null}
                    </div>
                    <div className={styles.stageBody}>
                      <div className={styles.stageHeader}>
                        <h3>{defenseLabel(stage.type)}</h3>
                        <span className={`${styles.stateBadge} ${stateClass(stage.state)}`}>{statusLabel(stage.state)}</span>
                      </div>
                      <div className={styles.stageDetail}>
                        {stage.state === 'notRequested' ? <p>This stage has not been requested yet.</p> : null}
                        {stage.state === 'pending' ? <p>Your request has been received and is waiting to be scheduled.</p> : null}
                        {stage.state === 'awaiting' ? <p>The scheduled defense time has ended and is awaiting administrator confirmation.</p> : null}
                        {stage.state === 'scheduled' && !stage.schedule ? <p>Your defense is scheduled. Details will appear here once they are published.</p> : null}
                        {stage.state === 'scheduled' && stage.schedule ? (
                          <div className={styles.scheduleBox}>
                            <div><span>Date</span><strong>{formatDate(stage.schedule.defenseDate)}</strong></div>
                            <div><span>Time</span><strong>{formatTime(stage.schedule.startTime)}–{formatTime(stage.schedule.endTime)}</strong></div>
                            <div><span>Venue</span><strong>{stage.schedule.venue}</strong></div>
                          </div>
                        ) : null}
                        {stage.state === 'completed' ? <p>{stage.completedAt ? `Completed on ${formatDate(stage.completedAt)}.` : 'This defense stage is completed.'}</p> : null}
                        {stage.state === 'cancelled' ? <p>Please contact the research administrator about this defense record.</p> : null}
                      </div>
                    </div>
                  </article>
                ))}

                {result.hasLegacy ? (
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
