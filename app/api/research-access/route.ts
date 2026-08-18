import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { accessKeyMatches, nextDefenseType, normalizeResearchCode } from '@/lib/research-access'

type DefenseRow = { id: string; defense_type: string | null; status: string; requested_at: string }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const publicCode = normalizeResearchCode(body.publicCode)
    const accessKey = String(body.accessKey ?? '').trim()
    if (!/^RD-[A-Z0-9]{8,}$/i.test(publicCode) || !accessKey) return NextResponse.json({ error: 'Enter your Research ID and Access Key.' }, { status: 400 })

    const supabase = createAdminClient()
    const { data: group, error } = await supabase.from('research_groups')
      .select('id, public_code, title, program, major, research_file_url, contact_person, contact_email, contact_number, instructor_id, adviser_id, access_key_hash')
      .eq('public_code', publicCode).maybeSingle()
    if (error) {
      console.error('Research access lookup failed:', error.message)
      return NextResponse.json({ error: 'Unable to verify the research record right now.' }, { status: 500 })
    }
    if (!group) return NextResponse.json({ error: 'Invalid Research ID or Access Key.' }, { status: 401 })
    if (!group.access_key_hash) return NextResponse.json({ error: 'This older research record does not have a student Access Key yet. Please ask the administrator to generate one.', needsAccessKeyReset: true }, { status: 409 })
    if (!accessKeyMatches(group.access_key_hash, accessKey)) return NextResponse.json({ error: 'Invalid Research ID or Access Key.' }, { status: 401 })

    const [membersResult, defensesResult] = await Promise.all([
      supabase.from('group_members').select('full_name, sort_order').eq('research_group_id', group.id).order('sort_order'),
      supabase.from('research_defenses').select('id, defense_type, status, requested_at').eq('research_group_id', group.id).order('requested_at', { ascending: false }),
    ])
    if (membersResult.error || defensesResult.error) return NextResponse.json({ error: 'The research record could not be loaded completely.' }, { status: 500 })
    const defenses = (defensesResult.data ?? []) as DefenseRow[]
    const latest = defenses[0]
    if (!latest) return NextResponse.json({ error: 'No defense stage is recorded for this research. Please contact the administrator.' }, { status: 409 })

    const nextType = latest.status === 'completed' ? nextDefenseType(latest.defense_type) : null
    let reason: string | null = null
    if (latest.status === 'pending') reason = 'This research already has a defense request waiting to be scheduled.'
    else if (latest.status === 'scheduled') reason = 'This research already has a scheduled defense.'
    else if (latest.status === 'cancelled') reason = 'The latest defense record is cancelled. Please contact the administrator.'
    else if (latest.status === 'completed' && !nextType) reason = latest.defense_type === 'final' ? 'All three defense stages are already completed.' : 'The previous defense type is not recorded. Please contact the administrator.'

    return NextResponse.json({
      verified: true, canContinue: Boolean(nextType), reason, currentDefenseType: latest.defense_type,
      currentStatus: latest.status, nextDefenseType: nextType,
      group: {
        publicCode: group.public_code, title: group.title, program: group.program ?? '', major: group.major ?? '',
        researchFileUrl: group.research_file_url ?? '', contactPerson: group.contact_person,
        contactEmail: group.contact_email ?? '', contactNumber: group.contact_number ?? '',
        instructorId: group.instructor_id ?? '', adviserId: group.adviser_id ?? '',
        members: (membersResult.data ?? []).map((member) => member.full_name),
      },
    })
  } catch (error) {
    console.error('Research access route error:', error)
    return NextResponse.json({ error: 'Unable to verify the research record right now.' }, { status: 500 })
  }
}
