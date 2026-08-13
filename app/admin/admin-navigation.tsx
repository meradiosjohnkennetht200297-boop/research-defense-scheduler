'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAdmin } from './actions'

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Research Groups', href: '/admin/groups' },
  { label: 'Defense Schedule', href: '/admin/schedule' },
  { label: 'Faculty', href: '/admin/faculty' },
]

export default function AdminNavigation({ displayName }: { displayName: string }) {
  const pathname = usePathname()
  const [hash, setHash] = useState('')

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash)
    updateHash()
    window.addEventListener('hashchange', updateHash)
    return () => window.removeEventListener('hashchange', updateHash)
  }, [pathname])

  function isActive(item: (typeof navItems)[number]) {
    if (item.href === '/admin/schedule') return pathname.startsWith('/admin/schedule') || pathname.startsWith('/admin/history')
    if (item.href === '/admin/dashboard') return pathname === '/admin/dashboard'
    return pathname.startsWith(item.href)
  }

  return (
    <div className="admin-nav-shell">
      <div className="container admin-nav-wrap">
        <div className="admin-mode-block" aria-label={`Admin mode, signed in as ${displayName}`}>
          <span className="admin-mode-dot" aria-hidden="true" />
          <span><strong>Admin Mode</strong><small>{displayName}</small></span>
        </div>

        <nav className="admin-nav-links" aria-label="Administrator navigation">
          {navItems.map((item) => (
            <Link
              aria-current={isActive(item) ? 'page' : undefined}
              className={isActive(item) ? 'admin-nav-link active' : 'admin-nav-link'}
              href={item.href}
              key={item.href}
            >
              {item.label}
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
