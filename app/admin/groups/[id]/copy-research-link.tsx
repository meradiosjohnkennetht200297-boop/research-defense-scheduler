'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function CopyResearchLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const pathname = usePathname()

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
    <>
      <button className="button button-secondary button-small" onClick={copyLink} type="button">
        {copied ? 'Copied ✓' : 'Copy Research Link'}
      </button>
      <Link className="button button-secondary button-small" href={`${pathname}/edit`}>Edit Submission</Link>
      <Link className="button button-secondary button-small" href={`${pathname}/record`}>Record Options</Link>
    </>
  )
}
