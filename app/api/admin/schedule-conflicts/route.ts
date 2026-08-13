import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STATUSES = new Set(['pending', 'scheduled', 'completed', 'cancelled'])

function clean(value: unknown, maxLength = 180) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function cleanUuid(value: unknown) {
  const text = clean(value, 36)
  return UUID_PATTERN.test(text) ? text : null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (!userId) {
    return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 })
  }

  const { data: adminProfile } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!adminProfile) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const groupId = cleanUuid(body.groupId)
    const defenseDate = clean(body.defenseDate, 10)
    const startTime = clean(body.startTime, 8)
    const endTime = clean(body.endTime, 8)
    const venue = clean(body.venue)
    const chairId = cleanUuid(body.chairId)
    const status = clean(body.status, 20).toLowerCase()
    const memberIds = Array.isArray(body.memberIds)
      ? [...new Set(body.memberIds.map(cleanUuid).filter((id): id is string => Boolean(id)))].slice(0, 4)
      : []

    if (!groupId || !defenseDate || !startTime || !endTime || !venue || !chairId) {
      return NextResponse.json(
        { error: 'Complete the date, time, venue, and panel chair before checking conflicts.' },
        { status: 400 }
      )
    }

    if (!STATUSES.has(status)) {
      return NextResponse.json({ error: 'Select a valid research status.' }, { status: 400 })
    }

    if (endTime <= startTime) {
      return NextResponse.json({ error: 'End time must be later than start time.' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('check_defense_schedule_conflicts', {
      p_group_id: groupId,
      p_defense_date: defenseDate,
      p_start_time: startTime,
      p_end_time: endTime,
      p_venue: venue,
      p_chair_id: chairId,
      p_member_ids: memberIds,
      p_status: status,
    })

    if (error) {
      console.error('Schedule conflict check failed:', error.message)
      return NextResponse.json({ error: 'Unable to check schedule conflicts right now.' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Schedule conflict route error:', error)
    return NextResponse.json({ error: 'Unable to check schedule conflicts right now.' }, { status: 500 })
  }
}
