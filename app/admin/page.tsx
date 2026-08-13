import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loginAdmin } from './actions'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (userId) {
    const { data: adminProfile } = await supabase
      .from('admin_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()

    if (adminProfile) redirect('/admin/dashboard')
  }

  return (
    <section className="container">
      <div className="card admin-shell">
        <p className="eyebrow">Administrator</p>
        <h2>Sign in to manage defenses</h2>
        <p className="lead" style={{ fontSize: '0.92rem', marginBottom: 22 }}>
          Only authorized administrator accounts can access research submissions and scheduling tools.
        </p>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <form action={loginAdmin}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="button" style={{ width: '100%' }} type="submit">
            Sign in
          </button>
        </form>
      </div>
    </section>
  )
}
