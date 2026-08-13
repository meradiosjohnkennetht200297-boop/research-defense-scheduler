'use client'

import { FormEvent, ReactNode, useRef, useState } from 'react'

export default function SubmissionReviewGate({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const allowNextSubmit = useRef(false)
  const [confirmReady, setConfirmReady] = useState(false)

  function handleSubmitCapture(event: FormEvent<HTMLDivElement>) {
    if (allowNextSubmit.current) {
      allowNextSubmit.current = false
      return
    }

    const form = event.target as HTMLFormElement
    const isReviewStep = form.textContent?.includes('Step 4 of 4') ?? false

    event.preventDefault()
    event.stopPropagation()

    if (!isReviewStep) {
      const continueButton = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
        .find((button) => button.textContent?.trim() === 'Continue')
      continueButton?.click()
      setConfirmReady(false)
      return
    }

    setConfirmReady(true)
    requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLElement>('[data-final-confirmation]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function confirmSubmission() {
    const form = rootRef.current?.querySelector('form')
    if (!form) return
    allowNextSubmit.current = true
    form.requestSubmit()
  }

  return (
    <div ref={rootRef} onSubmitCapture={handleSubmitCapture}>
      {children}
      {confirmReady ? (
        <div className="card submission-final-confirmation" data-final-confirmation aria-live="polite">
          <p className="eyebrow">Final Confirmation</p>
          <h3>Ready to submit?</h3>
          <p>
            Nothing has been submitted yet. Review the details shown above. When everything is correct,
            use the button below to send the research submission.
          </p>
          <div className="submission-final-confirmation-actions">
            <button className="button" type="button" onClick={confirmSubmission}>Confirm Submission</button>
            <button className="button button-secondary" type="button" onClick={() => setConfirmReady(false)}>Keep Reviewing</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
