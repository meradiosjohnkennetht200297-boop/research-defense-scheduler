'use client'
import Link from 'next/link'
export default function PublicError({ reset }: { reset: () => void }) {
  return <section className="section"><div className="container"><div className="public-state" role="alert"><h1>This page could not be loaded.</h1><p>Check your connection and try again. If the problem continues, please check back later.</p><button className="button" onClick={reset}>Try again</button> <Link className="button button-secondary" href="/">Return home</Link></div></div></section>
}
