'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, CircleAlert, Eye, EyeOff, Loader2 } from 'lucide-react'
import { setSignedInUser, type AppUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { toast } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'

/** Where the link in a "reset your password" email lands: choose a new one, and you're signed in. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  )
}

function ResetPassword() {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const long = password.length >= 8
  const same = confirm === password
  const canSave = long && same && Boolean(email && token)

  const save = async () => {
    if (!canSave || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; user?: AppUser }
      if (res.ok && data.user) {
        setSignedInUser(data.user)
        toast(tr('Your password is updated.'), 'success')
        router.replace('/')
        return
      }
      setError(data.error ? tr(data.error) : tr('Something went wrong. Please try again.'))
    } catch {
      setError(tr('Could not reach the server. Check your connection.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen" role="main">
      <div className="auth-screen__body">
        <form
          className="flex flex-1 flex-col px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))]"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <h1 className="text-[1.85rem] font-bold leading-tight tracking-[-0.025em] text-[var(--auth-text)]">
            {t('Choose a new password')}
          </h1>
          <p className="mt-1.5 text-[0.95rem] leading-snug text-[var(--auth-muted)]">
            {email ? t('For {email}', { email }) : t('This reset link has expired or was already used. Ask for a new one.')}
          </p>

          <div className="mt-8 space-y-5">
            {[
              { label: t('New password'), value: password, set: setPassword, hint: t('At least 8 characters'), bad: false },
              {
                label: t('Confirm password'),
                value: confirm,
                set: setConfirm,
                hint: t('Enter the password again'),
                bad: Boolean(confirm) && !same,
              },
            ].map((f) => (
              <label key={f.label} className="block">
                <span className="mb-2 block text-[0.88rem] font-semibold text-[var(--auth-text)]">{f.label}</span>
                <span className={cn('auth-box', f.bad && 'is-invalid')}>
                  <input
                    value={f.value}
                    onChange={(e) => f.set(e.target.value.slice(0, 128))}
                    placeholder={f.hint}
                    type={shown ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="auth-input2"
                  />
                  {f.label === t('Confirm password') && confirm && same && long ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.8} />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShown((v) => !v)}
                    aria-label={shown ? t('Hide password') : t('Show password')}
                    className="ed-focus -mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--auth-muted)]"
                  >
                    {shown ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </span>
                {f.bad ? (
                  <span className="mt-1.5 block text-[0.78rem] text-[var(--auth-muted)]">{t("Passwords don't match.")}</span>
                ) : null}
              </label>
            ))}
          </div>

          {error ? (
            <p className="auth-alert" role="alert">
              <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.2} />
              <span>{error}</span>
            </p>
          ) : null}

          <button type="submit" disabled={!canSave || busy} className="auth-button mt-7 ed-focus">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t('Save password')}
          </button>
        </form>
      </div>
    </div>
  )
}
