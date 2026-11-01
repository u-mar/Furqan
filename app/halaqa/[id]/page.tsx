'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BellRing, Check, Copy, MessageCircle, MoreHorizontal, RefreshCw, Send, UserPlus } from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import HalaqaCircle from '@/components/halaqa/HalaqaCircle'
import KhatmahShelf from '@/components/halaqa/KhatmahShelf'
import Switch from '@/components/qari/Switch'
import {
  ActionButton,
  ErrorCard,
  HalaqaSkyHeader,
  HalaqaSkyScreen,
  Rise,
  SkyLabel,
  Skeleton,
  copyText,
} from '@/components/halaqa/HalaqaScreen'
import { MemberAvatar, ReadingDaysRow, RecentStrip, byMeThenName, daysLabel } from '@/components/halaqa/People'
import { cn } from '@/lib/cn'
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import {
  checkInMessage,
  deleteHalaqa,
  getHalaqa,
  halaqaAction,
  peekHalaqa,
  markReadToday,
  remindHalaqa,
  scheduleLabel,
  shortDay,
  whatsAppLink,
  withMeRead,
  type HalaqaDetail,
  type HalaqaMemberView,
} from '@/lib/halaqa'
import { disableHalaqaPush, enableHalaqaPush, keepHalaqaPushOn, pushState, type PushState } from '@/lib/push-client'
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
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            setSharing(true)
          }}
          className="hq-action ed-focus fx-press"
        >
          <MessageCircle className="h-[17px] w-[17px] text-[var(--hv-teal)]" strokeWidth={2} />
          {t('Share check-in')}
        </button>
        <Link href={`/halaqa/${id}/invite`} className="hq-action ed-focus fx-press">
          <UserPlus className="h-[17px] w-[17px] text-[var(--hv-teal)]" strokeWidth={2} />
          {t('Invite')}
        </Link>
      </Rise>

      <NotifyBanner />

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

      <ShareCheckIn open={sharing} detail={detail} onClose={() => setSharing(false)} />
    </HalaqaSkyScreen>
  )
}

/** Lets this phone opt in to the reminders other members send from "Share today's check-in". */
function NotifyBanner() {
  const t = useT()
  const [push, setPush] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)

  // In the app a member hears the reminders without turning them on (keepHalaqaPushOn); then the switch shows how things stand.
  useEffect(() => {
    void keepHalaqaPushOn()
      .catch(() => {})
      .then(() => pushState())
      .then(setPush)
  }, [])

  if (!push || push === 'unconfigured') return null

  const toggle = async (next: boolean) => {
    if (busy) return
    setBusy(true)
    try {
      setPush(next ? await enableHalaqaPush() : await disableHalaqaPush())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Rise className="hv-card mt-2.5 flex items-center gap-3 rounded-[1.375rem] px-3.5 py-3">
      <span className="hq-icon" aria-hidden>
        {push === 'on' ? <BellRing className="h-[17px] w-[17px]" strokeWidth={1.9} /> : <Bell className="h-[17px] w-[17px]" strokeWidth={1.9} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.875rem] font-semibold text-[var(--hv-text)]">{t('Get reminded to read')}</span>
        <span className="mt-0.5 block text-[0.75rem] leading-snug text-[var(--hv-text3)]">
          {push === 'needs-install'
            ? t('On iPhone, first add this app to your Home Screen (Share, then Add to Home Screen), then open it from there.')
            : push === 'blocked'
              ? t('Notifications are blocked. Allow them for this app in your phone’s settings.')
              : push === 'unsupported'
                ? t('This browser cannot show notifications when it is closed.')
                : t('Hear it here when someone in this halaqa sends a reminder.')}
        </span>
      </span>
      {push === 'off' || push === 'on' ? (
        <Switch checked={push === 'on'} onChange={(next) => void toggle(next)} label={t('Get reminded to read')} />
      ) : null}
    </Rise>
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

function ShareCheckIn({ open, detail, onClose }: { open: boolean; detail: HalaqaDetail; onClose: () => void }) {
  const t = useT()
  const message = open ? checkInMessage(detail) : ''
  const [reminding, setReminding] = useState(false)
  const notYet = detail.members.filter((m) => !m.readToday && !m.isMe).length

  const remind = async () => {
    if (reminding) return
    tapFeedback()
    setReminding(true)
    try {
      const { remindedCount } = await remindHalaqa(detail.halaqa.id)
      successFeedback()
      toastSuccess(remindedCount > 0 ? tr('Reminder sent') : tr('Everyone has already read today'))
      onClose()
    } catch (err) {
      errorFeedback()
      toastError(errorMessage(err, tr('Could not send that reminder.')))
    } finally {
      setReminding(false)
    }
  }

  return (
    <SettingsSheet open={open} title={t('Today\'s check-in')} description={t('Post it, or send a reminder straight to their phone.')} onClose={onClose}>
      <div className="halaqa-bubble qari-enter whitespace-pre-line px-3.5 py-3 text-[0.90625rem] leading-relaxed text-[var(--home-heading)]">
        {message}
      </div>
      <div className="mt-5 flex flex-col gap-2.5">
        {notYet > 0 ? (
          <ActionButton icon={BellRing} busy={reminding} disabled={reminding} onClick={() => void remind()}>
            {t('Send a reminder to read')}</ActionButton>
        ) : null}
        <a
          href={whatsAppLink(message)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            tapFeedback()
            onClose()
          }}
          className={cn(
            'ed-focus fx-press flex h-12 items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold',
            notYet > 0 ? 'border border-[var(--home-rule-strong)] text-[var(--home-heading)]' : 'ed-ink'
          )}
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
