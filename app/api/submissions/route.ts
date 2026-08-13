import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  if (!cleaned) return null
  return cleaned.slice(0, maxLength)
}

function cleanUuid(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  return UUID_PATTERN.test(value) ? value : null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const title = cleanOptionalText(body.title, 500)
    const contactPerson = cleanOptionalText(body.contactPerson, 150)
    const contactEmail = cleanOptionalText(body.contactEmail, 254)
    const contactNumber = cleanOptionalText(body.contactNumber, 40)
    const instructorId = cleanUuid(body.instructorId)
    const adviserId = cleanUuid(body.adviserId)

    const members = Array.isArray(body.members)
      ? body.members
          .filter((value: unknown): value is string => typeof value === 'string')
          .map((value: string) => value.trim().slice(0, 150))
          .filter(Boolean)
          .slice(0, 20)
      : []

    if (!title || !contactPerson || members.length === 0) {
      return NextResponse.json(
        { error: 'Research title, contact person, and at least one group member are required.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('submit_research_group', {
      p_title: title,
      p_contact_person: contactPerson,
      p_contact_email: contactEmail,
      p_contact_number: contactNumber,
      p_instructor_id: instructorId,
      p_adviser_id: adviserId,
      p_members: members,
    })

    if (error) {
      console.error('Research submission failed:', error.message)
      return NextResponse.json(
        { error: 'The submission could not be saved. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ publicCode: data }, { status: 201 })
  } catch (error) {
    console.error('Submission route error:', error)
    return NextResponse.json(
      { error: 'The submission service is not configured yet.' },
      { status: 503 }
    )
  }
}
