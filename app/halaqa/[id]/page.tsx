'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BellRing, Check, Loader2, MoreHorizontal, RefreshCw, UserPlus } from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import HalaqaCircle from '@/components/halaqa/HalaqaCircle'
import KhatmahShelf from '@/components/halaqa/KhatmahShelf'
import {
  ActionButton,
  ErrorCard,
  HalaqaSkyHeader,
  HalaqaSkyScreen,
  Rise,
  SkyLabel,
  Skeleton,
} from '@/components/halaqa/HalaqaScreen'
import { MemberAvatar, ReadingDaysRow, RecentStrip, byMeThenName, daysLabel } from '@/components/halaqa/People'
import { cn } from '@/lib/cn'
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import {
  deleteHalaqa,
  getHalaqa,
  halaqaAction,
  peekHalaqa,
  markReadToday,
  remindHalaqa,
  scheduleLabel,
  shortDay,
  withMeRead,
  type HalaqaDetail,
  type HalaqaMemberView,
} from '@/lib/halaqa'
import { keepHalaqaPushOn } from '@/lib/push-client'
import { errorMessage, toastError, toastSuccess } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'

export default function HalaqaPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<HalaqaDetail | null>(null)
  const [error, setError] = useState('')
  const [justRead, setJustRead] = useState(false)
  /** Loads can finish out of order (coming back to the app starts one); only the newest counts. */
  const loads = useRef(0)

  // Reminders the others send ("Send reminder") reach this phone without being turned on: kept on each
  // time a halaqa opens. They can be turned off in the halaqa's Settings.
  useEffect(() => {
    void keepHalaqaPushOn().catch(() => {})
  }, [])

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
    const cached = peekHalaqa(id)
    if (cached) setDetail(cached)
    void load()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load, id])

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

  if (!detail) {
    return (
      <HalaqaSkyScreen>
        <HalaqaSkyHeader title={t('Halaqa')} />
        {error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : (
          <div className="mt-4 flex flex-col items-center" aria-busy>
            <Skeleton className="h-[288px] w-[288px] rounded-full" />
            <Skeleton className="mt-6 h-[50px] w-full rounded-full" />
            <Skeleton className="mt-8 h-[260px] w-full rounded-[1.375rem]" />
          </div>
        )}
      </HalaqaSkyScreen>
    )
  }

  const { halaqa, khatmah } = detail
  const settingsButton = (
    <Link href={`/halaqa/${id}/settings`} className="home-glass-round ed-focus" aria-label={t('Halaqa settings')}>
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

  const memberCount = detail.members.length

  return (
    <HalaqaSkyScreen>
      <HalaqaSkyHeader
        title={halaqa.name}
        sub={`${memberCount === 1 ? t('1 member') : t('{count} members', { count: memberCount })} · ${scheduleLabel(halaqa)}`}
        right={settingsButton}
      />

      <Rise className="mt-3">
        <HalaqaCircle people={people} readToday={detail.me.readToday} justRead={justRead} onRead={() => void tick()} />
      </Rise>

      <Rise order={1} className="mt-6 grid grid-cols-2 gap-2.5">
        <RemindButton detail={detail} />
        <Link href={`/halaqa/${id}/invite`} className="hq-action ed-focus fx-press">
          <UserPlus className="h-[17px] w-[17px] text-[var(--hv-teal)]" strokeWidth={2} />
          {t('Invite')}
        </Link>
      </Rise>


      <Rise order={2}>
        <SkyLabel
          right={
            <span className="text-[0.75rem] tabular-nums text-[var(--hv-text3)]">
              {read.length}/{people.length} {t('read today')}
            </span>
          }
        >
          {t('Members')}
        </SkyLabel>
        <MembersList people={people} justRead={justRead} />
      </Rise>

      {halaqa.khatmahEnabled && khatmah ? (
        <Rise order={3} className="mt-7">
          <KhatmahShelf halaqaId={id} khatmah={khatmah} />
        </Rise>
      ) : null}

    </HalaqaSkyScreen>
  )
}


/**
 * Everyone in the halaqa, me first and then by name so it never reads as a
 * ranking: whether they have read today, and their last two weeks.
 */
function MembersList({
  people,
  justRead = false,
}: {
  people: HalaqaMemberView[]
  /** You ticked a moment ago: your row lights up with a little motion. */
  justRead?: boolean
}) {
  const t = useT()
  return (
    <div className="hv-card overflow-hidden rounded-[1.375rem]">
      {people.map((person, i) => {
        const arrived = justRead && person.isMe
        return (
          <div key={person.id} className={cn(arrived && 'qari-enter')}>
            {i ? <div className="hq-divider" aria-hidden /> : null}
            <div className="flex min-h-[3.75rem] items-center gap-3 px-3.5 py-2.5">
              <MemberAvatar
                name={person.name}
                size={38}
                read={person.readToday}
                me={person.isMe}
                faded={!person.readToday && !person.isMe}
                pop={arrived}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.90625rem] font-semibold text-[var(--hv-text)]">
                  {person.name}
                  {person.isMe ? <span className="font-medium text-[var(--hv-text3)]"> {t('(you)')}</span> : null}
                </span>
                <span className="mt-1.5 flex items-center gap-2" title={daysLabel(person.recent)}>
                  <RecentStrip line={person.recent} />
                  <span className="text-[0.6875rem] tabular-nums text-[var(--hv-text3)]">
                    {person.recent.count}/{person.recent.possible}
                  </span>
                  <span className="sr-only">{daysLabel(person.recent)}</span>
                </span>
              </span>
              {person.readToday ? (
                <span className="hq-status hq-status--read">
                  <Check className="h-3 w-3" strokeWidth={3.2} />
                  <span className="sr-only">{t('read today')}</span>
                </span>
              ) : (
                <span className="hq-status" aria-hidden />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** How long after sending a reminder this phone waits before it can send the same halaqa another. */
const REMIND_AGAIN_MS = 60 * 60 * 1000

function remindedAt(halaqaId: string): number {
  try {
    return Number(localStorage.getItem(`naba-halaqa-reminded-${halaqaId}`)) || 0
  } catch {
    return 0
  }
}

/**
 * Sends everyone in the halaqa who has not read today a notification on their phone ("{name} sent a
 * reminder · Have you read today in …?"). Once an hour from this phone, so a halaqa is not flooded;
 * and with nobody left to remind it says so instead.
 */
function RemindButton({ detail }: { detail: HalaqaDetail }) {
  const t = useT()
  const id = detail.halaqa.id
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(() => Date.now() - remindedAt(id) < REMIND_AGAIN_MS)
  const notYet = detail.members.filter((m) => !m.readToday && !m.isMe).length

  const remind = async () => {
    if (busy) return
    tapFeedback()
    if (sent) {
      toastSuccess(tr('Reminder already sent. You can send another in an hour.'))
      return
    }
    if (notYet === 0) {
      toastSuccess(tr('Everyone has already read today'))
      return
    }
    setBusy(true)
    try {
      const { remindedCount } = await remindHalaqa(id)
      successFeedback()
      toastSuccess(remindedCount > 0 ? tr('Reminder sent') : tr('Everyone has already read today'))
      if (remindedCount > 0) {
        setSent(true)
        try {
          localStorage.setItem(`naba-halaqa-reminded-${id}`, String(Date.now()))
        } catch {
          // Only spares the halaqa a second reminder.
        }
      }
    } catch (err) {
      errorFeedback()
      toastError(errorMessage(err, tr('Could not send that reminder.')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" onClick={() => void remind()} disabled={busy} className="hq-action ed-focus fx-press disabled:opacity-60">
      {busy ? (
        <Loader2 className="h-[17px] w-[17px] animate-spin text-[var(--hv-teal)]" strokeWidth={2} />
      ) : sent ? (
        <Check className="h-[17px] w-[17px] text-[var(--hv-teal)]" strokeWidth={2.4} />
      ) : (
        <BellRing className="h-[17px] w-[17px] text-[var(--hv-teal)]" strokeWidth={2} />
      )}
      {sent ? t('Reminder sent') : t('Send reminder')}
    </button>
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
    <HalaqaSkyScreen>
      <HalaqaSkyHeader title={halaqa.name} right={settingsButton} />

      <Rise className="mt-[26px] px-1">
        <p className="home-label">{t('Ended')} {halaqa.endDay ? shortDay(halaqa.endDay) : ''}</p>
        <h2 className="home-serif mt-1.5 text-[1.9375rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
          {t('{total} days, done', { total: summary.total })}</h2>
        <p className="mt-1.5 text-[0.90625rem] leading-relaxed text-[var(--home-muted)]">
          {t('Everyone in the halaqa read on {days} of the {total} days.', { days: summary.everyoneDays, total: summary.total })}</p>
      </Rise>

      <Rise order={1}>
        <SkyLabel>{t('Reading days')}</SkyLabel>
        <div className="hv-card overflow-hidden rounded-[1.375rem]">
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
          <ActionButton icon={RefreshCw} busy={busy === 'again'} disabled={busy !== null} onClick={() => void runAgain()} className="hq-cta mt-6">
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
    </HalaqaSkyScreen>
  )
}
