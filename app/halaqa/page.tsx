'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, CalendarCheck, Check, ChevronRight, Link2, Plus } from 'lucide-react'
import { IconHalaqa } from '@/components/home/TileIcons'
import { ErrorCard, HalaqaHeader, HalaqaScreen, Rise, SectionLabel, Skeleton } from '@/components/halaqa/HalaqaScreen'
import { cn } from '@/lib/cn'
import { errorFeedback, successFeedback } from '@/lib/haptics'
import { listHalaqas, markReadToday, scheduleLabel, type HalaqaListItem } from '@/lib/halaqa'
import { errorMessage, toastError } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'

type Data = { readToday: boolean; halaqas: HalaqaListItem[] }

export default function HalaqaHomePage() {
  const t = useT()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [justRead, setJustRead] = useState(false)
  /** Loads can finish out of order (coming back to the app starts one); only the newest counts. */
  const loads = useRef(0)

  const load = useCallback(async () => {
    const mine = ++loads.current
    try {
      const next = await listHalaqas()
      if (mine !== loads.current) return
      setData(next)
      setError('')
    } catch (err) {
      if (mine === loads.current) setError(errorMessage(err, tr('Could not load your halaqas.')))
    }
  }, [])

  useEffect(() => {
    void load()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  // Counted at once in every halaqa; put back if the server says no.
  const tick = async () => {
    if (!data || data.readToday) return
    const before = data
    loads.current++
    successFeedback()
    setJustRead(true)
    setData({
      readToday: true,
      halaqas: data.halaqas.map((h) => ({ ...h, readCount: Math.min(h.memberCount, h.readCount + 1) })),
    })
    try {
      await markReadToday('manual')
      void load()
    } catch (err) {
      setData(before)
      setJustRead(false)
      errorFeedback()
      toastError(errorMessage(err, tr('Could not save that. Try again.')))
    }
  }

  return (
    <HalaqaScreen>
      <HalaqaHeader title={t('Halaqa')} backHref="/" />

      {error && !data ? <ErrorCard message={error} onRetry={load} /> : null}

      {!data && !error ? (
        <div className="mt-[18px] space-y-3" aria-busy>
          <Skeleton className="h-[68px] rounded-2xl" />
          <Skeleton className="h-[220px] rounded-2xl" />
        </div>
      ) : null}

      {data && data.halaqas.length === 0 ? <FirstVisit /> : null}

      {data && data.halaqas.length > 0 ? (
        <>
          <Rise>
            <SectionLabel>{t('Today')}</SectionLabel>
            <div className="home-card flex items-center gap-3 rounded-2xl py-3 pl-3.5 pr-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-semibold text-[var(--home-heading)]">
                  {data.readToday ? t('You read today') : t('Have you read today?')}
                </p>
                <p className="mt-0.5 text-[0.78125rem] text-[var(--home-muted)]">{t('Counts in all your halaqas')}</p>
              </div>
              {data.readToday ? (
                <span
                  className={cn(
                    'flex h-[38px] shrink-0 items-center gap-1.5 rounded-full bg-[var(--home-sage-soft)] pl-3 pr-3.5 text-[0.84375rem] font-semibold text-[var(--home-sage-deep)]',
                    justRead && 'fx-pop-in fx-ring'
                  )}
                  role="status"
                >
                  <Check className={cn('h-[15px] w-[15px]', justRead && 'fx-draw')} strokeWidth={2.6} />
                  {t('Done')}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void tick()}
                  className="ed-ink ed-focus fx-press flex h-[38px] shrink-0 items-center gap-1.5 rounded-full pl-3 pr-3.5 text-[0.84375rem] font-semibold"
                >
                  <Check className="h-[15px] w-[15px]" strokeWidth={2.6} />{t('I read')}</button>
              )}
            </div>
          </Rise>

          <Rise order={1}>
            <SectionLabel>{t('Your halaqas')}</SectionLabel>
            <div className="home-card overflow-hidden rounded-2xl">
              {data.halaqas.map((h, i) => (
                <div key={h.id}>
                  {i ? <div className="set-row__divider" style={{ marginLeft: 66 }} aria-hidden /> : null}
                  <Link href={`/halaqa/${h.id}`} className="set-row" style={{ minHeight: 76, paddingBlock: 12 }}>
                    <span className="home-serif flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--home-sage-soft)] text-lg font-semibold text-[var(--home-sage-deep)]">
                      {(h.name.trim().charAt(0) || 'H').toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">{h.name}</span>
                        <span className="shrink-0 text-[0.78125rem] font-semibold tabular-nums text-[var(--home-heading)]">
                          {h.readCount}/{h.memberCount} <span className="font-medium text-[var(--home-muted)]">{t('read')}</span>
                        </span>
                      </span>
                      <span className="mt-[7px] block h-[3px] overflow-hidden rounded-full bg-[var(--home-track)]">
                        <span
                          className="fx-bar block h-full rounded-full bg-[var(--home-sage)]"
                          style={{ width: `${h.memberCount ? Math.round((h.readCount / h.memberCount) * 100) : 0}%` }}
                        />
                      </span>
                      <span className="mt-1.5 block truncate text-[0.78125rem] text-[var(--home-muted)]">
                        {scheduleLabel(h)}
                        {h.khatmah
                          ? h.khatmah.completed
                            ? t(' · Khatmah complete')
                            : t(' · Khatmah {done} of {total} juz', { done: h.khatmah.done, total: h.khatmah.total })
                          : ''}
                      </span>
                    </span>
                    <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
                  </Link>
                </div>
              ))}
            </div>
          </Rise>

          <Rise order={2}>
            <Link
              href="/halaqa/new"
              className="ed-ink ed-focus fx-press mt-6 flex h-12 items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold"
            >
              <Plus className="h-[17px] w-[17px]" strokeWidth={2.1} />
              {t('Start a halaqa')}</Link>
            <p className="mt-3 text-center text-[0.78125rem] text-[var(--home-muted)]">{t('Got an invite? Just open the link.')}</p>
          </Rise>
        </>
      ) : null}
    </HalaqaScreen>
  )
}

function FirstVisit() {
  const t = useT()
  return (
    <>
      <Rise className="mt-11 flex flex-col items-center px-3 text-center">
        <span className="fx-pop-in flex h-[104px] w-[104px] items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
          <IconHalaqa className="h-[58px] w-[58px]" />
        </span>
        <h2 className="home-serif mt-[22px] text-[1.5625rem] font-semibold tracking-[-0.02em] text-[var(--home-heading)]">
          {t('Read the Quran together')}</h2>
        <p className="mt-2 max-w-[300px] text-[0.90625rem] leading-relaxed text-[var(--home-muted)] [text-wrap:pretty]">
          {t('Make a halaqa with family or friends. Every day, everyone ticks off their reading, and you can finish a khatmah together.')}</p>
      </Rise>

      <Rise order={1} className="home-card mt-7 overflow-hidden rounded-2xl">
        {[
          { Icon: CalendarCheck, title: t('Daily check-in'), hint: t('See who has read today') },
          { Icon: Link2, title: t('Join with a link'), hint: t('Friends only need their name') },
          { Icon: BookOpen, title: t('Khatmah together'), hint: t('Split the 30 juz between you') },
        ].map(({ Icon, title, hint }, i) => (
          <div key={title}>
            {i ? <div className="set-row__divider" aria-hidden /> : null}
            <div className="set-row" style={{ paddingBlock: 9 }}>
              <span className="set-row__icon" aria-hidden>
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium">{title}</span>
                <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">{hint}</span>
              </span>
            </div>
          </div>
        ))}
      </Rise>

      <Rise order={2}>
        <Link
          href="/halaqa/new"
          className="ed-ink ed-focus fx-press mt-6 flex h-12 items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold"
        >
          <Plus className="h-[17px] w-[17px]" strokeWidth={2.1} />
          {t('Start a halaqa')}</Link>
        <p className="mt-3 text-center text-[0.78125rem] text-[var(--home-muted)]">{t('Got an invite? Just open the link.')}</p>
      </Rise>
    </>
  )
}
