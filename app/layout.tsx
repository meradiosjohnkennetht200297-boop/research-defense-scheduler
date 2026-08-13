import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import './globals.css'
import './enhancements.css'
import './defense-features.css'
import './public-schedule.css'
import './submit/submission.css'
import './admin/workspace-core.css'
import './admin/workspace-controls.css'

export const metadata: Metadata = {
  title: 'Research Defense Scheduler',
  description: 'Submit research groups and view published research defense schedules.',
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
              <span className="brand-mark">RD</span>
              <span>
                <strong>Research Defense</strong>
                <small>Scheduler</small>
              </span>
            </Link>

            <nav className="nav-links" aria-label="Main navigation">
              {isAdmin ? (
                <>
                  <Link href="/#schedule">Public Schedule</Link>
                  <Link href="/admin/groups">Research Groups</Link>
                  <Link className="button button-small" href="/admin/dashboard">
                    Admin Workspace
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/">Schedule</Link>
                  <Link className="button button-small" href="/submit">Submit Research</Link>
                  <Link href="/admin">Admin</Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <div className="container footer-wrap">
            <span>Research Defense Scheduler</span>
            <span>Mobile and desktop ready</span>
          </div>
        </footer>
      </body>
    </html>
  )
}
