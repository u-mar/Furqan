'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, CalendarCheck, ChevronLeft } from 'lucide-react'
import { ActionButton, ErrorCard, HalaqaScreen, Rise, SectionLabel, Skeleton } from '@/components/halaqa/HalaqaScreen'
import { getSignedInUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { errorFeedback, successFeedback } from '@/lib/haptics'
import { getJoinPreview, joinHalaqa, savedMemberName, type JoinPreview } from '@/lib/halaqa'
import { errorMessage, toastSuccess } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'

const TONES = ['halaqa-avatar--me', 'halaqa-avatar--1', 'halaqa-avatar--2', 'halaqa-avatar--0']

/** Opening an invite link: see the halaqa, type a name, join. Members go straight in. */
export default function JoinHalaqa({ code }: { code: string }) {
  const t = useT()
  const router = useRouter()
  const [preview, setPreview] = useState<JoinPreview | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [shake, setShake] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const data = await getJoinPreview(code)
      if (data.isMember) {
        router.replace(`/halaqa/${data.id}`)
        return
      }
      setPreview(data)
      setError('')
    } catch (err) {
      setError(errorMessage(err, tr('Could not open this invite.')))
    }
  }, [code, router])

  useEffect(() => {
    setName(getSignedInUser()?.name || savedMemberName())
    void load()
  }, [load])

  useEffect(() => {
    if (shake) input.current?.focus()
  }, [shake])

  const join = async () => {
    if (!preview || busy) return
    if (!name.trim()) {
      errorFeedback()
      setJoinError(tr('Add your name so the others know who you are.'))
      setShake((n) => n + 1)
      return
    }
    setBusy(true)
    setJoinError('')
    try {
      const { id } = await joinHalaqa(code, name)
      successFeedback()
      toastSuccess(tr('Welcome to {name}', { name: preview.name }))
      router.replace(`/halaqa/${id}`)
    } catch (err) {
      errorFeedback()
      setJoinError(errorMessage(err, tr('Could not join right now.')))
      setBusy(false)
    }
  }

  return (
    <HalaqaScreen>
      <Link href="/" className="home-round ed-focus" aria-label={t('Home')}>
        <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
      </Link>

      {error ? <ErrorCard message={error} onRetry={load} /> : null}
      {!preview && !error ? <Skeleton className="mt-6 h-[360px] rounded-2xl" /> : null}

      {preview ? (
        <>
          <Rise className="mt-4 flex flex-col items-center text-center">
            <div className="flex items-center">
              {preview.initials.map((letter, i) => (
                <span
                  key={i}
                  className={cn(
                    'halaqa-avatar fx-pop-in h-11 w-11 border-[3px] border-[var(--app-bg)] text-[17px]',
                    TONES[i % TONES.length],
                    i && '-ml-3'
                  )}
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  {letter}
                </span>
              ))}
              {preview.memberCount > preview.initials.length ? (
                <span
                  className="fx-pop-in -ml-3 flex h-11 min-w-11 items-center justify-center rounded-full border-[3px] border-[var(--app-bg)] bg-[var(--home-card-bg)] px-2 text-[13px] font-bold text-[var(--home-muted)] shadow-[var(--home-lift-sm)]"
                  style={{ animationDelay: `${preview.initials.length * 70}ms` }}
                >
                  +{preview.memberCount - preview.initials.length}
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-[0.84375rem] text-[var(--home-muted)]">
              {preview.creatorName ? t('{creatorName} invited you to join', { creatorName: preview.creatorName }) : t('You are invited to join')}
            </p>
            <h1 className="home-serif mt-1 text-[1.8125rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
              {preview.name}
            </h1>
            <p className="mt-1 text-[0.84375rem] text-[var(--home-muted)]">
              {preview.memberCount} {preview.memberCount === 1 ? 'member' : 'members'} · {preview.endDay ? t('For a set time') : t('Every day')}
            </p>
          </Rise>

          <Rise order={1} className="home-card mt-[22px] overflow-hidden rounded-2xl">
            <div className="set-row">
              <span className="set-row__icon" aria-hidden>
                <CalendarCheck className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="set-row__label">{t('Daily check-in')}</span>
              <span className="set-row__value">{preview.readCount} {t('read today')}</span>
            </div>
            {preview.khatmah ? (
              <>
                <div className="set-row__divider" aria-hidden />
                <div className="set-row">
                  <span className="set-row__icon" aria-hidden>
                    <BookOpen className="h-[17px] w-[17px]" strokeWidth={1.9} />
                  </span>
                  <span className="set-row__label">{t('Khatmah together')}</span>
                  <span className="set-row__value">
                    {t('{done} of {total} juz', { done: preview.khatmah.done, total: preview.khatmah.total })}</span>
                </div>
              </>
            ) : null}
          </Rise>

          {preview.full ? (
            <Rise order={2} className="home-card mt-[22px] rounded-2xl px-4 py-4 text-center text-sm text-[var(--home-heading)]">
              {t('This halaqa is full.')}</Rise>
          ) : (
            <Rise order={2}>
              <SectionLabel>{t('Your name')}</SectionLabel>
              <input
                ref={input}
                key={shake}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void join()
                }}
                maxLength={40}
                placeholder={t('How the others will see you')}
                aria-label={t('Your name')}
                aria-invalid={shake > 0 && !name.trim() ? true : undefined}
                className={cn(
                  'block h-[52px] w-full rounded-2xl bg-[var(--home-card-bg)] px-4 text-[0.9375rem] font-medium text-[var(--home-heading)] shadow-[var(--home-lift)] outline-none placeholder:font-normal placeholder:text-[var(--home-muted)] focus:ring-2 focus:ring-[var(--home-sage)]',
                  shake > 0 && 'fx-shake'
                )}
              />
              {joinError ? (
                <p key={joinError + shake} className="qari-enter mt-3 text-center text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
                  {joinError}
                </p>
              ) : null}
              <ActionButton busy={busy} onClick={() => void join()} className="mt-[22px]">
                {busy ? t('Joining…') : t('Join halaqa')}
              </ActionButton>
              <p className="mt-3 text-center text-[0.78125rem] text-[var(--home-muted)]">{t('No account needed.')}</p>
            </Rise>
          )}
        </>
      ) : null}
    </HalaqaScreen>
  )
}
