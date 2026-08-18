import { createClient } from '@/lib/supabase/server'

export async function loadDashboardData() {
  const supabase = await createClient()
  const [pendingCount, scheduledCount, schedules] = await Promise.all([
    supabase.from('research_groups').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('research_groups').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
    supabase
      .from('defense_schedules')
      .select(`id,defense_date,start_time,end_time,venue,research_groups(id,public_code,title,defense_type,status),panel_assignments(panel_role,sort_order,faculty(full_name))`)
      .order('defense_date', { ascending: true })
      .order('start_time', { ascending: true }),
  ])

  return {
    pendingCount: pendingCount.count ?? 0,
    scheduledCount: scheduledCount.count ?? 0,
    schedules: schedules.data ?? [],
  }
}
