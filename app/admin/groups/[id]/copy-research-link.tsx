'use client'

import { useState } from 'react'

export default function CopyResearchLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button aria-label="Copy manuscript link" className="button button-secondary button-small" onClick={copyLink} title="Copy manuscript link" type="button">
      {copied ? 'Copied ✓' : 'Copy Link'}
    </button>
  )
}
