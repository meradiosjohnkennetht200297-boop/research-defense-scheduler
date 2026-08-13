'use client'

import { FormEvent, KeyboardEvent, PointerEvent, ReactNode, useRef } from 'react'

export default function SubmissionEnterGuard({ children }: { children: ReactNode }) {
  const explicitFinalSubmit = useRef(false)

  function findContinueButton(form: HTMLFormElement) {
    return Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
      .find((button) => button.textContent?.trim() === 'Continue')
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const button = target.closest('button[type="submit"]') as HTMLButtonElement | null
    explicitFinalSubmit.current = button?.textContent?.trim() === 'Submit Research'
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement

    if ((event.key === 'Enter' || event.key === ' ') && target.tagName === 'BUTTON') {
      const button = target as HTMLButtonElement
      if (button.type === 'submit' && button.textContent?.trim() === 'Submit Research') {
        explicitFinalSubmit.current = true
        return
      }
    }

    if (event.key !== 'Enter' || target.tagName !== 'INPUT') return

    const form = target.closest('form')
    if (!form) return

    const continueButton = findContinueButton(form)
    if (!continueButton) return

    event.preventDefault()
    explicitFinalSubmit.current = false
    continueButton.click()
  }

  function handleSubmitCapture(event: FormEvent<HTMLDivElement>) {
    const form = event.target as HTMLFormElement
    const isReviewStep = form.textContent?.includes('Step 4 of 4') ?? false

    if (!isReviewStep) {
      event.preventDefault()
      event.stopPropagation()
      explicitFinalSubmit.current = false
      findContinueButton(form)?.click()
      return
    }

    if (!explicitFinalSubmit.current) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    explicitFinalSubmit.current = false
  }

  return (
    <div
      onKeyDownCapture={handleKeyDown}
      onPointerDownCapture={handlePointerDown}
      onSubmitCapture={handleSubmitCapture}
    >
      {children}
    </div>
  )
}
