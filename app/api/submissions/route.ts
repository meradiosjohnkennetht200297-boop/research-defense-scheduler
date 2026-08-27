import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidResearchCode, normalizeResearchCode } from '@/lib/research-access'
import { recordResearchCodeAttempt, researchCodeClientHash, researchCodeRateLimited } from '@/lib/research-code-guard'
import { RESEARCH_DESIGN_VALUES } from '@/lib/research-design'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const GOOGLE_FILE_HOSTS = new Set(['drive.google.com', 'docs.google.com'])
const PROGRAMS = new Set(['BEED', 'BSED', 'BSA', 'BSAIS', 'BSBA'])
const BSED_MAJORS = new Set(['English', 'Filipino', 'Mathematics', 'Science'])
const BSBA_MAJORS = new Set(['MM', 'FM', 'HRM'])

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  return cleaned ? cleaned.slice(0, maxLength) : null
}
function cleanUuid(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  return UUID_PATTERN.test(value) ? value : null
}
function cleanGoogleFileUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const cleaned = value.trim().slice(0, 2048)
  if (!cleaned) return null
  try {
    const url = new URL(cleaned)
    if (url.protocol !== 'https:' || !GOOGLE_FILE_HOSTS.has(url.hostname)) return null
    return url.toString()
  } catch { return null }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const mode = body.mode === 'continue' ? 'continue' : 'new'
    const title = cleanOptionalText(body.title, 500)
    const program = typeof body.program === 'string' ? body.program.trim().toUpperCase() : ''
    const major = cleanOptionalText(body.major, 40)
    const researchDesign = typeof body.researchDesign === 'string' ? body.researchDesign.trim() : ''
    const researchDesignOther = cleanOptionalText(body.researchDesignOther, 120)
    const researchFileUrl = cleanGoogleFileUrl(body.researchFileUrl)
    const contactPerson = cleanOptionalText(body.contactPerson, 150)
    const contactEmail = cleanOptionalText(body.contactEmail, 254)
    const contactNumber = cleanOptionalText(body.contactNumber, 40)
    const instructorId = cleanUuid(body.instructorId)
    const adviserId = cleanUuid(body.adviserId)
    const members = Array.isArray(body.members)
      ? body.members.filter((value: unknown): value is string => typeof value === 'string').map((value: string) => value.trim().slice(0, 150)).filter(Boolean).slice(0, 20)
      : []

    if (!title || !contactPerson || members.length === 0) return NextResponse.json({ error: 'Research title, contact person, and at least one group member are required.' }, { status: 400 })
    if (!PROGRAMS.has(program)) return NextResponse.json({ error: 'Please select a valid program.' }, { status: 400 })
    if (program === 'BSED' && (!major || !BSED_MAJORS.has(major))) return NextResponse.json({ error: 'Please select a valid BSED major.' }, { status: 400 })
    if (program === 'BSBA' && (!major || !BSBA_MAJORS.has(major))) return NextResponse.json({ error: 'Please select a valid BSBA major.' }, { status: 400 })
    if (!RESEARCH_DESIGN_VALUES.has(researchDesign)) return NextResponse.json({ error: 'Please select a valid research design.' }, { status: 400 })
    if (researchDesign === 'other' && !researchDesignOther) return NextResponse.json({ error: 'Please specify the research design.' }, { status: 400 })
    if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail)) return NextResponse.json({ error: 'Please enter a valid email address or leave it blank.' }, { status: 400 })
    if (!researchFileUrl) return NextResponse.json({ error: 'Please provide a valid Google Drive or Google Docs research file link.' }, { status: 400 })

    const normalizedMajor = program === 'BSED' || program === 'BSBA' ? major : null
    const designUpdate = { research_design: researchDesign, research_design_other: researchDesign === 'other' ? researchDesignOther : null }
    const admin = createAdminClient()

    if (mode === 'continue') {
      const researchCode = normalizeResearchCode(body.researchCode ?? body.publicCode)
      const clientHash = researchCodeClientHash(request.headers)

      if (await researchCodeRateLimited(admin, clientHash)) {
        return NextResponse.json({ error: 'Too many unsuccessful attempts. Please try again in 15 minutes.' }, { status: 429 })
      }
      if (!isValidResearchCode(researchCode)) {
        await recordResearchCodeAttempt(admin, clientHash, researchCode, 'submit', false)
        return NextResponse.json({ error: 'Enter a valid 4-character Research Code.' }, { status: 400 })
      }

      const { data, error } = await admin.rpc('continue_research_group_v3', {
        p_public_code: researchCode,
        p_title: title,
        p_contact_person: contactPerson,
        p_contact_email: contactEmail,
        p_contact_number: contactNumber,
        p_instructor_id: instructorId,
        p_adviser_id: adviserId,
        p_research_file_url: researchFileUrl,
        p_program: program,
        p_major: normalizedMajor,
        p_members: members,
      })
      if (error) {
        console.error('Research continuation failed:', error.message)
        return NextResponse.json({ error: 'The defense request could not be saved. Please try again.' }, { status: 500 })
      }

      const result = (data ?? {}) as { ok?: boolean; error?: string; public_code?: string; defense_type?: string }
      const codeExists = result.ok || !String(result.error ?? '').toLowerCase().includes('not found')
      await recordResearchCodeAttempt(admin, clientHash, researchCode, 'submit', codeExists)

      if (!result.ok) return NextResponse.json({ error: result.error || 'The next defense request could not be created.' }, { status: 409 })
      const { error: designError } = await admin.from('research_groups').update(designUpdate).eq('public_code', researchCode)
      if (designError) console.error('Research design update failed after continuation:', designError.message)
      return NextResponse.json({ researchCode: result.public_code, defenseType: result.defense_type, continued: true }, { status: 201 })
    }

    const { data, error } = await admin.rpc('submit_research_group_v2', {
      p_title: title,
      p_contact_person: contactPerson,
      p_contact_email: contactEmail,
      p_contact_number: contactNumber,
      p_instructor_id: instructorId,
      p_adviser_id: adviserId,
      p_research_file_url: researchFileUrl,
      p_program: program,
      p_major: normalizedMajor,
      p_defense_type: 'title',
      p_members: members,
      p_access_key_hash: null,
    })
    if (error) {
      console.error('Research submission failed:', error.message)
      return NextResponse.json({ error: 'The submission could not be saved. Please try again.' }, { status: 500 })
    }
    const result = (data ?? {}) as { ok?: boolean; public_code?: string; defense_type?: string }
    if (!result.ok || !result.public_code) return NextResponse.json({ error: 'The submission could not be saved. Please try again.' }, { status: 500 })
    const { error: designError } = await admin.from('research_groups').update(designUpdate).eq('public_code', result.public_code)
    if (designError) console.error('Research design update failed after submission:', designError.message)
    return NextResponse.json({ researchCode: result.public_code, defenseType: result.defense_type, continued: false }, { status: 201 })
  } catch (error) {
    console.error('Submission route error:', error)
    return NextResponse.json({ error: 'The submission service is temporarily unavailable.' }, { status: 503 })
  }
}
