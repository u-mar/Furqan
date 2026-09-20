'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Hourglass,
  Infinity as InfinityIcon,
  Link2,
  Loader2,
  LogOut,
  RefreshCw,
  Trash,
  UserMinus,
} from 'lucide-react'
import Radio from '@/components/settings/Radio'
import SettingsSheet from '@/components/settings/SettingsSheet'
import Switch from '@/components/qari/Switch'
import {
  ActionButton,
  CopyLabel,
  ErrorCard,
  HalaqaHeader,
  HalaqaScreen,
  Rise,
  SectionLabel,
  Skeleton,
  copyText,
  useFlash,
} from '@/components/halaqa/HalaqaScreen'
import { DayDots, MemberAvatar, ReadingDaysRow, byMeThenName } from '@/components/halaqa/People'
import { cn } from '@/lib/cn'
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import {
  addLocalDays,
  dayGap,
  deleteHalaqa,
  getHalaqa,
  peekHalaqa,
  halaqaAction,
  inviteLink,
  localDay,
  shortDay,
  type HalaqaDetail,
  type HalaqaMemberView,
} from '@/lib/halaqa'
import { errorMessage, toastError, toastSuccess } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'

type Sheet = 'rename' | 'schedule' | 'finish' | 'leave' | 'delete' | null

export default function HalaqaSettingsPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<HalaqaDetail | null>(null)
  const [error, setError] = useState('')
  /** The action waiting on the server, so only its own button shows a spinner. */
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [member, setMember] = useState<HalaqaMemberView | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [copied, flashCopied] = useFlash()
  /** Loads can finish out of order; only the newest counts. */
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
  }, [load, id])

  const act = async (action: string, extra: Record<string, unknown> = {}, done?: string, key = action) => {
    setPendingAction(key)
    try {
      const result = await halaqaAction(id, action, extra)
      successFeedback()
      if (result.left) {
        toastSuccess(tr('You left {halaqa}', { halaqa: detail?.halaqa.name ?? 'the halaqa' }))
        router.replace('/halaqa')
        return
      }
      if (done) toastSuccess(done)
      setSheet(null)
      setMember(null)
      setConfirmRemove(false)
      await load()
    } catch (err) {
      errorFeedback()
      toastError(errorMessage(err, tr('Could not do that right now.')))
    } finally {
      setPendingAction(null)
    }
  }

  const people = useMemo(() => [...(detail?.members ?? [])].sort(byMeThenName), [detail])

  if (!detail) {
    return (
      <HalaqaScreen>
        <HalaqaHeader title={t('Halaqa settings')} backHref={`/halaqa/${id}`} />
        {error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : (
          <div className="mt-[18px] space-y-3" aria-busy>
            <Skeleton className="h-[72px] rounded-2xl" />
            <Skeleton className="h-[160px] rounded-2xl" />
            <Skeleton className="h-[260px] rounded-2xl" />
          </div>
        )}
      </HalaqaScreen>
    )
  }

  const { halaqa, khatmah, me } = detail
  const creator = detail.members.find((m) => m.isCreator)
  const scheduleValue = halaqa.endDay
    ? t('{dayGap} days · ends {endDay}', { dayGap: dayGap(halaqa.startDay, halaqa.endDay) + 1, endDay: shortDay(halaqa.endDay) })
    : t('Every day')
  const khatmahActive = halaqa.khatmahEnabled && khatmah && !khatmah.completedAt
  const memberJuz = member && khatmah ? khatmah.juz.filter((row) => row.memberId === member.id && !row.done) : []
  const busy = pendingAction !== null

  const copyLink = async () => {
    if (await copyText(inviteLink(halaqa.code))) {
      tapFeedback()
      flashCopied()
    } else {
      errorFeedback()
      toastError(tr('Could not copy the link.'))
    }
  }

  // The switch moves at once; it moves back if the server says no.
  const setKhatmah = async (enabled: boolean) => {
    const before = detail
    loads.current++
    setDetail({ ...detail, halaqa: { ...halaqa, khatmahEnabled: enabled } })
    try {
      await halaqaAction(id, 'khatmah', { enabled })
      toastSuccess(enabled ? tr('Khatmah is on') : tr('Khatmah is off'))
      await load()
    } catch (err) {
      setDetail(before)
      errorFeedback()
      toastError(errorMessage(err, tr('Could not change that right now.')))
    }
  }

  const removeHalaqa = async () => {
    setPendingAction('delete')
    try {
      await deleteHalaqa(id)
      successFeedback()
      toastSuccess(`${halaqa.name} was deleted`)
      router.replace('/halaqa')
    } catch (err) {
      errorFeedback()
      toastError(errorMessage(err, tr('Could not delete the halaqa.')))
      setPendingAction(null)
    }
  }

  const open = (next: Sheet) => {
    tapFeedback()
    setSheet(next)
  }

  return (
    <HalaqaScreen>
      <HalaqaHeader title={t('Halaqa settings')} backHref={`/halaqa/${id}`} />

      <Rise>
        <button
          type="button"
          onClick={() => me.isCreator && open('rename')}
          disabled={!me.isCreator}
          className="home-card home-press ed-focus mt-[18px] flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left disabled:active:scale-100"
        >
          <span className="home-serif flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[var(--home-sage-soft)] text-xl font-semibold text-[var(--home-sage-deep)]">
            {(halaqa.name.trim().charAt(0) || 'H').toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span key={halaqa.name} className="home-fade block truncate text-base font-semibold text-[var(--home-heading)]">
              {halaqa.name}
            </span>
            <span className="mt-px block truncate text-[0.8125rem] text-[var(--home-muted)]">
              {me.isCreator ? t('Created by you') : t('Created by {someone}', { someone: creator?.name ?? 'someone' })} · {detail.members.length}{' '}
              {detail.members.length === 1 ? 'member' : 'members'}
            </span>
          </span>
          {me.isCreator ? <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} /> : null}
        </button>
      </Rise>

      <Rise order={1}>
        <SectionLabel>{t('Halaqa')}</SectionLabel>
        <div className="home-card overflow-hidden rounded-2xl">
          <button type="button" className="set-row" onClick={() => me.isCreator && open('schedule')} disabled={!me.isCreator}>
            <span className="set-row__icon" aria-hidden>
              {halaqa.endDay ? <Hourglass className="h-[17px] w-[17px]" strokeWidth={1.9} /> : <InfinityIcon className="h-[17px] w-[17px]" strokeWidth={1.9} />}
            </span>
            <span className="set-row__label">{t('How long')}</span>
            <span className="set-row__value">{scheduleValue}</span>
            {me.isCreator ? <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} /> : null}
          </button>
          <div className="set-row__divider" aria-hidden />
          {me.isCreator ? (
            <label className="set-row cursor-pointer">
              <span className="set-row__icon" aria-hidden>
                <BookOpen className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="set-row__label">{t('Khatmah together')}</span>
              <Switch checked={halaqa.khatmahEnabled} onChange={(enabled) => void setKhatmah(enabled)} label={t('Khatmah together')} />
            </label>
          ) : (
            <div className="set-row">
              <span className="set-row__icon" aria-hidden>
                <BookOpen className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="set-row__label">{t('Khatmah together')}</span>
              <span className="set-row__value">{halaqa.khatmahEnabled ? t('On') : t('Off')}</span>
            </div>
          )}
          {khatmahActive ? (
            <div className="qari-enter">
              <div className="set-row__divider" aria-hidden />
              <button type="button" className="set-row" onClick={() => me.isCreator && open('finish')} disabled={!me.isCreator}>
                <span className="set-row__icon" aria-hidden>
                  <CalendarDays className="h-[17px] w-[17px]" strokeWidth={1.9} />
                </span>
                <span className="set-row__label">{t('Finish by')}</span>
                <span className="set-row__value">{khatmah?.finishBy ? shortDay(khatmah.finishBy) : t('No date')}</span>
                {me.isCreator ? <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} /> : null}
              </button>
            </div>
          ) : null}
        </div>
      </Rise>

      <Rise order={2}>
        <SectionLabel>{t('Invite')}</SectionLabel>
        <div className="home-card overflow-hidden rounded-2xl">
          <button
            type="button"
            className="set-row"
            onClick={() => void copyLink()}
            aria-label={copied ? t('Invite link copied') : t('Copy invite link')}
          >
            <span className="set-row__icon" aria-hidden>
              <Link2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
            </span>
            <span className="set-row__label">{t('Invite link')}</span>
            <CopyLabel copied={copied} />
          </button>
          {me.isCreator ? (
            <>
              <div className="set-row__divider" aria-hidden />
              <button
                type="button"
                className="set-row"
                style={{ paddingBlock: 9 }}
                disabled={busy}
                onClick={() => void act('new-code', {}, tr('New link made. The old one no longer works.'))}
              >
                <span className="set-row__icon" aria-hidden>
                  {pendingAction === 'new-code' ? (
                    <Loader2 className="h-[17px] w-[17px] animate-spin" strokeWidth={2} />
                  ) : (
                    <RefreshCw className="h-[17px] w-[17px]" strokeWidth={1.9} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-medium">{t('Make a new link')}</span>
                  <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">{t('The old link stops working')}</span>
                </span>
              </button>
            </>
          ) : null}
        </div>
      </Rise>

      <Rise order={3}>
        <SectionLabel>{t('Reading days · last')} {detail.windowDays} {t('days')}</SectionLabel>
        <div className="home-card overflow-hidden rounded-2xl">
          {people.map((person, i) => (
            <div key={person.id}>
              {i ? <div className="set-row__divider" style={{ marginLeft: 62 }} aria-hidden /> : null}
              <ReadingDaysRow
                name={person.name}
                me={person.isMe}
                line={person.recent}
                onOpen={
                  me.isCreator && !person.isMe
                    ? () => {
                        tapFeedback()
                        setMember(person)
                      }
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      </Rise>

      <Rise order={4} className="home-card mt-[22px] overflow-hidden rounded-2xl">
        <button type="button" className="set-row" onClick={() => open('leave')}>
          <span className="set-row__icon set-row__icon--neutral" aria-hidden>
            <LogOut className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="set-row__label">{t('Leave halaqa')}</span>
        </button>
        {me.isCreator ? (
          <>
            <div className="set-row__divider" aria-hidden />
            <button type="button" className="set-row set-row--danger" onClick={() => open('delete')}>
              <span className="set-row__icon set-row__icon--danger" aria-hidden>
                <Trash className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="set-row__label">{t('Delete halaqa')}</span>
            </button>
          </>
        ) : null}
      </Rise>

      <RenameSheet
        open={sheet === 'rename'}
        name={halaqa.name}
        busy={pendingAction === 'rename'}
        onClose={() => setSheet(null)}
        onSave={(name) => void act('rename', { name }, tr('Name saved'))}
      />
      <ScheduleSheet
        open={sheet === 'schedule'}
        endDay={halaqa.endDay}
        startDay={halaqa.startDay}
        busy={pendingAction === 'schedule'}
        onClose={() => setSheet(null)}
        onSave={(extra) => void act('schedule', extra, tr('Saved'))}
      />
      <FinishSheet
        open={sheet === 'finish'}
        day={khatmah?.finishBy ?? null}
        pending={pendingAction}
        onClose={() => setSheet(null)}
        onSave={(day) => void act('finish-by', { day }, day ? tr('Finish by {day}', { day: shortDay(day) }) : tr('No finish date'), day ? 'finish-save' : 'finish-clear')}
      />

      <SettingsSheet
        open={sheet === 'leave'}
        title={t('Leave this halaqa?')}
        description={
          me.isCreator && detail.members.length > 1
            ? t('You made this halaqa, so {member} will look after it. You can join again with the invite link.', { member: detail.members.find((p) => !p.isMe)?.name ?? 'the next member' })
            : me.isCreator
              ? t('You are the only one in it, so it will be deleted.')
              : t('Any juz you have not finished goes back for someone else. You can join again with the invite link.')
        }
        onClose={() => setSheet(null)}
      >
        <ActionButton kind="danger" busy={pendingAction === 'leave'} disabled={busy} onClick={() => void act('leave')}>
          {t('Leave')}</ActionButton>
      </SettingsSheet>

      <SettingsSheet
        open={sheet === 'delete'}
        title={t('Delete this halaqa?')}
        description={t('It will be removed for everyone in it, with its khatmah. This cannot be undone.')}
        onClose={() => setSheet(null)}
      >
        <ActionButton kind="danger" busy={pendingAction === 'delete'} disabled={busy} onClick={() => void removeHalaqa()}>
          {t('Delete halaqa')}</ActionButton>
      </SettingsSheet>

      <SettingsSheet
        open={Boolean(member)}
        title={member?.name ?? ''}
        description={member ? t('Joined {joinedAt}', { joinedAt: shortDay(localDay(new Date(member.joinedAt))) }) : undefined}
        onClose={() => {
          setMember(null)
          setConfirmRemove(false)
        }}
      >
        {member ? (
          <>
            <div className="flex items-center gap-3 rounded-[14px] bg-[var(--app-bg)] px-3.5 py-3">
              <MemberAvatar name={member.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.78125rem] font-semibold text-[var(--home-muted)]">{t('Reading days · last')} {detail.windowDays} {t('days')}</span>
                  <span className="text-[0.84375rem] font-semibold tabular-nums text-[var(--home-heading)]">
                    {member.recent.count}
                    <span className="font-medium text-[var(--home-muted)]">/{member.recent.possible}</span>
                  </span>
                </div>
                <div className="mt-2">
                  <DayDots days={member.recent.days} size={8} />
                </div>
              </div>
            </div>

            <div className="mt-3.5 overflow-hidden rounded-2xl border border-[var(--home-rule)]">
              {memberJuz.map((row) => (
                <div key={row.juz}>
                  <button
                    type="button"
                    className="set-row"
                    style={{ paddingBlock: 9 }}
                    disabled={busy}
                    onClick={() => void act('free', { juz: row.juz }, tr('Juz {juz} is free again', { juz: row.juz }), `free-${row.juz}`)}
                  >
                    <span className="set-row__icon" aria-hidden>
                      {pendingAction === `free-${row.juz}` ? (
                        <Loader2 className="h-[17px] w-[17px] animate-spin" strokeWidth={2} />
                      ) : (
                        <RefreshCw className="h-[17px] w-[17px]" strokeWidth={1.9} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-medium">{t('Free Juz')} {row.juz}</span>
                      <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">{t('Someone else can take it')}</span>
                    </span>
                  </button>
                  <div className="set-row__divider" aria-hidden />
                </div>
              ))}
              {confirmRemove ? (
                <div className="qari-enter px-3.5 py-3">
                  <p className="text-sm text-[var(--home-heading)]">
                    {t('Remove {name}? Any juz they have not finished goes back.', { name: member.name })}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      className="ed-focus fx-press h-11 rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)]"
                    >
                      {t('Keep')}</button>
                    <ActionButton
                      kind="danger"
                      busy={pendingAction === 'remove'}
                      disabled={busy}
                      className="h-11 text-sm"
                      onClick={() => void act('remove', { memberId: member.id }, `${member.name} was removed`)}
                    >
                      {t('Remove')}</ActionButton>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="set-row set-row--danger"
                  onClick={() => {
                    tapFeedback()
                    setConfirmRemove(true)
                  }}
                >
                  <span className="set-row__icon set-row__icon--danger" aria-hidden>
                    <UserMinus className="h-[17px] w-[17px]" strokeWidth={1.9} />
                  </span>
                  <span className="set-row__label">{t('Remove from halaqa')}</span>
                </button>
              )}
            </div>
          </>
        ) : null}
      </SettingsSheet>
    </HalaqaScreen>
  )
}

function RenameSheet({
  open,
  name,
  busy,
  onClose,
  onSave,
}: {
  open: boolean
  name: string
  busy: boolean
  onClose: () => void
  onSave: (name: string) => void
}) {
  const t = useT()
  const [value, setValue] = useState(name)
  const [shake, setShake] = useState(0)
  useEffect(() => {
    if (open) setValue(name)
  }, [open, name])
  const save = () => {
    if (!value.trim()) {
      errorFeedback()
      setShake((n) => n + 1)
      return
    }
    onSave(value)
  }
  return (
    <SettingsSheet open={open} title={t('Halaqa name')} onClose={onClose}>
      <input
        key={shake}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
        }}
        maxLength={50}
        aria-label={t('Halaqa name')}
        className={cn(
          'block h-[52px] w-full rounded-2xl border border-[var(--home-rule-strong)] bg-transparent px-4 text-[0.9375rem] font-medium text-[var(--home-heading)] outline-none focus:border-[var(--home-sage)]',
          shake && 'fx-shake'
        )}
        autoFocus={shake > 0}
      />
      <ActionButton busy={busy} onClick={save} className="mt-3">
        {t('Save')}</ActionButton>
    </SettingsSheet>
  )
}

function ScheduleSheet({
  open,
  startDay,
  endDay,
  busy,
  onClose,
  onSave,
}: {
  open: boolean
  startDay: string
  endDay: string | null
  busy: boolean
  onClose: () => void
  onSave: (extra: Record<string, unknown>) => void
}) {
  const t = useT()
  const today = localDay()
  const currentLength = endDay ? dayGap(startDay, endDay) + 1 : 30
  const [setTime, setSetTime] = useState(Boolean(endDay))
  const [length, setLength] = useState<7 | 30 | 40 | 'date'>(
    currentLength === 7 || currentLength === 30 || currentLength === 40 ? currentLength : 'date'
  )
  const [date, setDate] = useState(endDay && endDay > today ? endDay : addLocalDays(today, 13))

  useEffect(() => {
    if (!open) return
    setSetTime(Boolean(endDay))
    setLength(currentLength === 7 || currentLength === 30 || currentLength === 40 ? currentLength : 'date')
    setDate(endDay && endDay > today ? endDay : addLocalDays(today, 13))
  }, [open, endDay, currentLength, today])

  const save = () => {
    if (!setTime) onSave({ mode: 'every' })
    else if (length === 'date') onSave({ endDay: date })
    else onSave({ length })
  }

  return (
    <SettingsSheet
      open={open}
      title={t('How long')}
      description={setTime ? t('A set time starts again from today.') : undefined}
      onClose={onClose}
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--home-rule)]" role="radiogroup" aria-label={t('How long')}>
        {[
          { on: !setTime, Icon: InfinityIcon, title: t('Every day'), hint: t('Keeps going, no end date'), pick: () => setSetTime(false) },
          { on: setTime, Icon: Hourglass, title: t('For a set time'), hint: t('Ramadan, 30 days, 40 days'), pick: () => setSetTime(true) },
        ].map(({ on, Icon, title, hint, pick }, i) => (
          <div key={title}>
            {i ? <div className="set-row__divider" aria-hidden /> : null}
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                if (!on) tapFeedback()
                pick()
              }}
              className="set-row"
              style={{ paddingBlock: 9 }}
            >
              <span className="set-row__icon" aria-hidden>
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium">{title}</span>
                <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">{hint}</span>
              </span>
              <Radio on={on} />
            </button>
          </div>
        ))}
      </div>
      {setTime ? (
        <div className="qari-enter mt-3">
          <div className="ed-seg grid-cols-4">
            {([7, 30, 40, 'date'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  if (length !== option) tapFeedback()
                  setLength(option)
                }}
                aria-pressed={length === option}
                className="ed-seg__item ed-focus h-9 whitespace-nowrap text-[0.78125rem] font-semibold"
              >
                {option === 'date' ? t('Pick date') : t('{option} days', { option })}
              </button>
            ))}
          </div>
          {length === 'date' ? (
            <input
              type="date"
              value={date}
              min={addLocalDays(today, 1)}
              max={addLocalDays(today, 366)}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label={t('Last day')}
              className="qari-enter mt-2.5 h-11 w-full rounded-xl border border-[var(--home-rule)] bg-transparent px-3 text-sm text-[var(--home-heading)] outline-none focus:border-[var(--home-sage)]"
            />
          ) : null}
          <p className="mt-2.5 text-[0.78125rem] text-[var(--home-muted)]">
            {t('Ends')} {shortDay(length === 'date' ? date : addLocalDays(today, length - 1))}
          </p>
        </div>
      ) : null}
      <ActionButton busy={busy} onClick={save} className="mt-4">
        {t('Save')}</ActionButton>
    </SettingsSheet>
  )
}

function FinishSheet({
  open,
  day,
  pending,
  onClose,
  onSave,
}: {
  open: boolean
  day: string | null
  pending: string | null
  onClose: () => void
  onSave: (day: string | null) => void
}) {
  const t = useT()
  const today = localDay()
  const [value, setValue] = useState(day ?? '')
  useEffect(() => {
    if (open) setValue(day ?? '')
  }, [open, day])
  const busy = pending !== null
  return (
    <SettingsSheet open={open} title={t('Finish the khatmah by')} onClose={onClose}>
      <input
        type="date"
        value={value}
        min={today}
        max={addLocalDays(today, 366)}
        onChange={(e) => setValue(e.target.value)}
        aria-label={t('Finish by')}
        className="h-[52px] w-full rounded-2xl border border-[var(--home-rule-strong)] bg-transparent px-4 text-[0.9375rem] text-[var(--home-heading)] outline-none focus:border-[var(--home-sage)]"
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ActionButton kind="outline" busy={pending === 'finish-clear'} disabled={busy} onClick={() => onSave(null)} className="text-sm">
          {t('No date')}</ActionButton>
        <ActionButton busy={pending === 'finish-save'} disabled={busy || !value} onClick={() => onSave(value)}>
          {t('Save')}</ActionButton>
      </div>
    </SettingsSheet>
  )
}
