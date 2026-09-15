'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronRight, Copy, MessageCircle, MoreHorizontal, RefreshCw, Send, UserPlus } from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import TodayCard from '@/components/halaqa/TodayCard'
import {
  ErrorCard,
  HalaqaHeader,
  HalaqaScreen,
  SectionLabel,
  Skeleton,
  Toast,
  copyText,
  useToast,
} from '@/components/halaqa/HalaqaScreen'
import { MemberAvatar, ReadingDaysRow, byMeThenName } from '@/components/halaqa/People'
import { successFeedback, tapFeedback } from '@/lib/haptics'
import {
  checkInMessage,
  deleteHalaqa,
  getHalaqa,
  halaqaAction,
  markReadToday,
  scheduleLabel,
  shortDay,
  whatsAppLink,
  type HalaqaDetail,
  type HalaqaMemberView,
} from '@/lib/halaqa'

export default function HalaqaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<HalaqaDetail | null>(null)
  const [error, setError] = useState('')
  const [ticking, setTicking] = useState(false)
  const [sharing, setSharing] = useState(false)
  const { toast, showToast } = useToast()

  const load = useCallback(async () => {
    try {
      setDetail(await getHalaqa(id))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this halaqa.')
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

  const people = useMemo(() => [...(detail?.members ?? [])].sort(byMeThenName), [detail])
  const read = people.filter((m) => m.readToday)
  const notYet = people.filter((m) => !m.readToday)

  if (!detail) {
    return (
      <HalaqaScreen>
        <HalaqaHeader title="Halaqa" />
        {error ? (
          <ErrorCard message={error} onRetry={() => void load()} />
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
    <Link href={`/halaqa/${id}/settings`} className="home-round ed-focus" aria-label="Halaqa settings">
      <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={2.2} />
    </Link>
  )

  if (halaqa.ended && detail.summary) {
    return (
      <Ended
        detail={detail}
        settingsButton={settingsButton}
        onChanged={() => void load()}
        onClosed={() => router.replace('/halaqa')}
        showToast={showToast}
        toast={toast}
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

      <div className="mt-[18px]">
        <TodayCard
          readToday={detail.me.readToday}
          readCount={read.length}
          total={people.length}
          busy={ticking}
          onRead={() => void tick()}
        />
      </div>

      <div className="home-card mt-3 overflow-hidden rounded-2xl">
        <button type="button" onClick={() => setSharing(true)} className="set-row" style={{ paddingBlock: 9 }}>
          <span className="set-row__icon" aria-hidden>
            <MessageCircle className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-medium">Share today&apos;s check-in</span>
            <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">Post who has read to your WhatsApp group</span>
          </span>
          <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
        </button>
        <div className="set-row__divider" aria-hidden />
        <Link href={`/halaqa/${id}/invite`} className="set-row" style={{ paddingBlock: 9 }}>
          <span className="set-row__icon" aria-hidden>
            <UserPlus className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-medium">Invite people</span>
            <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">Anyone with the link can join</span>
          </span>
          <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
        </Link>
      </div>

      {read.length ? (
        <>
          <SectionLabel>Read today · {read.length}</SectionLabel>
          <PeopleList people={read} />
        </>
      ) : null}

      {notYet.length ? (
        <>
          <SectionLabel>Not yet · {notYet.length}</SectionLabel>
          <PeopleList people={notYet} faded />
        </>
      ) : null}

      {halaqa.khatmahEnabled && khatmah ? (
        <>
          <SectionLabel>Khatmah</SectionLabel>
          <div className="home-card overflow-hidden rounded-2xl">
            <Link href={`/halaqa/${id}/khatmah`} className="block px-3.5 pb-[13px] pt-3">
              <span className="flex items-center gap-3">
                <span className="set-row__icon" aria-hidden>
                  <BookOpen className="h-[17px] w-[17px]" strokeWidth={1.9} />
                </span>
                <span className="flex-1 text-[0.9375rem] font-medium text-[var(--home-heading)]">
                  {khatmah.completedAt ? 'Khatmah complete' : `${khatmah.done} of 30 juz done`}
                </span>
                {khatmah.finishBy && !khatmah.completedAt ? (
                  <span className="text-[0.8125rem] text-[var(--home-muted)]">by {shortDay(khatmah.finishBy)}</span>
                ) : null}
              </span>
              <span className="ml-[42px] mt-2.5 block h-1.5 overflow-hidden rounded-full bg-[var(--home-track)]">
                <span
                  className="block h-full rounded-full bg-[var(--home-sage)]"
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
                  <span className="set-row__label">{myJuz ? 'Your juz' : 'Take a juz'}</span>
                  <span className="set-row__value">{myJuz ? `Juz ${myJuz.juz}` : `${30 - khatmah.juz.length} free`}</span>
                  <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
                </Link>
              </>
            ) : null}
          </div>
        </>
      ) : null}

      <ShareCheckIn open={sharing} detail={detail} onClose={() => setSharing(false)} showToast={showToast} />
      <Toast message={toast} />
    </HalaqaScreen>
  )
}

function PeopleList({ people, faded = false }: { people: HalaqaMemberView[]; faded?: boolean }) {
  return (
    <div className="home-card overflow-hidden rounded-2xl">
      {people.map((person, i) => (
        <div key={person.id}>
          {i ? <div className="set-row__divider" style={{ marginLeft: 62 }} aria-hidden /> : null}
          <div className="set-row" style={{ minHeight: 54, paddingBlock: 9 }}>
            <MemberAvatar name={person.name} read={person.readToday} me={person.isMe} faded={faded && !person.isMe} />
            <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">
              {person.name}
              {person.isMe ? <span className="font-medium text-[var(--home-muted)]"> (you)</span> : null}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ShareCheckIn({
  open,
  detail,
  onClose,
  showToast,
}: {
  open: boolean
  detail: HalaqaDetail
  onClose: () => void
  showToast: (message: string) => void
}) {
  const message = open ? checkInMessage(detail) : ''
  return (
    <SettingsSheet open={open} title="Today's check-in" description="Post it in your WhatsApp group." onClose={onClose}>
      <div className="halaqa-bubble whitespace-pre-line px-3.5 py-3 text-[0.90625rem] leading-relaxed text-[var(--home-heading)]">
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
          className="ed-ink ed-focus flex h-12 items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold transition-transform active:scale-[0.98]"
        >
          <Send className="h-[17px] w-[17px]" strokeWidth={2.1} />
          Share on WhatsApp
        </a>
        <button
          type="button"
          onClick={async () => {
            const ok = await copyText(message)
            showToast(ok ? 'Check-in copied.' : 'Could not copy it.')
            if (ok) onClose()
          }}
          className="ed-focus flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-[0.90625rem] font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
        >
          <Copy className="h-[17px] w-[17px]" strokeWidth={2} />
          Copy message
        </button>
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
  showToast,
  toast,
}: {
  detail: HalaqaDetail
  settingsButton: React.ReactNode
  onChanged: () => void
  onClosed: () => void
  showToast: (message: string) => void
  toast: string
}) {
  const { halaqa, summary, me } = detail
  const [busy, setBusy] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  if (!summary) return null

  const lines = new Map(summary.lines.map((line) => [line.id, line]))
  const people = [...detail.members].sort(byMeThenName)

  const runAgain = async () => {
    setBusy(true)
    try {
      await halaqaAction(halaqa.id, 'run-again')
      successFeedback()
      onChanged()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not start it again.')
    } finally {
      setBusy(false)
    }
  }

  const close = async () => {
    setBusy(true)
    try {
      if (me.isCreator) await deleteHalaqa(halaqa.id)
      else await halaqaAction(halaqa.id, 'leave')
      onClosed()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not do that right now.')
      setBusy(false)
    }
  }

  return (
    <HalaqaScreen>
      <HalaqaHeader title={halaqa.name} right={settingsButton} />

      <div className="mt-[26px] px-1">
        <p className="home-label">Ended {halaqa.endDay ? shortDay(halaqa.endDay) : ''}</p>
        <h2 className="home-serif mt-1.5 text-[1.9375rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
          {summary.total} days, done
        </h2>
        <p className="mt-1.5 text-[0.90625rem] leading-relaxed text-[var(--home-muted)]">
          Everyone in the halaqa read on {summary.everyoneDays} of the {summary.total} days.
        </p>
      </div>

      <SectionLabel>Reading days</SectionLabel>
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

      {me.isCreator ? (
        <button
          type="button"
          onClick={() => void runAgain()}
          disabled={busy}
          className="ed-ink ed-focus mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <RefreshCw className="h-[17px] w-[17px]" strokeWidth={2.1} />
          Run it again
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setConfirmClose(true)}
        disabled={busy}
        className="ed-focus mx-auto mt-3.5 block rounded-md px-3 py-1.5 text-sm font-semibold text-[var(--home-muted)] hover:text-[var(--home-heading)]"
      >
        {me.isCreator ? 'Close the halaqa' : 'Leave the halaqa'}
      </button>

      <SettingsSheet
        open={confirmClose}
        title={me.isCreator ? 'Close this halaqa?' : 'Leave this halaqa?'}
        description={
          me.isCreator
            ? 'It will be removed for everyone in it. This cannot be undone.'
            : 'You can join again with the invite link.'
        }
        onClose={() => setConfirmClose(false)}
      >
        <button
          type="button"
          onClick={() => void close()}
          disabled={busy}
          className="ed-focus flex h-12 w-full items-center justify-center rounded-full bg-rose-600 text-[0.90625rem] font-semibold text-white disabled:opacity-60"
        >
          {me.isCreator ? 'Close the halaqa' : 'Leave'}
        </button>
      </SettingsSheet>
      <Toast message={toast} />
    </HalaqaScreen>
  )
}
