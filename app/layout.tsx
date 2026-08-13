import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Research Defense Scheduler',
  description: 'Submit research groups and view published research defense schedules.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
              <Link href="/">Schedule</Link>
              <Link className="button button-small" href="/submit">Submit Research</Link>
              <Link href="/admin">Admin</Link>
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
