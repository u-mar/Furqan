'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { BookOpen, CalendarCheck, Check, ChevronRight, Link2, Plus } from 'lucide-react'
import { IconHalaqa } from '@/components/home/TileIcons'
import {
  ErrorCard,
  HalaqaHeader,
  HalaqaScreen,
  SectionLabel,
  Skeleton,
  Toast,
  useToast,
} from '@/components/halaqa/HalaqaScreen'
import { successFeedback } from '@/lib/haptics'
import { listHalaqas, markReadToday, scheduleLabel, type HalaqaListItem } from '@/lib/halaqa'

export default function HalaqaHomePage() {
  const [data, setData] = useState<{ readToday: boolean; halaqas: HalaqaListItem[] } | null>(null)
  const [error, setError] = useState('')
  const [ticking, setTicking] = useState(false)
  const { toast, showToast } = useToast()

  const load = useCallback(async () => {
    try {
      setData(await listHalaqas())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your halaqas.')
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

  const tick = async () => {
    setTicking(true)
    try {
      await markReadToday('manual')
      successFeedback()
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save that.')
    } finally {
      setTicking(false)
    }
  }

  return (
    <HalaqaScreen>
      <HalaqaHeader title="Halaqa" backHref="/" />

      {error && !data ? <ErrorCard message={error} onRetry={() => void load()} /> : null}

      {!data && !error ? (
        <div className="mt-[18px] space-y-3" aria-busy>
          <Skeleton className="h-[68px] rounded-2xl" />
          <Skeleton className="h-[220px] rounded-2xl" />
        </div>
      ) : null}

      {data && data.halaqas.length === 0 ? <FirstVisit /> : null}

      {data && data.halaqas.length > 0 ? (
        <>
          <SectionLabel>Today</SectionLabel>
          <div className="home-card flex items-center gap-3 rounded-2xl py-3 pl-3.5 pr-3">
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-semibold text-[var(--home-heading)]">
                {data.readToday ? 'You read today' : 'Have you read today?'}
              </p>
              <p className="mt-0.5 text-[0.78125rem] text-[var(--home-muted)]">Counts in all your halaqas</p>
            </div>
            {data.readToday ? (
              <span className="flex h-[38px] shrink-0 items-center gap-1.5 rounded-full bg-[var(--home-sage-soft)] pl-3 pr-3.5 text-[0.84375rem] font-semibold text-[var(--home-sage-deep)]">
                <Check className="h-[15px] w-[15px]" strokeWidth={2.6} />
                Done
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void tick()}
                disabled={ticking}
                className="ed-ink ed-focus flex h-[38px] shrink-0 items-center gap-1.5 rounded-full pl-3 pr-3.5 text-[0.84375rem] font-semibold transition-transform active:scale-95 disabled:opacity-60"
              >
                <Check className="h-[15px] w-[15px]" strokeWidth={2.6} />I read
              </button>
            )}
          </div>

          <SectionLabel>Your halaqas</SectionLabel>
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
                        {h.readCount}/{h.memberCount} <span className="font-medium text-[var(--home-muted)]">read</span>
                      </span>
                    </span>
                    <span className="mt-[7px] block h-[3px] overflow-hidden rounded-full bg-[var(--home-track)]">
                      <span
                        className="block h-full rounded-full bg-[var(--home-sage)]"
                        style={{ width: `${h.memberCount ? Math.round((h.readCount / h.memberCount) * 100) : 0}%` }}
                      />
                    </span>
                    <span className="mt-1.5 block truncate text-[0.78125rem] text-[var(--home-muted)]">
                      {scheduleLabel(h)}
                      {h.khatmah
                        ? h.khatmah.completed
                          ? ' · Khatmah complete'
                          : ` · Khatmah ${h.khatmah.done} of ${h.khatmah.total} juz`
                        : ''}
                    </span>
                  </span>
                  <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
                </Link>
              </div>
            ))}
          </div>

          <Link
            href="/halaqa/new"
            className="ed-ink ed-focus mt-6 flex h-12 items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold transition-transform active:scale-[0.98]"
          >
            <Plus className="h-[17px] w-[17px]" strokeWidth={2.1} />
            Start a halaqa
          </Link>
          <p className="mt-3 text-center text-[0.78125rem] text-[var(--home-muted)]">Got an invite? Just open the link.</p>
        </>
      ) : null}

      <Toast message={toast} />
    </HalaqaScreen>
  )
}

function FirstVisit() {
  return (
    <>
      <div className="mt-11 flex flex-col items-center px-3 text-center">
        <span className="flex h-[104px] w-[104px] items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
          <IconHalaqa className="h-[58px] w-[58px]" />
        </span>
        <h2 className="home-serif mt-[22px] text-[1.5625rem] font-semibold tracking-[-0.02em] text-[var(--home-heading)]">
          Read the Quran together
        </h2>
        <p className="mt-2 max-w-[300px] text-[0.90625rem] leading-relaxed text-[var(--home-muted)] [text-wrap:pretty]">
          Make a halaqa with family or friends. Every day, everyone ticks off their reading, and you can finish a
          khatmah together.
        </p>
      </div>

      <div className="home-card mt-7 overflow-hidden rounded-2xl">
        {[
          { Icon: CalendarCheck, title: 'Daily check-in', hint: 'See who has read today' },
          { Icon: Link2, title: 'Join with a link', hint: 'Friends only need their name' },
          { Icon: BookOpen, title: 'Khatmah together', hint: 'Split the 30 juz between you' },
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
      </div>

      <Link
        href="/halaqa/new"
        className="ed-ink ed-focus mt-6 flex h-12 items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold transition-transform active:scale-[0.98]"
      >
        <Plus className="h-[17px] w-[17px]" strokeWidth={2.1} />
        Start a halaqa
      </Link>
      <p className="mt-3 text-center text-[0.78125rem] text-[var(--home-muted)]">Got an invite? Just open the link.</p>
    </>
  )
}
