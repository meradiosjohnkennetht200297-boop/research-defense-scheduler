import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidResearchCode, normalizeResearchCode } from '@/lib/research-access'
import { recordResearchCodeAttempt, researchCodeClientHash, researchCodeRateLimited } from '@/lib/research-code-guard'

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

const STAGES = ['title', 'proposal', 'final'] as const

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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const researchCode = normalizeResearchCode(body.researchCode)
    const admin = createAdminClient()
    const clientHash = researchCodeClientHash(request.headers)

    if (await researchCodeRateLimited(admin, clientHash)) {
      return NextResponse.json({ error: 'Too many unsuccessful attempts. Please try again in 15 minutes.' }, { status: 429 })
    }

    if (!isValidResearchCode(researchCode)) {
      await recordResearchCodeAttempt(admin, clientHash, researchCode, 'status', false)
      return NextResponse.json({ error: 'Enter a valid 4-character Research Code.' }, { status: 400 })
    }

    const { data: group, error: groupError } = await admin
      .from('research_groups')
      .select('id, title, program, major')
      .eq('public_code', researchCode)
      .maybeSingle()

    if (groupError) {
      console.error('Research status lookup failed:', groupError.message)
      return NextResponse.json({ error: 'Research status is temporarily unavailable.' }, { status: 500 })
    }
    if (!group) {
      await recordResearchCodeAttempt(admin, clientHash, researchCode, 'status', false)
      return NextResponse.json({ error: 'Research Code not found.' }, { status: 404 })
    }

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

    if (stageResult.error || scheduleResult.error) {
      console.error('Research status detail lookup failed:', stageResult.error?.message || scheduleResult.error?.message)
      return NextResponse.json({ error: 'Research status is temporarily unavailable.' }, { status: 500 })
    }

    await recordResearchCodeAttempt(admin, clientHash, researchCode, 'status', true)

    const stages = (stageResult.data ?? []) as Stage[]
    const schedules = (scheduleResult.data ?? []) as Schedule[]
    const scheduleByStage = new Map(schedules.map((schedule) => [schedule.research_defense_id, schedule]))
    const stageByType = new Map<string, Stage>()
    for (const stage of stages) if (stage.defense_type) stageByType.set(stage.defense_type, stage)

    return NextResponse.json({
      research: {
        title: group.title,
        program: group.program,
        major: group.major,
      },
      stages: STAGES.map((type) => {
        const stage = stageByType.get(type)
        const schedule = stage ? scheduleByStage.get(stage.id) : undefined
        const state = stageState(stage, schedule)
        const publishedSchedule = state === 'scheduled' && schedule?.is_published ? {
          defenseDate: schedule.defense_date,
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          venue: schedule.venue,
        } : null
        return {
          type,
          state,
          completedAt: stage?.completed_at ?? null,
          schedule: publishedSchedule,
        }
      }),
      hasLegacy: stages.some((stage) => !stage.defense_type),
    })
  } catch (error) {
    console.error('Research status route error:', error)
    return NextResponse.json({ error: 'Research status is temporarily unavailable.' }, { status: 500 })
  }
}
