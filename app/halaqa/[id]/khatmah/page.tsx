'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Check, Send, X } from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import {
  ActionButton,
  ErrorCard,
  HalaqaHeader,
  HalaqaScreen,
  Rise,
  SectionLabel,
  Skeleton,
} from '@/components/halaqa/HalaqaScreen'
import { IconOrnament } from '@/components/home/TileIcons'
import { useCountUp } from '@/hooks/useCountUp'
import { APP_NAME } from '@/lib/app-brand'
import { cn } from '@/lib/cn'
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import {
  dayGap,
  getHalaqa,
  peekHalaqa,
  halaqaAction,
  juzPages,
  localDay,
  shortDay,
  whatsAppLink,
  type HalaqaDetail,
  type KhatmahJuzView,
} from '@/lib/halaqa'
import { errorMessage, toastError, toastSuccess } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'

type Pending = { kind: 'give-back' | 'free'; juz: KhatmahJuzView } | null
type JuzAction = 'take' | 'done' | 'give-back' | 'free'

/** The khatmah as it will be once this change is saved, shown before the server answers. */
function applied(detail: HalaqaDetail, action: JuzAction, juz: number): HalaqaDetail {
  const khatmah = detail.khatmah
  if (!khatmah) return detail
  const me = detail.members.find((m) => m.isMe)
  let rows = khatmah.juz
  if (action === 'take') {
    rows = [...rows, { juz, done: false, memberId: detail.me.id, memberName: me?.name ?? null, mine: true }]
  } else if (action === 'done') {
    rows = rows.map((row) => (row.juz === juz ? { ...row, done: true } : row))
  } else {
    rows = rows.filter((row) => row.juz !== juz)
  }
  const done = rows.filter((row) => row.done).length
  return {
    ...detail,
    khatmah: {
      ...khatmah,
      juz: rows,
      done,
      completedAt: done >= 30 ? khatmah.completedAt ?? new Date().toISOString() : null,
    },
  }
}

export default function KhatmahPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<HalaqaDetail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  /** Juz changed on this screen a moment ago, so their cells animate. */
  const [changed, setChanged] = useState<Set<number>>(() => new Set())
  const latest = useRef<HalaqaDetail | null>(null)
  latest.current = detail
  /** Loads can finish out of order (coming back to the app starts one); only the newest counts. */
  const loads = useRef(0)

  const load = useCallback(async () => {
    const mine = ++loads.current
    try {
      const next = await getHalaqa(id)
      if (mine !== loads.current) return
      setDetail(next)
      setError('')
    } catch (err) {
      if (mine === loads.current) setError(errorMessage(err, tr('Could not load the khatmah.')))
    }
  }, [id])

  useEffect(() => {
    const cached = peekHalaqa(id)
    if (cached) setDetail(cached)
    void load()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load, id])

  /** Taking, finishing and giving back show at once; the server confirms behind. */
  const change = async (action: JuzAction, juz: number, done: string) => {
    const before = latest.current
    if (!before) return
    loads.current++
    setChanged((set) => new Set(set).add(juz))
    setDetail(applied(before, action, juz))
    setPending(null)
    if (action === 'take' || action === 'done') successFeedback()
    else tapFeedback()
    try {
      await halaqaAction(id, action, { juz })
      toastSuccess(done)
      void load()
    } catch (err) {
      setDetail(before)
      errorFeedback()
      toastError(errorMessage(err, tr('Could not do that right now.')))
      void load()
    }
  }

  const act = async (action: string, extra: Record<string, unknown>, done: string) => {
    if (busy) return
    setBusy(true)
    try {
      await halaqaAction(id, action, extra)
      successFeedback()
      toastSuccess(done)
      await load()
    } catch (err) {
      errorFeedback()
      toastError(errorMessage(err, tr('Could not do that right now.')))
    } finally {
      setBusy(false)
    }
  }

  if (!detail) {
    return (
      <HalaqaScreen>
        <HalaqaHeader title={t('Khatmah')} backHref={`/halaqa/${id}`} />
        {error ? (
          <ErrorCard message={error} onRetry={load} />
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
        <HalaqaHeader title={t('Khatmah')} sub={halaqa.name} backHref={`/halaqa/${id}`} />
        <Rise className="home-card mt-[18px] rounded-2xl px-5 py-6 text-center">
          <p className="text-[0.9375rem] font-semibold text-[var(--home-heading)]">{t('This halaqa is not reading a khatmah')}</p>
          <p className="mt-1.5 text-sm text-[var(--home-muted)]">
            {me.isCreator ? t('Start one and split the 30 juz between everyone.') : t('The person who made the halaqa can start one.')}
          </p>
          {me.isCreator ? (
            <ActionButton
              busy={busy}
              onClick={() => void act('khatmah', { enabled: true }, tr('The khatmah has started'))}
              className="mx-auto mt-4 h-11 w-auto px-6 text-sm"
            >
              {t('Start a khatmah')}</ActionButton>
          ) : null}
        </Rise>
      </HalaqaScreen>
    )
  }

  if (khatmah.completedAt) {
    return <Complete detail={detail} busy={busy} onStartAnother={() => void act('new-khatmah', {}, tr('A new khatmah has started'))} />
  }

  const byJuz = new Map(khatmah.juz.map((row) => [row.juz, row]))
  const mine = khatmah.juz.filter((row) => row.mine && !row.done)
  const daysLeft = khatmah.finishBy ? dayGap(localDay(), khatmah.finishBy) : null

  const onCell = (juz: number) => {
    const row = byJuz.get(juz)
    if (!row) {
      void change('take', juz, tr('Juz {juz} is yours', { juz }))
      return
    }
    if (row.done) return
    tapFeedback()
    if (row.mine) setPending({ kind: 'give-back', juz: row })
    else if (me.isCreator) setPending({ kind: 'free', juz: row })
  }

  return (
    <HalaqaScreen>
      <HalaqaHeader title={t('Khatmah')} sub={halaqa.name} backHref={`/halaqa/${id}`} />

      <Rise className="home-card mt-[18px] rounded-[18px] p-4">
        <section aria-label={t('Progress')}>
          <div className="flex items-baseline gap-2">
            <Count value={khatmah.done} className="home-serif text-[2.125rem] font-semibold leading-none tracking-[-0.02em] text-[var(--home-heading)]" />
            <span className="text-sm text-[var(--home-muted)]">{t('of 30 juz done')}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--home-track)]">
            <div className="fx-bar h-full rounded-full bg-[var(--home-sage)]" style={{ width: `${Math.round((khatmah.done / 30) * 100)}%` }} />
          </div>
          {khatmah.finishBy ? (
            <div className="mt-2.5 flex justify-between text-[0.78125rem] text-[var(--home-muted)]">
              <span>{t('Finish by')} {shortDay(khatmah.finishBy)}</span>
              <span>
                {daysLeft === null
                  ? ''
                  : daysLeft > 1
                    ? t('{daysLeft} days left', { daysLeft })
                    : daysLeft === 1
                      ? t('1 day left')
                      : daysLeft === 0
                        ? t('Last day')
                        : t('Past the date')}
              </span>
            </div>
          ) : null}
        </section>
      </Rise>

      {mine.length ? (
        <>
          <SectionLabel>{mine.length === 1 ? t('Your juz') : t('Your juz · ') + mine.length}</SectionLabel>
          <div className="space-y-2.5">
            {mine.map((row) => {
              const pages = juzPages(row.juz)
              return (
                <div key={row.juz} className={cn('home-card rounded-2xl px-3.5 pb-3.5 pt-3', changed.has(row.juz) && 'qari-enter')}>
                  <div className="flex items-center gap-3">
                    <span className="home-serif flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--home-ink)] text-lg font-semibold text-[var(--home-ink-fg)]">
                      {row.juz}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-semibold text-[var(--home-heading)]">{t('Juz')} {row.juz}</span>
                      <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">
                        {t('Pages')} {pages.start} {t('to')} {pages.end}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3.5 grid grid-cols-2 gap-2">
                    <Link
                      href={`/read?page=${pages.start}`}
                      className="ed-ink ed-focus fx-press flex h-11 items-center justify-center rounded-full text-sm font-semibold"
                    >
                      {t('Start reading')}</Link>
                    <button
                      type="button"
                      onClick={() => void change('done', row.juz, tr('Juz {juz} is done', { juz: row.juz }))}
                      className="ed-focus fx-press flex h-11 items-center justify-center gap-1.5 rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)]"
                    >
                      <Check className="h-4 w-4" strokeWidth={2.4} />
                      {t('Mark done')}</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : null}

      <Rise order={1}>
        <SectionLabel>{t('All 30 juz')}</SectionLabel>
        <div className="flex flex-wrap gap-3.5 px-1 pb-3">
          {[
            ['halaqa-juz--done', t('Done')],
            ['halaqa-juz--taken', t('Taken')],
            ['halaqa-juz--free', t('Free')],
            ['halaqa-juz--mine', t('Yours')],
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
              ? tr('Juz {juz}, free — take it', { juz })
              : row.done
                ? tr('Juz {juz}, done', { juz })
                : row.mine
                  ? tr('Juz {juz}, yours', { juz })
                  : tr('Juz {juz}, taken by {someone}', { juz, someone: row.memberName ?? 'someone' })
            const moved = changed.has(juz)
            return (
              <button
                key={juz}
                type="button"
                onClick={() => onCell(juz)}
                disabled={state === 'done' || (state === 'taken' && !me.isCreator)}
                aria-label={label}
                className={cn('halaqa-juz ed-focus disabled:cursor-default', `halaqa-juz--${state}`)}
              >
                <span key={moved ? `${juz}-${state}` : juz} className={cn('flex h-full flex-col justify-between', moved && 'fx-pop-in')}>
                  <span className="home-serif text-[1.0625rem] font-semibold leading-none">{juz}</span>
                  {state === 'done' ? (
                    <Check className={cn('h-[13px] w-[13px] opacity-85', moved && 'fx-draw')} strokeWidth={3} />
                  ) : (
                    <span
                      className={cn(
                        'block truncate text-[0.6875rem] font-semibold',
                        state === 'free' && 'text-[var(--home-sage-deep)]',
                        state === 'taken' && 'text-[var(--home-muted)]',
                        state === 'mine' && 'opacity-75'
                      )}
                    >
                      {state === 'free' ? t('Take') : state === 'mine' ? t('You') : row?.memberName ?? '—'}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-3.5 text-center text-[0.78125rem] text-[var(--home-muted)]">
          {me.isCreator ? t('Tap a juz you took to give it back, or anyone’s to free it.') : t('Tap a juz you took to give it back.')}
        </p>
      </Rise>

      <SettingsSheet
        open={Boolean(pending)}
        title={pending ? (pending.kind === 'give-back' ? t('Give back Juz {juz}?', { juz: pending.juz.juz }) : t('Free Juz {juz}?', { juz: pending.juz.juz })) : ''}
        description={
          pending
            ? pending.kind === 'give-back'
              ? t('Someone else will be able to take it.')
              : t('{Someone} took it. Freeing it lets someone else take it.', { Someone: pending.juz.memberName ?? 'Someone' })
            : undefined
        }
        onClose={() => setPending(null)}
      >
        <ActionButton
          icon={BookOpen}
          onClick={() => pending && void change(pending.kind, pending.juz.juz, tr('Juz {juz} is free again', { juz: pending.juz.juz }))}
        >
          {pending?.kind === 'give-back' ? t('Give it back') : t('Free this juz')}
        </ActionButton>
      </SettingsSheet>
    </HalaqaScreen>
  )
}

function Count({ value, className }: { value: number; className?: string }) {
  const shown = useCountUp(value)
  return <span className={cn('tabular-nums', className)}>{shown}</span>
}

/** All 30 juz done: a quiet moment, what it took, and the dua. */
function Complete({ detail, busy, onStartAnother }: { detail: HalaqaDetail; busy: boolean; onStartAnother: () => void }) {
  const t = useT()
  const { halaqa, khatmah, me } = detail
  if (!khatmah?.completedAt) return null
  const days = Math.max(1, dayGap(khatmah.startedAt.slice(0, 10), khatmah.completedAt.slice(0, 10)) + 1)
  const news = `${halaqa.name} finished a khatmah together on ${APP_NAME}, alhamdulillah.`

  return (
    <HalaqaScreen>
      <div className="flex justify-end">
        <Link href={`/halaqa/${halaqa.id}`} className="home-round ed-focus" aria-label={t('Close')}>
          <X className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </Link>
      </div>
      <div className="mt-9 flex flex-col items-center px-2 text-center">
        <span className="fx-glow qari-done flex h-[30px] w-[30px] items-center justify-center">
          <IconOrnament className="h-[30px] w-[30px] text-[var(--home-sage)]" />
        </span>
        <h1 className="home-serif fx-rise mt-4 text-[1.9375rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]" style={{ ['--i' as string]: 2 }}>
          {t('Khatmah complete')}</h1>
        <p className="fx-rise mt-2 text-[0.9375rem] text-[var(--home-muted)]" style={{ ['--i' as string]: 3 }}>
          {halaqa.name} {t('read the whole Quran together.')}</p>
      </div>

      <Rise order={4} className="home-card mt-6 grid grid-cols-3 rounded-2xl py-3.5">
        {[
          [30, 'juz read'],
          [khatmah.readers, khatmah.readers === 1 ? 'reader' : 'readers'],
          [days, days === 1 ? 'day' : 'days'],
        ].map(([value, label], i) => (
          <div key={String(label)} className={cn('text-center', i && 'border-l border-[var(--home-rule)]')}>
            <StatNumber value={Number(value)} />
            <div className="mt-0.5 text-xs text-[var(--home-muted)]">{label}</div>
          </div>
        ))}
      </Rise>

      <Rise order={5} className="home-card mt-3 rounded-2xl px-[18px] py-4 text-center">
        <p className="amiri !text-center text-[1.4375rem] leading-[1.9] text-[var(--home-heading)]" dir="rtl" lang="ar">
          رَبَّنَا تَقَبَّلْ مِنَّا ۖ إِنَّكَ أَنتَ السَّمِيعُ الْعَلِيمُ
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--home-heading)] opacity-80 [text-wrap:balance]">
          {t('Our Lord, accept this from us. You are the All-Hearing, the All-Knowing.')}</p>
        <p className="mt-1.5 text-xs font-semibold text-[var(--home-muted)]">{t('Al-Baqarah 2:127')}</p>
      </Rise>

      <Rise order={6} className="mt-6 flex flex-col gap-2.5">
        {me.isCreator ? (
          <ActionButton busy={busy} onClick={onStartAnother}>
            {t('Start another khatmah')}</ActionButton>
        ) : null}
        <a
          href={whatsAppLink(news)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => tapFeedback()}
          className="ed-focus fx-press flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-[0.90625rem] font-semibold text-[var(--home-heading)] hover:bg-[var(--home-track)]"
        >
          <Send className="h-[17px] w-[17px]" strokeWidth={2} />
          {t('Share the good news')}</a>
      </Rise>
    </HalaqaScreen>
  )
}

/** Counts up from zero the first time it shows. */
function StatNumber({ value }: { value: number }) {
  const [target, setTarget] = useState(0)
  useEffect(() => {
    const id = window.setTimeout(() => setTarget(value), 350)
    return () => window.clearTimeout(id)
  }, [value])
  const shown = useCountUp(target, 900)
  return <div className="home-serif text-2xl font-semibold tabular-nums text-[var(--home-heading)]">{shown}</div>
}
