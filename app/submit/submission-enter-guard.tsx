'use client'

import { KeyboardEvent, ReactNode } from 'react'

export default function SubmissionEnterGuard({ children }: { children: ReactNode }) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter') return
    const target = event.target as HTMLElement
    if (target.tagName !== 'INPUT') return

    const form = target.closest('form')
    if (!form) return

    const continueButton = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
      .find((button) => button.textContent?.trim() === 'Continue')

    if (!continueButton) return
    event.preventDefault()
    continueButton.click()
  }

  return <div onKeyDownCapture={handleKeyDown}>{children}</div>
}
