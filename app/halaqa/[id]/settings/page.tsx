'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Hourglass,
  Infinity as InfinityIcon,
  Link2,
  LogOut,
  RefreshCw,
  Trash,
  UserMinus,
} from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import Switch from '@/components/qari/Switch'
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
import { DayDots, MemberAvatar, ReadingDaysRow, byMeThenName } from '@/components/halaqa/People'
import { cn } from '@/lib/cn'
import { successFeedback } from '@/lib/haptics'
import {
  addLocalDays,
  dayGap,
  deleteHalaqa,
  getHalaqa,
  halaqaAction,
  inviteLink,
  localDay,
  shortDay,
  type HalaqaDetail,
  type HalaqaMemberView,
} from '@/lib/halaqa'

type Sheet = 'rename' | 'schedule' | 'finish' | 'leave' | 'delete' | null

const primaryButton =
  'ed-ink ed-focus flex h-12 w-full items-center justify-center rounded-full text-[0.90625rem] font-semibold transition-transform active:scale-[0.98] disabled:opacity-60'
const dangerButton =
  'ed-focus flex h-12 w-full items-center justify-center rounded-full bg-rose-600 text-[0.90625rem] font-semibold text-white disabled:opacity-60'

export default function HalaqaSettingsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<HalaqaDetail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [member, setMember] = useState<HalaqaMemberView | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
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
  }, [load])

  const act = async (action: string, extra: Record<string, unknown> = {}, done?: string) => {
    setBusy(true)
    try {
      const result = await halaqaAction(id, action, extra)
      successFeedback()
      if (result.left) {
        router.replace('/halaqa')
        return
      }
      if (done) showToast(done)
      setSheet(null)
      setMember(null)
      setConfirmRemove(false)
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not do that right now.')
    } finally {
      setBusy(false)
    }
  }

  const people = useMemo(() => [...(detail?.members ?? [])].sort(byMeThenName), [detail])

  if (!detail) {
    return (
      <HalaqaScreen>
        <HalaqaHeader title="Halaqa settings" backHref={`/halaqa/${id}`} />
        {error ? (
          <ErrorCard message={error} onRetry={() => void load()} />
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
    ? `${dayGap(halaqa.startDay, halaqa.endDay) + 1} days · ends ${shortDay(halaqa.endDay)}`
    : 'Every day'
  const khatmahActive = halaqa.khatmahEnabled && khatmah && !khatmah.completedAt
  const memberJuz = member && khatmah ? khatmah.juz.filter((row) => row.memberId === member.id && !row.done) : []

  const copyLink = async () => {
    showToast((await copyText(inviteLink(halaqa.code))) ? 'Invite link copied.' : 'Could not copy the link.')
  }

  const removeHalaqa = async () => {
    setBusy(true)
    try {
      await deleteHalaqa(id)
      router.replace('/halaqa')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete the halaqa.')
      setBusy(false)
    }
  }

  return (
    <HalaqaScreen>
      <HalaqaHeader title="Halaqa settings" backHref={`/halaqa/${id}`} />

      <button
        type="button"
        onClick={() => me.isCreator && setSheet('rename')}
        disabled={!me.isCreator}
        className="home-card home-press ed-focus mt-[18px] flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left disabled:active:scale-100"
      >
        <span className="home-serif flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[var(--home-sage-soft)] text-xl font-semibold text-[var(--home-sage-deep)]">
          {(halaqa.name.trim().charAt(0) || 'H').toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-[var(--home-heading)]">{halaqa.name}</span>
          <span className="mt-px block truncate text-[0.8125rem] text-[var(--home-muted)]">
            {me.isCreator ? 'Created by you' : `Created by ${creator?.name ?? 'someone'}`} · {detail.members.length}{' '}
            {detail.members.length === 1 ? 'member' : 'members'}
          </span>
        </span>
        {me.isCreator ? <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} /> : null}
      </button>

      <SectionLabel>Halaqa</SectionLabel>
      <div className="home-card overflow-hidden rounded-2xl">
        <button type="button" className="set-row" onClick={() => me.isCreator && setSheet('schedule')} disabled={!me.isCreator}>
          <span className="set-row__icon" aria-hidden>
            {halaqa.endDay ? <Hourglass className="h-[17px] w-[17px]" strokeWidth={1.9} /> : <InfinityIcon className="h-[17px] w-[17px]" strokeWidth={1.9} />}
          </span>
          <span className="set-row__label">How long</span>
          <span className="set-row__value">{scheduleValue}</span>
          {me.isCreator ? <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} /> : null}
        </button>
        <div className="set-row__divider" aria-hidden />
        {me.isCreator ? (
          <label className="set-row cursor-pointer">
            <span className="set-row__icon" aria-hidden>
              <BookOpen className="h-[17px] w-[17px]" strokeWidth={1.9} />
            </span>
            <span className="set-row__label">Khatmah together</span>
            <Switch
              checked={halaqa.khatmahEnabled}
              onChange={(enabled) => void act('khatmah', { enabled }, enabled ? 'Khatmah is on.' : 'Khatmah is off.')}
              label="Khatmah together"
            />
          </label>
        ) : (
          <div className="set-row">
            <span className="set-row__icon" aria-hidden>
              <BookOpen className="h-[17px] w-[17px]" strokeWidth={1.9} />
            </span>
            <span className="set-row__label">Khatmah together</span>
            <span className="set-row__value">{halaqa.khatmahEnabled ? 'On' : 'Off'}</span>
          </div>
        )}
        {khatmahActive ? (
          <>
            <div className="set-row__divider" aria-hidden />
            <button type="button" className="set-row" onClick={() => me.isCreator && setSheet('finish')} disabled={!me.isCreator}>
              <span className="set-row__icon" aria-hidden>
                <CalendarDays className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="set-row__label">Finish by</span>
              <span className="set-row__value">{khatmah?.finishBy ? shortDay(khatmah.finishBy) : 'No date'}</span>
              {me.isCreator ? <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} /> : null}
            </button>
          </>
        ) : null}
      </div>

      <SectionLabel>Invite</SectionLabel>
      <div className="home-card overflow-hidden rounded-2xl">
        <button type="button" className="set-row" onClick={() => void copyLink()}>
          <span className="set-row__icon" aria-hidden>
            <Link2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="set-row__label">Invite link</span>
          <span className="shrink-0 text-sm font-semibold text-[var(--home-sage-deep)]">Copy</span>
        </button>
        {me.isCreator ? (
          <>
            <div className="set-row__divider" aria-hidden />
            <button
              type="button"
              className="set-row"
              style={{ paddingBlock: 9 }}
              disabled={busy}
              onClick={() => void act('new-code', {}, 'New link made. The old one no longer works.')}
            >
              <span className="set-row__icon" aria-hidden>
                <RefreshCw className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium">Make a new link</span>
                <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">The old link stops working</span>
              </span>
            </button>
          </>
        ) : null}
      </div>

      <SectionLabel>Reading days · last {detail.windowDays} days</SectionLabel>
      <div className="home-card overflow-hidden rounded-2xl">
        {people.map((person, i) => (
          <div key={person.id}>
            {i ? <div className="set-row__divider" style={{ marginLeft: 62 }} aria-hidden /> : null}
            <ReadingDaysRow
              name={person.name}
              me={person.isMe}
              line={person.recent}
              onOpen={me.isCreator && !person.isMe ? () => setMember(person) : undefined}
            />
          </div>
        ))}
      </div>

      <div className="home-card mt-[22px] overflow-hidden rounded-2xl">
        <button type="button" className="set-row" onClick={() => setSheet('leave')}>
          <span className="set-row__icon set-row__icon--neutral" aria-hidden>
            <LogOut className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="set-row__label">Leave halaqa</span>
        </button>
        {me.isCreator ? (
          <>
            <div className="set-row__divider" aria-hidden />
            <button type="button" className="set-row set-row--danger" onClick={() => setSheet('delete')}>
              <span className="set-row__icon set-row__icon--danger" aria-hidden>
                <Trash className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="set-row__label">Delete halaqa</span>
            </button>
          </>
        ) : null}
      </div>

      <RenameSheet open={sheet === 'rename'} name={halaqa.name} busy={busy} onClose={() => setSheet(null)} onSave={(name) => void act('rename', { name }, 'Name saved.')} />
      <ScheduleSheet
        open={sheet === 'schedule'}
        endDay={halaqa.endDay}
        startDay={halaqa.startDay}
        busy={busy}
        onClose={() => setSheet(null)}
        onSave={(extra) => void act('schedule', extra, 'Saved.')}
      />
      <FinishSheet
        open={sheet === 'finish'}
        day={khatmah?.finishBy ?? null}
        busy={busy}
        onClose={() => setSheet(null)}
        onSave={(day) => void act('finish-by', { day }, 'Saved.')}
      />

      <SettingsSheet
        open={sheet === 'leave'}
        title="Leave this halaqa?"
        description={
          me.isCreator && detail.members.length > 1
            ? `You made this halaqa, so ${detail.members.find((p) => !p.isMe)?.name ?? 'the next member'} will look after it. You can join again with the invite link.`
            : me.isCreator
              ? 'You are the only one in it, so it will be deleted.'
              : 'Any juz you have not finished goes back for someone else. You can join again with the invite link.'
        }
        onClose={() => setSheet(null)}
      >
        <button type="button" disabled={busy} onClick={() => void act('leave')} className={dangerButton}>
          Leave
        </button>
      </SettingsSheet>

      <SettingsSheet
        open={sheet === 'delete'}
        title="Delete this halaqa?"
        description="It will be removed for everyone in it, with its khatmah. This cannot be undone."
        onClose={() => setSheet(null)}
      >
        <button type="button" disabled={busy} onClick={() => void removeHalaqa()} className={dangerButton}>
          Delete halaqa
        </button>
      </SettingsSheet>

      <SettingsSheet
        open={Boolean(member)}
        title={member?.name ?? ''}
        description={member ? `Joined ${shortDay(localDay(new Date(member.joinedAt)))}` : undefined}
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
                  <span className="text-[0.78125rem] font-semibold text-[var(--home-muted)]">Reading days · last {detail.windowDays} days</span>
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
                    onClick={() => void act('free', { juz: row.juz }, `Juz ${row.juz} is free again.`)}
                  >
                    <span className="set-row__icon" aria-hidden>
                      <RefreshCw className="h-[17px] w-[17px]" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-medium">Free Juz {row.juz}</span>
                      <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">Someone else can take it</span>
                    </span>
                  </button>
                  <div className="set-row__divider" aria-hidden />
                </div>
              ))}
              {confirmRemove ? (
                <div className="px-3.5 py-3">
                  <p className="text-sm text-[var(--home-heading)]">
                    Remove {member.name}? Any juz they have not finished goes back.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      className="ed-focus h-11 rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)]"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act('remove', { memberId: member.id }, `${member.name} was removed.`)}
                      className="ed-focus h-11 rounded-full bg-rose-600 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="set-row set-row--danger" onClick={() => setConfirmRemove(true)}>
                  <span className="set-row__icon set-row__icon--danger" aria-hidden>
                    <UserMinus className="h-[17px] w-[17px]" strokeWidth={1.9} />
                  </span>
                  <span className="set-row__label">Remove from halaqa</span>
                </button>
              )}
            </div>
          </>
        ) : null}
      </SettingsSheet>

      <Toast message={toast} />
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
  const [value, setValue] = useState(name)
  useEffect(() => {
    if (open) setValue(name)
  }, [open, name])
  return (
    <SettingsSheet open={open} title="Halaqa name" onClose={onClose}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={50}
        aria-label="Halaqa name"
        className="block h-[52px] w-full rounded-2xl border border-[var(--home-rule-strong)] bg-transparent px-4 text-[0.9375rem] font-medium text-[var(--home-heading)] outline-none focus:border-[var(--home-sage)]"
      />
      <button type="button" disabled={busy || !value.trim()} onClick={() => onSave(value)} className={cn(primaryButton, 'mt-3')}>
        Save
      </button>
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
      title="How long"
      description={setTime ? 'A set time starts again from today.' : undefined}
      onClose={onClose}
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--home-rule)]" role="radiogroup" aria-label="How long">
        {[
          { on: !setTime, Icon: InfinityIcon, title: 'Every day', hint: 'Keeps going, no end date', pick: () => setSetTime(false) },
          { on: setTime, Icon: Hourglass, title: 'For a set time', hint: 'Ramadan, 30 days, 40 days', pick: () => setSetTime(true) },
        ].map(({ on, Icon, title, hint, pick }, i) => (
          <div key={title}>
            {i ? <div className="set-row__divider" aria-hidden /> : null}
            <button type="button" role="radio" aria-checked={on} onClick={pick} className="set-row" style={{ paddingBlock: 9 }}>
              <span className="set-row__icon" aria-hidden>
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium">{title}</span>
                <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">{hint}</span>
              </span>
              <span
                className={cn(
                  'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full',
                  on ? 'bg-[var(--home-sage)]' : 'border-[1.5px] border-[var(--home-rule-strong)]'
                )}
                aria-hidden
              >
                {on ? <span className="h-2 w-2 rounded-full bg-[var(--home-ink-fg)]" /> : null}
              </span>
            </button>
          </div>
        ))}
      </div>
      {setTime ? (
        <div className="mt-3">
          <div className="ed-seg grid-cols-4">
            {([7, 30, 40, 'date'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLength(option)}
                aria-pressed={length === option}
                className="ed-seg__item ed-focus h-9 whitespace-nowrap text-[0.78125rem] font-semibold"
              >
                {option === 'date' ? 'Pick date' : `${option} days`}
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
              aria-label="Last day"
              className="mt-2.5 h-11 w-full rounded-xl border border-[var(--home-rule)] bg-transparent px-3 text-sm text-[var(--home-heading)] outline-none focus:border-[var(--home-sage)]"
            />
          ) : null}
          <p className="mt-2.5 text-[0.78125rem] text-[var(--home-muted)]">
            Ends {shortDay(length === 'date' ? date : addLocalDays(today, length - 1))}
          </p>
        </div>
      ) : null}
      <button type="button" disabled={busy} onClick={save} className={cn(primaryButton, 'mt-4')}>
        Save
      </button>
    </SettingsSheet>
  )
}

function FinishSheet({
  open,
  day,
  busy,
  onClose,
  onSave,
}: {
  open: boolean
  day: string | null
  busy: boolean
  onClose: () => void
  onSave: (day: string | null) => void
}) {
  const today = localDay()
  const [value, setValue] = useState(day ?? '')
  useEffect(() => {
    if (open) setValue(day ?? '')
  }, [open, day])
  return (
    <SettingsSheet open={open} title="Finish the khatmah by" onClose={onClose}>
      <input
        type="date"
        value={value}
        min={today}
        max={addLocalDays(today, 366)}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Finish by"
        className="h-[52px] w-full rounded-2xl border border-[var(--home-rule-strong)] bg-transparent px-4 text-[0.9375rem] text-[var(--home-heading)] outline-none focus:border-[var(--home-sage)]"
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(null)}
          className="ed-focus h-12 rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] disabled:opacity-60"
        >
          No date
        </button>
        <button type="button" disabled={busy || !value} onClick={() => onSave(value)} className={primaryButton}>
          Save
        </button>
      </div>
    </SettingsSheet>
  )
}
