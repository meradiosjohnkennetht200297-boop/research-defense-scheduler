'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type Props = {
  schedule: ReactNode
  panel: ReactNode
  controls: ReactNode
}

type ScheduleSummary = {
  date: string
  start: string
  end: string
  venue: string
}

function formatDate(value: string) {
  if (!value) return 'Date not set'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatTime(value: string) {
  if (!value) return ''
  const [hourText, minute = '00'] = value.split(':')
  let hour = Number(hourText)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (!hour) hour = 12
  return `${hour}:${minute} ${suffix}`
}

export default function WorkspaceScheduleStepper({ schedule, panel, controls }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<'schedule' | 'panel'>('schedule')
  const [summary, setSummary] = useState<ScheduleSummary>({ date: '', start: '', end: '', venue: '' })
  const [scheduleError, setScheduleError] = useState('')

  function form() {
    return rootRef.current?.closest('form') ?? null
  }

  function readSchedule() {
    const currentForm = form()
    return {
      defenseType: String((currentForm?.elements.namedItem('defenseType') as HTMLInputElement | HTMLSelectElement | null)?.value ?? ''),
      date: String((currentForm?.elements.namedItem('defenseDate') as HTMLInputElement | null)?.value ?? ''),
      start: String((currentForm?.elements.namedItem('startTime') as HTMLInputElement | null)?.value ?? ''),
      end: String((currentForm?.elements.namedItem('endTime') as HTMLInputElement | null)?.value ?? ''),
      venue: String((currentForm?.elements.namedItem('venue') as HTMLInputElement | null)?.value ?? '').trim(),
    }
  }

  function validateSchedule() {
    const values = readSchedule()
    if (!values.defenseType) {
      setScheduleError('Select the defense stage before continuing.')
      return false
    }
    if (!values.date || !values.start || !values.end || !values.venue) {
      setScheduleError('Complete the date, time, and venue before continuing to the panel.')
      return false
    }
    if (values.end <= values.start) {
      setScheduleError('End time must be later than the start time.')
      return false
    }
    setScheduleError('')
    setSummary({ date: values.date, start: values.start, end: values.end, venue: values.venue })
    return true
  }

  function openPanel() {
    if (!validateSchedule()) return
    setStep('panel')
    window.requestAnimationFrame(() => rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function openSchedule() {
    setStep('schedule')
    window.requestAnimationFrame(() => rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  useEffect(() => {
    const currentForm = form()
    if (!currentForm) return
    const handleReset = () => {
      setStep('schedule')
      setScheduleError('')
      setSummary({ date: '', start: '', end: '', venue: '' })
    }
    currentForm.addEventListener('reset', handleReset)
    return () => currentForm.removeEventListener('reset', handleReset)
  }, [])

  return (
    <div className="workspace-stepper" ref={rootRef}>
      <div className="workspace-step-tabs" aria-label="Defense scheduling steps">
        <button className={step === 'schedule' ? 'active' : ''} onClick={openSchedule} type="button">
          <span>1</span><strong>Schedule</strong>
        </button>
        <button className={step === 'panel' ? 'active' : ''} onClick={openPanel} type="button">
          <span>2</span><strong>Panel</strong>
        </button>
      </div>

      <div className={step === 'schedule' ? 'workspace-step active' : 'workspace-step'} data-schedule-step aria-hidden={step !== 'schedule'}>
        {schedule}
        {scheduleError ? <div className="alert alert-error workspace-step-error">{scheduleError}</div> : null}
        <div className="workspace-step-next">
          <button className="button" onClick={openPanel} type="button">Continue to Panel →</button>
        </div>
      </div>

      <div className={step === 'panel' ? 'workspace-step active' : 'workspace-step'} data-panel-step aria-hidden={step !== 'panel'}>
        {panel}
        <div className="workspace-panel-schedule-summary">
          <div><span>Schedule</span><strong>{formatDate(summary.date)}</strong></div>
          <div><span>Time</span><strong>{formatTime(summary.start)}{summary.end ? `–${formatTime(summary.end)}` : ''}</strong></div>
          <div><span>Venue</span><strong>{summary.venue || 'Not set'}</strong></div>
        </div>
        <button className="workspace-back-step" onClick={openSchedule} type="button">← Back to Schedule</button>
        {controls}
      </div>
    </div>
  )
}
