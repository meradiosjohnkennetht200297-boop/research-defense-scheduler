'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAdmin } from './actions'

const navItems = [
  { label: 'Dashboard', shortLabel: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Research Records', shortLabel: 'Records', href: '/admin/groups' },
  { label: 'Defense Schedule', shortLabel: 'Schedule', href: '/admin/schedule' },
  { label: 'Faculty', shortLabel: 'Faculty', href: '/admin/faculty' },
]

const SIDEBAR_KEY = 'rd-admin-sidebar-collapsed'

export default function AdminNavigation({ displayName }: { displayName: string }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>('.disclosure-card').forEach((details) => {
      details.open = false
    })
  }, [pathname])

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_KEY)
    const focusedWorkspace = /^\/admin\/groups\/[^/]+$/.test(pathname)
    setCollapsed(saved === null ? focusedWorkspace : saved === 'true')
  }, [pathname])

  useEffect(() => {
    document.documentElement.classList.toggle('admin-sidebar-collapsed', collapsed)
    return () => document.documentElement.classList.remove('admin-sidebar-collapsed')
  }, [collapsed])

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_KEY, String(next))
      return next
    })
  }

  function isActive(item: (typeof navItems)[number]) {
    if (item.href === '/admin/schedule') return pathname.startsWith('/admin/schedule') || pathname.startsWith('/admin/history')
    if (item.href === '/admin/dashboard') return pathname === '/admin/dashboard'
    if (item.href === '/admin/groups') return pathname.startsWith('/admin/groups')
    return pathname.startsWith(item.href)
  }

  return (
    <>
      <button
        aria-label={collapsed ? 'Open admin navigation' : 'Hide admin navigation'}
        aria-expanded={!collapsed}
        className="admin-sidebar-toggle"
        onClick={toggleSidebar}
        type="button"
      >
        <span aria-hidden="true">{collapsed ? '☰' : '←'}</span>
      </button>

      <div className="admin-nav-shell">
        <div className="container admin-nav-wrap">
          <div className="admin-sidebar-brand" aria-label="Research Office Admin Workspace">
            <span className="admin-sidebar-logo">RO</span>
            <span><strong>RESEARCH OFFICE</strong><small>Admin Workspace</small></span>
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
    </>
  )
}
