/** Defense dates and times are stored as Philippine local time. */
export function defenseHasEnded(date: string, endTime: string, now: number) {
  return new Date(`${date}T${endTime}+08:00`).getTime() <= now
}

export function isUpcomingDefense(status: string, date: string, endTime: string, now: number) {
  return status === 'scheduled' && !defenseHasEnded(date, endTime, now)
}

export function publicDefenseStatus(status: string, date: string, endTime: string, now: number) {
  if (status === 'completed') return '✓ Completed'
  return defenseHasEnded(date, endTime, now) ? 'Awaiting update' : 'Scheduled'
}
