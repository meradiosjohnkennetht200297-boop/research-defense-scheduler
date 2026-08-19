'use client'

import { useState } from 'react'

export default function StudentAccessKeyControl({ publicCode }: { groupId: string; publicCode: string; hasAccessKey: boolean }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicCode)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return <div className="workspace-access-key"><div><strong>Student Research Code</strong><small>Share this code privately with the research group. It is used to check status and request the next defense.</small></div><div className="workspace-access-key-result"><span>Research Code</span><b>{publicCode}</b><button className="button button-secondary button-small" onClick={copy} type="button">{copied ? 'Copied ✓' : 'Copy Research Code'}</button></div></div>
}
