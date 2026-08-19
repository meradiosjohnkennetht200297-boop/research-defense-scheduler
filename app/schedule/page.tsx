import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type DefenseType = 'title' | 'proposal' | 'final'
type FacultyName = { full_name: string }
type PanelAssignment = { panel_role: 'chair' | 'member'; sort_order: number; faculty: FacultyName | FacultyName[] | null }
type ResearchDefense = { defense_type: DefenseType | null; status: string; title_snapshot: string; program_snapshot: string | null; major_snapshot: string | null }
type ScheduleRow = { id: string; defense_date: string; start_time: string; end_time: string; venue: string; research_defenses: ResearchDefense | ResearchDefense[] | null; panel_assignments: PanelAssignment[] | null }
type SearchParams = { q?: string; defense?: string; program?: string; date?: string }

const DEFENSE_TYPES = new Set<DefenseType>(['title', 'proposal', 'final'])
const PROGRAMS = new Set(['BEED', 'BSED', 'BSA', 'BSAIS', 'BSBA'])

function one<T>(value: T | T[] | null | undefined): T | null {
  return !value ? null : Array.isArray(value) ? value[0] ?? null : value
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatLongDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatTime(value: string) {
  const [h, m] = value.split(':')
  let hour = Number(h)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (!hour) hour = 12
  return `${hour}:${m ?? '00'} ${suffix}`
}

function defenseLabel(value: DefenseType | null) {
  return value === 'title' ? 'Title Defense' : value === 'proposal' ? 'Proposal Defense' : value === 'final' ? 'Final Defense' : 'Research Defense'
}

function programLabel(defense: ResearchDefense) {
  return defense.program_snapshot ? `${defense.program_snapshot}${defense.major_snapshot ? ` - ${defense.major_snapshot}` : ''}` : 'Program not recorded'
}

function statusLabel(status: string) {
  return status === 'completed' ? 'Completed' : 'Scheduled'
}

export default async function PublicSchedule({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const q = String(params.q ?? '').trim().slice(0, 150)
  const defense = DEFENSE_TYPES.has(params.defense as DefenseType) ? params.defense as DefenseType : null
  const requestedProgram = String(params.program ?? '').toUpperCase()
  const program = PROGRAMS.has(requestedProgram) ? requestedProgram : null
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(params.date ?? '')) ? String(params.date) : null
  const hasFilters = Boolean(q || defense || program || date)
  const dayView = Boolean(date && !q && !defense && !program)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('defense_schedules')
    .select(`id, defense_date, start_time, end_time, venue, research_defenses!inner (defense_type, status, title_snapshot, program_snapshot, major_snapshot), panel_assignments (panel_role, sort_order, faculty (full_name))`)
    .eq('is_published', true)
    .in('research_defenses.status', ['scheduled', 'completed'])
    .order('defense_date', { ascending: true })
    .order('start_time', { ascending: true })

  const schedules = ((data ?? []) as ScheduleRow[]).filter((schedule) => {
    const stage = one(schedule.research_defenses)
    if (!stage) return false
    if (q && !stage.title_snapshot.toLowerCase().includes(q.toLowerCase())) return false
    if (defense && stage.defense_type !== defense) return false
    if (program && stage.program_snapshot !== program) return false
    if (date && schedule.defense_date !== date) return false
    return true
  })

  return (
    <section className="section minimal-schedule-page">
      <div className="container">
        <div className="minimal-page-heading">
          <div>
            <p className="eyebrow">Published Defenses</p>
            <h1>{dayView && date ? `Defenses on ${formatLongDate(date)}` : 'Defense schedule'}</h1>
            <p>{dayView ? 'Published scheduled and completed defenses for this date.' : 'Published defenses remain accessible after completion.'}</p>
          </div>
          <Link className="button button-secondary button-small" href={dayView && date ? `/?month=${date.slice(0, 7)}` : '/'}>{dayView ? '← Calendar' : '← Home'}</Link>
        </div>

        {dayView ? <div className="minimal-schedule-tools"><span className="minimal-result-count">{schedules.length} {schedules.length === 1 ? 'defense' : 'defenses'}</span></div> : (
          <div className="minimal-schedule-tools">
            <details className="minimal-filter" open={hasFilters || undefined}>
              <summary>Filter{hasFilters ? ' · Active' : ''}</summary>
              <form method="get" action="/schedule" className="minimal-filter-form">
                <div className="field minimal-filter-search"><label htmlFor="schedule-search">Research title</label><input id="schedule-search" name="q" defaultValue={q} maxLength={150} placeholder="Search title" /></div>
                <div className="field"><label htmlFor="schedule-defense">Defense type</label><select id="schedule-defense" name="defense" defaultValue={defense ?? ''}><option value="">All types</option><option value="title">Title Defense</option><option value="proposal">Proposal Defense</option><option value="final">Final Defense</option></select></div>
                <div className="field"><label htmlFor="schedule-program">Program</label><select id="schedule-program" name="program" defaultValue={program ?? ''}><option value="">All programs</option><option value="BEED">BEED</option><option value="BSED">BSED</option><option value="BSA">BSA</option><option value="BSAIS">BSAIS</option><option value="BSBA">BSBA</option></select></div>
                <div className="field"><label htmlFor="schedule-date">Date</label><input id="schedule-date" name="date" type="date" defaultValue={date ?? ''} /></div>
                <div className="minimal-filter-actions"><button className="button button-small" type="submit">Apply</button>{hasFilters ? <Link className="button button-secondary button-small" href="/schedule">Clear</Link> : null}</div>
              </form>
            </details>
            <span className="minimal-result-count">{schedules.length} {schedules.length === 1 ? 'defense' : 'defenses'}</span>
          </div>
        )}

        {error ? (
          <div className="minimal-empty"><h3>Schedule is temporarily unavailable.</h3><p>Please try again later.</p></div>
        ) : schedules.length === 0 ? (
          <div className="minimal-empty"><h3>{dayView ? 'No published defenses on this date.' : hasFilters ? 'No defenses match these filters.' : 'No published defenses yet.'}</h3><p>{dayView ? 'Return to the calendar and choose another marked date.' : hasFilters ? 'Change or clear the filters to see other defenses.' : 'Published scheduled and completed defenses will appear here.'}</p>{dayView && date ? <Link className="text-link" href={`/?month=${date.slice(0, 7)}`}>Back to calendar →</Link> : hasFilters ? <Link className="text-link" href="/schedule">Clear filters →</Link> : null}</div>
        ) : (
          <div className="minimal-schedule-list">
            {schedules.map((schedule) => {
              const stage = one(schedule.research_defenses)
              if (!stage) return null
              const panel = [...(schedule.panel_assignments ?? [])].sort((a, b) => a.sort_order - b.sort_order)
              const chair = panel.find((item) => item.panel_role === 'chair')
              const chairName = one(chair?.faculty)?.full_name ?? null
              const members = panel.filter((item) => item.panel_role === 'member').map((item) => one(item.faculty)?.full_name).filter((name): name is string => Boolean(name))

              return <article className={`minimal-schedule-card${stage.status === 'completed' ? ' is-completed-defense' : ''}`} key={schedule.id}><div className="minimal-schedule-when"><strong>{dayView ? `${formatTime(schedule.start_time)} – ${formatTime(schedule.end_time)}` : formatDate(schedule.defense_date)}</strong>{!dayView ? <span>{formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}</span> : null}</div><div className="minimal-schedule-main"><div className="minimal-defense-labels"><span className={`public-status-badge status-${stage.status}`}>{statusLabel(stage.status)}</span><span className={`public-defense-badge type-${stage.defense_type ?? 'general'}`}>{defenseLabel(stage.defense_type)}</span><span className="public-program-badge">{programLabel(stage)}</span></div><h2>{stage.title_snapshot}</h2><p><strong>Venue:</strong> {schedule.venue}</p></div><div className="minimal-panel"><div><span>Panel Chair</span><strong>{chairName ?? 'Not listed'}</strong></div><div><span>Panel Members</span><p>{members.length ? members.join(', ') : 'Not listed'}</p></div></div></article>
            })}
          </div>
        )}
      </div>
    </section>
  )
}
