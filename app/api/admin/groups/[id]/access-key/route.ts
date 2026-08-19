import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Access Keys are no longer used. Share the private Research Code instead.' }, { status: 410 })
}
