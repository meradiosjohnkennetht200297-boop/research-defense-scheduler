'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const publicLinks = [
  { href: '/schedule', label: 'Schedule' },
  { href: '/submit', label: 'Submit' },
  { href: '/status', label: 'Status' },
]

export default function SiteShell({ children, isAdmin }: { children: React.ReactNode; isAdmin: boolean }) {
  const pathname = usePathname()
  const adminPage = pathname.startsWith('/admin')

  return <div className={adminPage ? 'admin-site' : 'public-site'}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header">
      <div className="container nav-wrap">
        <Link className="brand" href="/" aria-label="Research Office home">
          <span className="brand-mark" aria-hidden="true">RO</span>
          <span><strong>RESEARCH OFFICE</strong>{!adminPage ? <small>Research defense services</small> : null}</span>
        </Link>
        {adminPage ? (isAdmin ? <nav className="nav-links" aria-label="Main navigation">
          <Link href="/schedule">Public Schedule</Link>
          <Link href="/admin/groups">Research Records</Link>
          <Link className="button button-small" href="/admin/dashboard">Admin Workspace</Link>
        </nav> : null) : <nav className="public-nav" aria-label="Public navigation">
          {publicLinks.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
        </nav>}
      </div>
    </header>
    <main id="main-content" tabIndex={-1}>{children}</main>
    <footer className="site-footer"><div className="container footer-wrap">
      <span>Research Office</span>
      {adminPage ? <Link href={isAdmin ? '/admin/dashboard' : '/admin'}>{isAdmin ? 'Admin Workspace' : 'Admin Login'}</Link> : <span>Defense schedules · Philippine time (UTC+8)</span>}
    </div></footer>
  </div>
}
