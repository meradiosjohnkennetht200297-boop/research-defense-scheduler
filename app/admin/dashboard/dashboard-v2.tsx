import { requireDashboardAdmin } from './dashboard-v2-auth'
import { loadDashboardData } from './dashboard-v2-data'
import { one, stamp, todayKey } from './dashboard-v2-utils'
import Summary from './dashboard-v2-summary'
import ActionRequired from './dashboard-v2-actions'
import Today from './dashboard-v2-today'
import NextDefense from './dashboard-v2-next'

export default async function DashboardV2({ searchParams }: { searchParams: Promise<{ confirmed?: string; error?: string }> }) {
  const params = await searchParams
  await requireDashboardAdmin()
  const data = await loadDashboardData()
  const now = Date.now()
  const today = todayKey()
  const rows = data.schedules as any[]

  const actions = rows.filter((schedule) => {
    const group: any = one(schedule.research_groups)
    return group?.status === 'scheduled' && stamp(schedule.defense_date, schedule.end_time) <= now
  })
  const active = rows
    .filter((schedule) => {
      const group: any = one(schedule.research_groups)
      return group?.status === 'scheduled' && stamp(schedule.defense_date, schedule.end_time) > now
    })
    .sort((a, b) => stamp(a.defense_date, a.start_time) - stamp(b.defense_date, b.start_time))
  const todayRows = active.filter((schedule) => schedule.defense_date === today)
  const next = active.find((schedule) => schedule.defense_date > today) ?? null

  return (
    <section className="section admin-dashboard-page">
      <div className="container">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">Admin Dashboard</p>
          </div>
        </div>

        {params.confirmed ? <div className="alert alert-success">Defense confirmed completed and added to history.</div> : null}
        {params.error ? <div className="alert alert-error">{params.error}</div> : null}

        <Summary pending={data.pendingCount} scheduled={data.scheduledCount} actions={actions.length} />
        <ActionRequired rows={actions} />
        <div className="dashboard-desktop-pair">
          <Today rows={todayRows} />
          <NextDefense row={next} />
        </div>
      </div>
    </section>
  )
}
