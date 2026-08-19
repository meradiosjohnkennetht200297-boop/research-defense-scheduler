import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PANEL_ACCESS_COOKIE, PANEL_ACCESS_MAX_AGE, panelTokenIsCurrent } from '@/lib/panel-portal'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const admin = createAdminClient()
  const valid = await panelTokenIsCurrent(admin, token)
  const destination = new URL(valid ? '/panel' : '/panel?invalid=1', request.url)
  const response = NextResponse.redirect(destination)
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  response.headers.set('Cache-Control', 'no-store')

  if (valid) {
    response.cookies.set(PANEL_ACCESS_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/panel',
      maxAge: PANEL_ACCESS_MAX_AGE,
    })
  } else {
    response.cookies.set(PANEL_ACCESS_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/panel',
      maxAge: 0,
    })
  }

  return response
}
