'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Check, Send, X } from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import {
  ErrorCard,
  HalaqaHeader,
  HalaqaScreen,
  SectionLabel,
  Skeleton,
  Toast,
  useToast,
} from '@/components/halaqa/HalaqaScreen'
import { IconOrnament } from '@/components/home/TileIcons'
import { APP_NAME } from '@/lib/app-brand'
import { cn } from '@/lib/cn'
import { successFeedback, tapFeedback } from '@/lib/haptics'
import {
  dayGap,
  getHalaqa,
  halaqaAction,
  juzPages,
  localDay,
  shortDay,
  whatsAppLink,
  type HalaqaDetail,
  type KhatmahJuzView,
} from '@/lib/halaqa'

type Pending = { kind: 'give-back' | 'free'; juz: KhatmahJuzView } | null

export default function KhatmahPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<HalaqaDetail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  const { toast, showToast } = useToast()

  const load = useCallback(async () => {
    try {
      setDetail(await getHalaqa(id))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the khatmah.')
    }
  }, [id])

  useEffect(() => {
    void load()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const act = async (action: string, extra: Record<string, unknown>, done?: string) => {
    if (busy) return
    setBusy(true)
    try {
      await halaqaAction(id, action, extra)
      successFeedback()
      if (done) showToast(done)
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not do that right now.')
      await load()
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  if (!detail) {
    return (
      <HalaqaScreen>
        <HalaqaHeader title="Khatmah" backHref={`/halaqa/${id}`} />
        {error ? (
          <ErrorCard message={error} onRetry={() => void load()} />
        ) : (
          <div className="mt-[18px] space-y-3" aria-busy>
            <Skeleton className="h-[110px] rounded-[18px]" />
            <Skeleton className="h-[360px] rounded-2xl" />
          </div>
        )}
      </HalaqaScreen>
    )
  }

  const { halaqa, khatmah, me } = detail

  if (!halaqa.khatmahEnabled || !khatmah) {
    return (
      <HalaqaScreen>
        <HalaqaHeader title="Khatmah" sub={halaqa.name} backHref={`/halaqa/${id}`} />
        <div className="home-card mt-[18px] rounded-2xl px-5 py-6 text-center">
          <p className="text-[0.9375rem] font-semibold text-[var(--home-heading)]">This halaqa is not reading a khatmah</p>
          <p className="mt-1.5 text-sm text-[var(--home-muted)]">
            {me.isCreator ? 'Start one and split the 30 juz between everyone.' : 'The person who made the halaqa can start one.'}
          </p>
          {me.isCreator ? (
            <button
              type="button"
              onClick={() => void act('khatmah', { enabled: true })}
              disabled={busy}
              className="ed-ink ed-focus mx-auto mt-4 flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold disabled:opacity-60"
            >
              Start a khatmah
            </button>
          ) : null}
        </div>
        <Toast message={toast} />
      </HalaqaScreen>
    )
  }

  if (khatmah.completedAt) {
    const days = Math.max(1, dayGap(khatmah.startedAt.slice(0, 10), khatmah.completedAt.slice(0, 10)) + 1)
    const news = `${halaqa.name} finished a khatmah together on ${APP_NAME}, alhamdulillah.`
    return (
      <HalaqaScreen>
        <div className="flex justify-end">
          <Link href={`/halaqa/${id}`} className="home-round ed-focus" aria-label="Close">
            <X className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </Link>
        </div>
        <div className="qari-done mt-9 flex flex-col items-center px-2 text-center">
          <IconOrnament className="h-[30px] w-[30px] text-[var(--home-sage)]" />
          <h1 className="home-serif mt-4 text-[1.9375rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
            Khatmah complete
          </h1>
          <p className="mt-2 text-[0.9375rem] text-[var(--home-muted)]">{halaqa.name} read the whole Quran together.</p>
        </div>

        <div className="home-card mt-6 grid grid-cols-3 rounded-2xl py-3.5">
          {[
            ['30', 'juz read'],
            [String(khatmah.readers), khatmah.readers === 1 ? 'reader' : 'readers'],
            [String(days), days === 1 ? 'day' : 'days'],
          ].map(([value, label], i) => (
            <div key={label} className={cn('text-center', i && 'border-l border-[var(--home-rule)]')}>
              <div className="home-serif text-2xl font-semibold text-[var(--home-heading)]">{value}</div>
              <div className="mt-0.5 text-xs text-[var(--home-muted)]">{label}</div>
            </div>
          ))}
        </div>

        <div className="home-card mt-3 rounded-2xl px-[18px] py-4 text-center">
          <p className="amiri !text-center text-[1.4375rem] leading-[1.9] text-[var(--home-heading)]" dir="rtl" lang="ar">
            رَبَّنَا تَقَبَّلْ مِنَّا ۖ إِنَّكَ أَنتَ السَّمِيعُ الْعَلِيمُ
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--home-heading)] opacity-80 [text-wrap:balance]">
            Our Lord, accept this from us. You are the All-Hearing, the All-Knowing.
          </p>
          <p className="mt-1.5 text-xs font-semibold text-[var(--home-muted)]">Al-Baqarah 2:127</p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          {me.isCreator ? (
            <button
              type="button"
              onClick={() => void act('new-khatmah', {}, 'A new khatmah has started.')}
              disabled={busy}
              className="ed-ink ed-focus flex h-12 items-center justify-center rounded-full text-[0.90625rem] font-semibold disabled:opacity-60"
            >
              Start another khatmah
            </button>
          ) : null}
          <a
            href={whatsAppLink(news)}
            target="_blank"
            rel="noopener noreferrer"
            className="ed-focus flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-[0.90625rem] font-semibold text-[var(--home-heading)] hover:bg-[var(--home-track)]"
          >
            <Send className="h-[17px] w-[17px]" strokeWidth={2} />
            Share the good news
          </a>
        </div>
        <Toast message={toast} />
      </HalaqaScreen>
    )
  }

  const byJuz = new Map(khatmah.juz.map((row) => [row.juz, row]))
  const mine = khatmah.juz.filter((row) => row.mine && !row.done)
  const daysLeft = khatmah.finishBy ? dayGap(localDay(), khatmah.finishBy) : null

  const onCell = (juz: number) => {
    const row = byJuz.get(juz)
    if (!row) {
      tapFeedback()
      void act('take', { juz }, `Juz ${juz} is yours.`)
      return
    }
    if (row.done) return
    if (row.mine) setPending({ kind: 'give-back', juz: row })
    else if (me.isCreator) setPending({ kind: 'free', juz: row })
  }

  return (
    <HalaqaScreen>
      <HalaqaHeader title="Khatmah" sub={halaqa.name} backHref={`/halaqa/${id}`} />

      <section className="home-card mt-[18px] rounded-[18px] p-4" aria-label="Progress">
        <div className="flex items-baseline gap-2">
          <span className="home-serif text-[2.125rem] font-semibold leading-none tracking-[-0.02em] text-[var(--home-heading)]">
            {khatmah.done}
          </span>
          <span className="text-sm text-[var(--home-muted)]">of 30 juz done</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--home-track)]">
          <div className="h-full rounded-full bg-[var(--home-sage)]" style={{ width: `${Math.round((khatmah.done / 30) * 100)}%` }} />
        </div>
        {khatmah.finishBy ? (
          <div className="mt-2.5 flex justify-between text-[0.78125rem] text-[var(--home-muted)]">
            <span>Finish by {shortDay(khatmah.finishBy)}</span>
            <span>
              {daysLeft === null
                ? ''
                : daysLeft > 1
                  ? `${daysLeft} days left`
                  : daysLeft === 1
                    ? '1 day left'
                    : daysLeft === 0
                      ? 'Last day'
                      : 'Past the date'}
            </span>
          </div>
        ) : null}
      </section>

      {mine.length ? (
        <>
          <SectionLabel>{mine.length === 1 ? 'Your juz' : 'Your juz · ' + mine.length}</SectionLabel>
          <div className="space-y-2.5">
            {mine.map((row) => {
              const pages = juzPages(row.juz)
              return (
                <div key={row.juz} className="home-card rounded-2xl px-3.5 pb-3.5 pt-3">
                  <div className="flex items-center gap-3">
                    <span className="home-serif flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--home-ink)] text-lg font-semibold text-[var(--home-ink-fg)]">
                      {row.juz}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-semibold text-[var(--home-heading)]">Juz {row.juz}</span>
                      <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">
                        Pages {pages.start} to {pages.end}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3.5 grid grid-cols-2 gap-2">
                    <Link
                      href={`/read?page=${pages.start}`}
                      className="ed-ink ed-focus flex h-11 items-center justify-center rounded-full text-sm font-semibold"
                    >
                      Start reading
                    </Link>
                    <button
                      type="button"
                      onClick={() => void act('done', { juz: row.juz }, `Juz ${row.juz} is done.`)}
                      disabled={busy}
                      className="ed-focus flex h-11 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] disabled:opacity-60"
                    >
                      Mark done
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : null}

      <SectionLabel>All 30 juz</SectionLabel>
      <div className="flex flex-wrap gap-3.5 px-1 pb-3">
        {[
          ['halaqa-juz--done', 'Done'],
          ['halaqa-juz--taken', 'Taken'],
          ['halaqa-juz--free', 'Free'],
          ['halaqa-juz--mine', 'Yours'],
        ].map(([swatch, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-xs text-[var(--home-muted)]">
            <span className={cn('h-3 w-3 rounded', swatch)} aria-hidden />
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 30 }, (_, i) => {
          const juz = i + 1
          const row = byJuz.get(juz)
          const state = !row ? 'free' : row.done ? 'done' : row.mine ? 'mine' : 'taken'
          const label = !row
            ? `Juz ${juz}, free — take it`
            : row.done
              ? `Juz ${juz}, done`
              : row.mine
                ? `Juz ${juz}, yours`
                : `Juz ${juz}, taken by ${row.memberName ?? 'someone'}`
          return (
            <button
              key={juz}
              type="button"
              onClick={() => onCell(juz)}
              disabled={busy || state === 'done' || (state === 'taken' && !me.isCreator)}
              aria-label={label}
              className={cn('halaqa-juz ed-focus disabled:cursor-default', `halaqa-juz--${state}`)}
            >
              <span className="home-serif text-[1.0625rem] font-semibold leading-none">{juz}</span>
              {state === 'done' ? (
                <Check className="h-[13px] w-[13px] opacity-85" strokeWidth={3} />
              ) : (
                <span
                  className={cn(
                    'block truncate text-[0.6875rem] font-semibold',
                    state === 'free' && 'text-[var(--home-sage-deep)]',
                    state === 'taken' && 'text-[var(--home-muted)]',
                    state === 'mine' && 'opacity-75'
                  )}
                >
                  {state === 'free' ? 'Take' : state === 'mine' ? 'You' : row?.memberName ?? '—'}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-3.5 text-center text-[0.78125rem] text-[var(--home-muted)]">
        {me.isCreator ? 'Tap a juz you took to give it back, or anyone’s to free it.' : 'Tap a juz you took to give it back.'}
      </p>

      <SettingsSheet
        open={Boolean(pending)}
        title={pending ? (pending.kind === 'give-back' ? `Give back Juz ${pending.juz.juz}?` : `Free Juz ${pending.juz.juz}?`) : ''}
        description={
          pending
            ? pending.kind === 'give-back'
              ? 'Someone else will be able to take it.'
              : `${pending.juz.memberName ?? 'Someone'} took it. Freeing it lets someone else take it.`
            : undefined
        }
        onClose={() => setPending(null)}
      >
        <button
          type="button"
          onClick={() => pending && void act(pending.kind, { juz: pending.juz.juz }, `Juz ${pending.juz.juz} is free again.`)}
          disabled={busy}
          className="ed-ink ed-focus flex h-12 w-full items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold disabled:opacity-60"
        >
          <BookOpen className="h-[17px] w-[17px]" strokeWidth={2} />
          {pending?.kind === 'give-back' ? 'Give it back' : 'Free this juz'}
        </button>
      </SettingsSheet>
      <Toast message={toast} />
    </HalaqaScreen>
  )
}
