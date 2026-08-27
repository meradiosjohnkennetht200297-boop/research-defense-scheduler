import type { Metadata } from 'next'
import Link from 'next/link'
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

export const metadata: Metadata = {
  title: 'Research Office',
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
        <header className="site-header">
          <div className="container nav-wrap">
            <Link className="brand" href="/">
              <span className="brand-mark">RO</span>
              <span><strong>RESEARCH OFFICE</strong><small>Defense Scheduler</small></span>
            </Link>
            <nav className="nav-links" aria-label="Main navigation">
              {isAdmin ? (
                <>
                  <Link href="/schedule">Public Schedule</Link>
                  <Link href="/admin/groups">Research Records</Link>
                  <Link className="button button-small" href="/admin/dashboard">Admin Workspace</Link>
                </>
              ) : (
                <>
                  <Link href="/status">Check Status</Link>
                  <Link className="button button-small" href="/submit">Submit Research</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="container footer-wrap">
            <span>RESEARCH OFFICE</span>
            {isAdmin ? <Link href="/admin/dashboard">Admin Workspace</Link> : <Link href="/admin">Admin Login</Link>}
          </div>
        </footer>
      </body>
    </html>
  )
}
