import { requireDashboardAdmin } from './dashboard-v2-auth'
import { loadDashboardData } from './dashboard-v2-data'
import { one, stamp, todayKey } from './dashboard-v2-utils'
import Summary from './dashboard-v2-summary'
import ActionRequired from './dashboard-v2-actions'
import MonthCalendar from './dashboard-month-calendar'

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export default async function DashboardV2({ searchParams }: { searchParams: Promise<{ confirmed?: string; error?: string; month?: string }> }) {
  const params = await searchParams
  await requireDashboardAdmin()
  const data = await loadDashboardData()
  const now = Date.now()
  const today = todayKey()
  const currentMonth = today.slice(0, 7)
  const requestedMonth = String(params.month ?? '')
  const month = MONTH_PATTERN.test(requestedMonth) ? requestedMonth : currentMonth
  const rows = data.schedules as any[]
  const scheduledRows = rows.filter((schedule) => {
    const defense: any = one(schedule.research_defenses)
    return defense?.status === 'scheduled'
  })
  const actions = scheduledRows
    .filter((schedule) => stamp(schedule.defense_date, schedule.end_time) <= now)
    .sort((a, b) => stamp(b.defense_date, b.end_time) - stamp(a.defense_date, a.end_time))

  return <section className="section admin-dashboard-page">
    <div className="container">
      <div className="dashboard-heading"><div><p className="eyebrow">Admin Dashboard</p></div></div>
      {params.confirmed ? <div className="alert alert-success">Defense stage confirmed completed and retained on the defense calendar.</div> : null}
      {params.error ? <div className="alert alert-error">{params.error}</div> : null}
      <Summary actions={actions.length} pending={data.pendingCount} scheduled={data.scheduledCount}/>
      <div className={`dashboard-overview-grid${actions.length ? '' : ' calendar-only'}`}>
        <ActionRequired rows={actions}/>
        <MonthCalendar month={month} rows={rows} today={today} now={now} pending={data.pendingCount}/>
      </div>
    </div>
  </section>
}
