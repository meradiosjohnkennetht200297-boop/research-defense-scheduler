'use client'

import { useEffect, useState } from 'react'
import styles from './panel-access.module.css'

export default function PanelAccessControl({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken)
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setOrigin(window.location.origin), [])

  const link = origin && token ? `${origin}/panel/access/${token}` : ''

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function resetLink() {
    const confirmed = window.confirm('Reset the shared Panel Access link? The old link and existing panel sessions will stop working immediately.')
    if (!confirmed) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/panel-access', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok || !payload.token) throw new Error(payload.error || 'Unable to reset Panel Access.')
      setToken(payload.token)
      setCopied(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset Panel Access.')
    } finally {
      setBusy(false)
    }
  }

  return <div className={styles.control}>
    <div className={styles.linkBox}>
      <span>Shared private link</span>
      <code>{link || 'Preparing link…'}</code>
    </div>
    <div className={styles.actions}>
      <button className="button" disabled={!link || busy} onClick={copyLink} type="button">{copied ? 'Copied' : 'Copy Panel Link'}</button>
      <a className="button button-secondary" href={link || undefined} rel="noopener noreferrer" target="_blank">Open Panel Page ↗</a>
      <button className={`button button-secondary ${styles.reset}`} disabled={busy} onClick={resetLink} type="button">{busy ? 'Resetting…' : 'Reset Link'}</button>
    </div>
    {error ? <div className="alert alert-error">{error}</div> : null}
    <p className={styles.warning}>Reset only if the link was shared outside the intended panel group. Resetting immediately invalidates the previous link.</p>
  </div>
}
