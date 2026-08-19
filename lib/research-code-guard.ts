import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ResearchCodeContext = 'status' | 'continue' | 'submit'

type HeaderReader = { get(name: string): string | null }

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILED_ATTEMPTS = 8

export function researchCodeClientHash(headers: HeaderReader) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || headers.get('x-real-ip') || 'unknown'
  const agent = headers.get('user-agent') || 'unknown'
  return createHash('sha256').update(`${ip}|${agent}`, 'utf8').digest('hex')
}

export function researchCodeDigest(code: string) {
  return createHash('sha256').update(code, 'utf8').digest('hex')
}

export async function researchCodeRateLimited(admin: SupabaseClient, clientHash: string) {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString()
  const { count, error } = await admin
    .from('research_code_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('client_hash', clientHash)
    .eq('was_success', false)
    .gte('attempted_at', since)

  if (error) throw new Error(`Research Code rate-limit lookup failed: ${error.message}`)
  return (count ?? 0) >= MAX_FAILED_ATTEMPTS
}

export async function recordResearchCodeAttempt(
  admin: SupabaseClient,
  clientHash: string,
  code: string,
  context: ResearchCodeContext,
  success: boolean,
) {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString()

  if (success) {
    const { error: clearError } = await admin
      .from('research_code_attempts')
      .delete()
      .eq('client_hash', clientHash)
      .eq('was_success', false)
      .gte('attempted_at', since)
    if (clearError) throw new Error(`Research Code attempt reset failed: ${clearError.message}`)
  }

  const { error } = await admin.from('research_code_attempts').insert({
    client_hash: clientHash,
    code_hash: code ? researchCodeDigest(code) : null,
    context,
    was_success: success,
  })
  if (error) throw new Error(`Research Code attempt log failed: ${error.message}`)
}
