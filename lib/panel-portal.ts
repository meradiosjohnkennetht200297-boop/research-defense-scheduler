import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export const PANEL_ACCESS_COOKIE = 'rd_panel_access'
export const PANEL_ACCESS_MAX_AGE = 60 * 60 * 24 * 30

const PANEL_TOKEN_PATTERN = /^pnl_[0-9a-f]{48}$/

export function createPanelAccessToken() {
  return `pnl_${randomBytes(24).toString('hex')}`
}

export function isValidPanelAccessToken(value: unknown): value is string {
  return typeof value === 'string' && PANEL_TOKEN_PATTERN.test(value)
}

export async function panelTokenIsCurrent(admin: SupabaseClient, token: string) {
  if (!isValidPanelAccessToken(token)) return false
  const { data, error } = await admin
    .from('panel_portal_access')
    .select('id')
    .eq('id', 1)
    .eq('access_token', token)
    .maybeSingle()
  if (error) {
    console.error('Panel portal token validation failed:', error.message)
    return false
  }
  return Boolean(data)
}
