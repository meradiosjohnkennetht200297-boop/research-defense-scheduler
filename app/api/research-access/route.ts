import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidResearchCode, nextDefenseType, normalizeResearchCode } from '@/lib/research-access'
import { recordResearchCodeAttempt, researchCodeClientHash, researchCodeRateLimited } from '@/lib/research-code-guard'

type DefenseRow = { id: string; defense_type: string | null; status: string; requested_at: string; created_at: string }

const stageRank = (value: string | null) => value === 'final' ? 3 : value === 'proposal' ? 2 : value === 'title' ? 1 : 0

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const researchCode = normalizeResearchCode(body.researchCode ?? body.publicCode)
    const admin = createAdminClient()
    const clientHash = researchCodeClientHash(request.headers)

    if (await researchCodeRateLimited(admin, clientHash)) {
      return NextResponse.json({ error: 'Too many unsuccessful attempts. Please try again in 15 minutes.' }, { status: 429 })
    }

    if (!isValidResearchCode(researchCode)) {
      await recordResearchCodeAttempt(admin, clientHash, researchCode, 'continue', false)
      return NextResponse.json({ error: 'Enter a valid 4-character Research Code.' }, { status: 400 })
    }

    const { data: group, error } = await admin
      .from('research_groups')
      .select('id, public_code, title, program, major, research_file_url, contact_person, contact_email, contact_number, instructor_id, adviser_id')
      .eq('public_code', researchCode)
      .maybeSingle()

    if (error) {
      console.error('Research access lookup failed:', error.message)
      return NextResponse.json({ error: 'Unable to verify the research record right now.' }, { status: 500 })
    }

    if (!group) {
      await recordResearchCodeAttempt(admin, clientHash, researchCode, 'continue', false)
      return NextResponse.json({ error: 'Research Code not found.' }, { status: 404 })
    }

    const [membersResult, defensesResult] = await Promise.all([
      admin.from('group_members').select('full_name, sort_order').eq('research_group_id', group.id).order('sort_order'),
      admin.from('research_defenses').select('id, defense_type, status, requested_at, created_at').eq('research_group_id', group.id),
    ])
    if (membersResult.error || defensesResult.error) {
      return NextResponse.json({ error: 'The research record could not be loaded completely.' }, { status: 500 })
    }

    await recordResearchCodeAttempt(admin, clientHash, researchCode, 'continue', true)

    const defenses = ((defensesResult.data ?? []) as DefenseRow[]).sort((a, b) => {
      const requested = b.requested_at.localeCompare(a.requested_at)
      if (requested) return requested
      const created = b.created_at.localeCompare(a.created_at)
      if (created) return created
      return stageRank(b.defense_type) - stageRank(a.defense_type)
    })
    const latest = defenses[0]
    if (!latest) return NextResponse.json({ error: 'No defense stage is recorded for this research. Please contact the administrator.' }, { status: 409 })

    const nextType = latest.status === 'completed' ? nextDefenseType(latest.defense_type) : null
    let reason: string | null = null
    if (latest.status === 'pending') reason = 'This research already has a defense request waiting to be scheduled.'
    else if (latest.status === 'scheduled') reason = 'This research already has a scheduled defense.'
    else if (latest.status === 'cancelled') reason = 'The latest defense record is cancelled. Please contact the administrator.'
    else if (latest.status === 'completed' && !nextType) reason = latest.defense_type === 'final' ? 'All three defense stages are already completed.' : 'The previous defense type is not recorded. Please contact the administrator.'

    return NextResponse.json({
      verified: true,
      canContinue: Boolean(nextType),
      reason,
      currentDefenseType: latest.defense_type,
      currentStatus: latest.status,
      nextDefenseType: nextType,
      group: {
        researchCode: group.public_code,
        title: group.title,
        program: group.program ?? '',
        major: group.major ?? '',
        researchFileUrl: group.research_file_url ?? '',
        contactPerson: group.contact_person,
        contactEmail: group.contact_email ?? '',
        contactNumber: group.contact_number ?? '',
        instructorId: group.instructor_id ?? '',
        adviserId: group.adviser_id ?? '',
        members: (membersResult.data ?? []).map((member) => member.full_name),
      },
    })
  } catch (error) {
    console.error('Research access route error:', error)
    return NextResponse.json({ error: 'Unable to verify the research record right now.' }, { status: 500 })
  }
}
