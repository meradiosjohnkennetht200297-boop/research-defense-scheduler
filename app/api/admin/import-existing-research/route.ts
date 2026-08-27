import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RESEARCH_DESIGN_VALUES } from '@/lib/research-design'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalUuid(value: unknown) {
  const next = text(value)
  return next || null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    const userId = claimsData?.claims?.sub
    if (!userId) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('admin_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()
    if (!profile) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const body = await request.json()
    const researchDesign = text(body.researchDesign)
    const researchDesignOther = text(body.researchDesignOther)
    if (!RESEARCH_DESIGN_VALUES.has(researchDesign)) return NextResponse.json({ error: 'Select a valid research design.' }, { status: 400 })
    if (researchDesign === 'other' && !researchDesignOther) return NextResponse.json({ error: 'Specify the research design.' }, { status: 400 })

    const members = Array.isArray(body.members) ? body.members.map(text).filter(Boolean).slice(0, 20) : []
    const panelMemberIds = Array.isArray(body.panelMemberIds) ? body.panelMemberIds.map(text).filter(Boolean).slice(0, 4) : []
    const hasSchedule = Boolean(body.hasSchedule)

    const { data, error } = await supabase.rpc('import_existing_research_v2', {
      p_title: text(body.title),
      p_program: text(body.program),
      p_major: text(body.major) || null,
      p_contact_person: text(body.contactPerson),
      p_contact_email: text(body.contactEmail) || null,
      p_contact_number: text(body.contactNumber) || null,
      p_research_file_url: text(body.researchFileUrl) || null,
      p_instructor_id: optionalUuid(body.instructorId),
      p_adviser_id: optionalUuid(body.adviserId),
      p_members: members,
      p_current_stage: text(body.currentStage),
      p_has_schedule: hasSchedule,
      p_defense_date: hasSchedule ? text(body.defenseDate) || null : null,
      p_start_time: hasSchedule ? text(body.startTime) || null : null,
      p_end_time: hasSchedule ? text(body.endTime) || null : null,
      p_venue: hasSchedule ? text(body.venue) || null : null,
      p_notes: hasSchedule ? text(body.notes) || null : null,
      p_chair_id: hasSchedule ? optionalUuid(body.chairId) : null,
      p_panel_member_ids: hasSchedule ? panelMemberIds : [],
      p_is_published: hasSchedule ? Boolean(body.isPublished) : false,
      p_research_design: researchDesign,
      p_research_design_other: researchDesign === 'other' ? researchDesignOther.slice(0, 120) : null,
    })

    if (error) {
      console.error('Existing research import failed:', error.message)
      return NextResponse.json({ error: 'Unable to add the existing research record.' }, { status: 500 })
    }

    const result = data as { ok?: boolean; error?: string; conflicts?: unknown[]; research_group_id?: string; research_code?: string; current_stage?: string; status?: string } | null
    if (!result?.ok) {
      return NextResponse.json({
        error: result?.error || (result?.conflicts?.length ? 'The schedule conflicts with an existing defense.' : 'Unable to add the existing research record.'),
        conflicts: result?.conflicts ?? [],
      }, { status: result?.conflicts?.length ? 409 : 400 })
    }

    return NextResponse.json({
      ok: true,
      researchGroupId: result.research_group_id,
      researchCode: result.research_code,
      currentStage: result.current_stage,
      status: result.status,
    })
  } catch (error) {
    console.error('Existing research import route error:', error)
    return NextResponse.json({ error: 'Unable to add the existing research record.' }, { status: 500 })
  }
}
