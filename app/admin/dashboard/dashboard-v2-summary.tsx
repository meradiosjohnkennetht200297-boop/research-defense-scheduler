import Link from 'next/link'

export default function Summary({ pending, scheduled, actions }: {
  pending: number
  scheduled: number
  actions: number
}) {
  return (
    <nav aria-label="Dashboard summary" className="dashboard-quick-stats">
      <Link className="dashboard-quick-stat stat-pending" href="/admin/groups?status=pending">
        <span>Pending</span>
        <strong>{pending}</strong>
        <small>Needs scheduling</small>
      </Link>
      <Link className="dashboard-quick-stat stat-scheduled" href="/admin/schedule">
        <span>Scheduled</span>
        <strong>{scheduled}</strong>
        <small>Open schedule</small>
      </Link>
      <Link className={`dashboard-quick-stat ${actions ? 'stat-warning' : 'stat-clear'}`} href={actions ? '#action-required' : '/admin/schedule'}>
        <span>Action required</span>
        <strong>{actions}</strong>
        <small>{actions ? 'Confirm or reschedule' : 'Nothing waiting'}</small>
      </Link>
    </nav>
  )
}
