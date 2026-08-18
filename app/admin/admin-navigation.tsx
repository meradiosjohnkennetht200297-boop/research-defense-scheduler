'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAdmin } from './actions'

const navItems = [
  { label: 'Dashboard', shortLabel: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Research Groups', shortLabel: 'Groups', href: '/admin/groups' },
  { label: 'Defense Schedule', shortLabel: 'Schedule', href: '/admin/schedule' },
  { label: 'Faculty', shortLabel: 'Faculty', href: '/admin/faculty' },
]

export default function AdminNavigation({ displayName }: { displayName: string }) {
  const pathname = usePathname()

  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>('.disclosure-card').forEach((details) => {
      details.open = false
    })
  }, [pathname])

  function isActive(item: (typeof navItems)[number]) {
    if (item.href === '/admin/schedule') return pathname.startsWith('/admin/schedule') || pathname.startsWith('/admin/history')
    if (item.href === '/admin/dashboard') return pathname === '/admin/dashboard'
    return pathname.startsWith(item.href)
  }

  return (
    <div className="admin-nav-shell">
      <div className="container admin-nav-wrap">
        <div className="admin-sidebar-brand" aria-label="Research Defense Admin Workspace">
          <span className="admin-sidebar-logo">RD</span>
          <span><strong>Research Defense</strong><small>Admin Workspace</small></span>
        </div>

        <div className="admin-mode-block" aria-label={`Admin mode, signed in as ${displayName}`}>
          <span className="admin-mode-dot" aria-hidden="true" />
          <span><strong>Admin Mode</strong><small>{displayName}</small></span>
        </div>

        <nav className="admin-nav-links" aria-label="Administrator navigation">
          {navItems.map((item) => (
            <Link
              aria-current={isActive(item) ? 'page' : undefined}
              aria-label={item.label}
              className={isActive(item) ? 'admin-nav-link active' : 'admin-nav-link'}
              href={item.href}
              key={item.href}
            >
              <span className="admin-nav-label">{item.label}</span>
              <span aria-hidden="true" className="admin-nav-short-label">{item.shortLabel}</span>
            </Link>
          ))}
          <Link className="admin-nav-link admin-public-link" href="/">Public Site ↗</Link>
        </nav>

        <form action={logoutAdmin} className="admin-signout-form">
          <button className="admin-signout-button" type="submit">Sign out</button>
        </form>
      </div>
    </div>
  )
}
