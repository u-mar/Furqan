'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronRight, Copy, MessageCircle, MoreHorizontal, RefreshCw, Send, UserPlus } from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import TodayCard from '@/components/halaqa/TodayCard'
import {
  ActionButton,
  ErrorCard,
  HalaqaHeader,
  HalaqaScreen,
  Rise,
  SectionLabel,
  Skeleton,
  copyText,
} from '@/components/halaqa/HalaqaScreen'
import { MemberAvatar, ReadingDaysRow, byMeThenName } from '@/components/halaqa/People'
import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/cn'
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import {
  checkInMessage,
  deleteHalaqa,
  getHalaqa,
  halaqaAction,
  markReadToday,
  scheduleLabel,
  shortDay,
  whatsAppLink,
  withMeRead,
  type HalaqaDetail,
  type HalaqaMemberView,
} from '@/lib/halaqa'
import { errorMessage, toastError, toastSuccess } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'

export default function HalaqaPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<HalaqaDetail | null>(null)
  const [error, setError] = useState('')
  const [justRead, setJustRead] = useState(false)
  const [sharing, setSharing] = useState(false)
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
      if (mine === loads.current) setError(errorMessage(err, tr('Could not load this halaqa.')))
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

  // Shown as read straight away; put back if the server says no.
  const tick = async () => {
    if (!detail || detail.me.readToday) return
    const before = detail
    loads.current++
    successFeedback()
    setJustRead(true)
    setDetail(withMeRead(detail))
    try {
      await markReadToday('manual')
      void load()
    } catch (err) {
      setDetail(before)
      setJustRead(false)
      errorFeedback()
      toastError(errorMessage(err, tr('Could not save that. Try again.')))
    }
  }

  const people = useMemo(() => [...(detail?.members ?? [])].sort(byMeThenName), [detail])
  const read = people.filter((m) => m.readToday)
  const notYet = people.filter((m) => !m.readToday)

  if (!detail) {
    return (
      <HalaqaScreen>
        <HalaqaHeader title={t('Halaqa')} />
        {error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : (
          <div className="mt-[18px] space-y-3" aria-busy>
            <Skeleton className="h-[210px] rounded-[18px]" />
            <Skeleton className="h-[110px] rounded-2xl" />
            <Skeleton className="h-[220px] rounded-2xl" />
          </div>
        )}
      </HalaqaScreen>
    )
  }

  const { halaqa, khatmah } = detail
  const settingsButton = (
    <Link href={`/halaqa/${id}/settings`} className="home-round ed-focus" aria-label={t('Halaqa settings')}>
      <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={2.2} />
    </Link>
  )

  if (halaqa.ended && detail.summary) {
    return (
      <Ended
        detail={detail}
        settingsButton={settingsButton}
        onChanged={load}
        onClosed={() => router.replace('/halaqa')}
      />
    )
  }

  const myJuz = khatmah?.juz.find((j) => j.mine && !j.done)

  return (
    <HalaqaScreen>
      <HalaqaHeader
        title={halaqa.name}
        sub={`${detail.members.length} ${detail.members.length === 1 ? 'member' : 'members'} · ${scheduleLabel(halaqa)}`}
        right={settingsButton}
      />

      <Rise className="mt-[18px]">
        <TodayCard
          readToday={detail.me.readToday}
          justRead={justRead}
          readCount={read.length}
          total={people.length}
          onRead={() => void tick()}
        />
      </Rise>

      <Rise order={1} className="home-card mt-3 overflow-hidden rounded-2xl">
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            setSharing(true)
          }}
          className="set-row"
          style={{ paddingBlock: 9 }}
        >
          <span className="set-row__icon" aria-hidden>
            <MessageCircle className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-medium">{t('Share today\'s check-in')}</span>
            <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">{t('Post who has read to your WhatsApp group')}</span>
          </span>
          <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
        </button>
        <div className="set-row__divider" aria-hidden />
        <Link href={`/halaqa/${id}/invite`} className="set-row" style={{ paddingBlock: 9 }}>
          <span className="set-row__icon" aria-hidden>
            <UserPlus className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-medium">{t('Invite people')}</span>
            <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">{t('Anyone with the link can join')}</span>
          </span>
          <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
        </Link>
      </Rise>

      <Rise order={2}>
        {read.length ? (
          <>
            <SectionLabel>{t('Read today ·')} {read.length}</SectionLabel>
            <PeopleList people={read} justRead={justRead} />
          </>
        ) : null}

        {notYet.length ? (
          <>
            <SectionLabel>{t('Not yet ·')} {notYet.length}</SectionLabel>
            <PeopleList people={notYet} faded />
          </>
        ) : null}
      </Rise>

      {halaqa.khatmahEnabled && khatmah ? (
        <Rise order={3}>
          <SectionLabel>{t('Khatmah')}</SectionLabel>
          <div className="home-card overflow-hidden rounded-2xl">
            <Link href={`/halaqa/${id}/khatmah`} className="block px-3.5 pb-[13px] pt-3 transition-colors active:bg-[color-mix(in_srgb,var(--home-heading)_5%,transparent)]">
              <span className="flex items-center gap-3">
                <span className="set-row__icon" aria-hidden>
                  <BookOpen className="h-[17px] w-[17px]" strokeWidth={1.9} />
                </span>
                <span className="flex-1 text-[0.9375rem] font-medium text-[var(--home-heading)]">
                  {khatmah.completedAt ? t('Khatmah complete') : <JuzDone done={khatmah.done} />}
                </span>
                {khatmah.finishBy && !khatmah.completedAt ? (
                  <span className="text-[0.8125rem] text-[var(--home-muted)]">{t('by')} {shortDay(khatmah.finishBy)}</span>
                ) : null}
              </span>
              <span className="ml-[42px] mt-2.5 block h-1.5 overflow-hidden rounded-full bg-[var(--home-track)]">
                <span
                  className="fx-bar block h-full rounded-full bg-[var(--home-sage)]"
                  style={{ width: `${Math.round((khatmah.done / 30) * 100)}%` }}
                />
              </span>
            </Link>
            {!khatmah.completedAt ? (
              <>
                <div className="set-row__divider" aria-hidden />
                <Link href={`/halaqa/${id}/khatmah`} className="set-row">
                  {myJuz ? (
                    <span className="home-serif flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[var(--home-ink)] text-sm font-semibold text-[var(--home-ink-fg)]">
                      {myJuz.juz}
                    </span>
                  ) : (
                    <span className="set-row__icon" aria-hidden>
                      <BookOpen className="h-[17px] w-[17px]" strokeWidth={1.9} />
                    </span>
                  )}
                  <span className="set-row__label">{myJuz ? t('Your juz') : t('Take a juz')}</span>
                  <span className="set-row__value">{myJuz ? t('Juz {juz}', { juz: myJuz.juz }) : t('{count} free', { count: 30 - khatmah.juz.length })}</span>
                  <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
                </Link>
              </>
            ) : null}
          </div>
        </Rise>
      ) : null}

      <ShareCheckIn open={sharing} detail={detail} onClose={() => setSharing(false)} />
    </HalaqaScreen>
  )
}

function JuzDone({ done }: { done: number }) {
  const t = useT()
  const shown = useCountUp(done)
  return (
    <span className="tabular-nums">
      {shown} {t('of 30 juz done')}</span>
  )
}

function PeopleList({
  people,
  faded = false,
  justRead = false,
}: {
  people: HalaqaMemberView[]
  faded?: boolean
  /** You ticked a moment ago: your row arrives here with a little motion. */
  justRead?: boolean
}) {
  const t = useT()
  return (
    <div className="home-card overflow-hidden rounded-2xl">
      {people.map((person, i) => {
        const arrived = justRead && person.isMe
        return (
          <div key={person.id} className={cn(arrived && 'qari-enter')}>
            {i ? <div className="set-row__divider" style={{ marginLeft: 62 }} aria-hidden /> : null}
            <div className="set-row" style={{ minHeight: 54, paddingBlock: 9 }}>
              <MemberAvatar
                name={person.name}
                read={person.readToday}
                me={person.isMe}
                faded={faded && !person.isMe}
                pop={arrived}
              />
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">
                {person.name}
                {person.isMe ? <span className="font-medium text-[var(--home-muted)]"> {t('(you)')}</span> : null}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ShareCheckIn({ open, detail, onClose }: { open: boolean; detail: HalaqaDetail; onClose: () => void }) {
  const t = useT()
  const message = open ? checkInMessage(detail) : ''
  return (
    <SettingsSheet open={open} title={t('Today\'s check-in')} description={t('Post it in your WhatsApp group.')} onClose={onClose}>
      <div className="halaqa-bubble qari-enter whitespace-pre-line px-3.5 py-3 text-[0.90625rem] leading-relaxed text-[var(--home-heading)]">
        {message}
      </div>
      <div className="mt-5 flex flex-col gap-2.5">
        <a
          href={whatsAppLink(message)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            tapFeedback()
            onClose()
          }}
          className="ed-ink ed-focus fx-press flex h-12 items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold"
        >
          <Send className="h-[17px] w-[17px]" strokeWidth={2.1} />
          {t('Share on WhatsApp')}</a>
        <ActionButton
          kind="outline"
          icon={Copy}
          onClick={async () => {
            if (await copyText(message)) {
              tapFeedback()
              toastSuccess(tr('Check-in copied'))
              onClose()
            } else {
              errorFeedback()
              toastError(tr('Could not copy it.'))
            }
          }}
        >
          {t('Copy message')}</ActionButton>
      </div>
    </SettingsSheet>
  )
}

/** A set-time halaqa after its last day: how everyone read, and what next. */
function Ended({
  detail,
  settingsButton,
  onChanged,
  onClosed,
}: {
  detail: HalaqaDetail
  settingsButton: React.ReactNode
  onChanged: () => Promise<void>
  onClosed: () => void
}) {
  const t = useT()
  const { halaqa, summary, me } = detail
  const [busy, setBusy] = useState<'again' | 'close' | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  if (!summary) return null

  const lines = new Map(summary.lines.map((line) => [line.id, line]))
  const people = [...detail.members].sort(byMeThenName)

  const runAgain = async () => {
    setBusy('again')
    try {
      await halaqaAction(halaqa.id, 'run-again')
      successFeedback()
      toastSuccess(`${halaqa.name} has started again`)
      await onChanged()
    } catch (err) {
      errorFeedback()
      toastError(errorMessage(err, tr('Could not start it again.')))
    } finally {
      setBusy(null)
    }
  }

  const close = async () => {
    setBusy('close')
    try {
      if (me.isCreator) await deleteHalaqa(halaqa.id)
      else await halaqaAction(halaqa.id, 'leave')
      toastSuccess(me.isCreator ? `${halaqa.name} was closed` : tr('You left {name}', { name: halaqa.name }))
      onClosed()
    } catch (err) {
      errorFeedback()
      toastError(errorMessage(err, tr('Could not do that right now.')))
      setBusy(null)
    }
  }

  return (
    <HalaqaScreen>
      <HalaqaHeader title={halaqa.name} right={settingsButton} />

      <Rise className="mt-[26px] px-1">
        <p className="home-label">{t('Ended')} {halaqa.endDay ? shortDay(halaqa.endDay) : ''}</p>
        <h2 className="home-serif mt-1.5 text-[1.9375rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
          {t('{total} days, done', { total: summary.total })}</h2>
        <p className="mt-1.5 text-[0.90625rem] leading-relaxed text-[var(--home-muted)]">
          {t('Everyone in the halaqa read on {days} of the {total} days.', { days: summary.everyoneDays, total: summary.total })}</p>
      </Rise>

      <Rise order={1}>
        <SectionLabel>{t('Reading days')}</SectionLabel>
        <div className="home-card overflow-hidden rounded-2xl">
          {people.map((person, i) => {
            const line = lines.get(person.id)
            if (!line) return null
            return (
              <div key={person.id}>
                {i ? <div className="set-row__divider" style={{ marginLeft: 62 }} aria-hidden /> : null}
                <ReadingDaysRow name={person.name} me={person.isMe} line={line} />
              </div>
            )
          })}
        </div>
      </Rise>

      <Rise order={2}>
        {me.isCreator ? (
          <ActionButton icon={RefreshCw} busy={busy === 'again'} disabled={busy !== null} onClick={() => void runAgain()} className="mt-6">
            {t('Run it again')}</ActionButton>
        ) : null}
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            setConfirmClose(true)
          }}
          disabled={busy !== null}
          className="ed-focus mx-auto mt-3.5 block rounded-md px-3 py-1.5 text-sm font-semibold text-[var(--home-muted)] hover:text-[var(--home-heading)]"
        >
          {me.isCreator ? t('Close the halaqa') : t('Leave the halaqa')}
        </button>
      </Rise>

      <SettingsSheet
        open={confirmClose}
        title={me.isCreator ? t('Close this halaqa?') : t('Leave this halaqa?')}
        description={
          me.isCreator
            ? t('It will be removed for everyone in it. This cannot be undone.')
            : t('You can join again with the invite link.')
        }
        onClose={() => setConfirmClose(false)}
      >
        <ActionButton kind="danger" busy={busy === 'close'} onClick={() => void close()}>
          {me.isCreator ? t('Close the halaqa') : t('Leave')}
        </ActionButton>
      </SettingsSheet>
    </HalaqaScreen>
  )
}
