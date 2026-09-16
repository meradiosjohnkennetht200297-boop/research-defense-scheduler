import type { Metadata } from 'next'
import SiteShell from './components/site-shell'
import { createClient } from '@/lib/supabase/server'
import './globals.css'
import './enhancements.css'
import './defense-features.css'
import './public-schedule.css'
import './minimal-public-core.css'
import './submit/submission.css'
import './submit/submission-minimal.css'
import './admin/workspace-core.css'
import './admin/workspace-controls.css'
import './admin/ended-workflow.css'
import './mobile-public-nav.css'
import './public-ui.css'

export const metadata: Metadata = {
  title: { default: 'Research Defense Scheduler | Research Office', template: '%s | Research Office' },
  description: 'Submit research, continue defense stages, check research status, and view published defense schedules.',
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  let isAdmin = false

  if (userId) {
    const { data: adminProfile } = await supabase
      .from('admin_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()
    isAdmin = Boolean(adminProfile)
  }

  return (
    <html lang="en">
      <body>
        <SiteShell isAdmin={isAdmin}>{children}</SiteShell>
      </body>
    </html>
  )
}
