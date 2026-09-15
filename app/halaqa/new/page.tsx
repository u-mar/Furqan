'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { BookOpen, CalendarDays, Hourglass, Infinity as InfinityIcon } from 'lucide-react'
import Radio from '@/components/settings/Radio'
import Switch from '@/components/qari/Switch'
import { ActionButton, HalaqaHeader, HalaqaScreen, SectionLabel } from '@/components/halaqa/HalaqaScreen'
import { getSignedInUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import { addLocalDays, createHalaqa, localDay, savedMemberName, shortDay } from '@/lib/halaqa'
import { errorMessage } from '@/lib/toast'

type Length = 7 | 30 | 40 | 'date'
type Field = 'name' | 'memberName'

const inputClass =
  'block h-[52px] w-full rounded-2xl bg-[var(--home-card-bg)] px-4 text-[0.9375rem] font-medium text-[var(--home-heading)] shadow-[var(--home-lift)] outline-none transition-shadow placeholder:font-normal placeholder:text-[var(--home-muted)] focus:ring-2 focus:ring-[var(--home-sage)]'

export default function NewHalaqaPage() {
  const router = useRouter()
  const today = localDay()
  const [name, setName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [setTime, setSetTime] = useState(false)
  const [length, setLength] = useState<Length>(30)
  const [endDay, setEndDay] = useState(addLocalDays(today, 13))
  const [khatmah, setKhatmah] = useState(false)
  const [finishBy, setFinishBy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** The field that stopped the form, and a counter so it shakes again on the next try. */
  const [missing, setMissing] = useState<{ field: Field; n: number } | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const memberInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMemberName(getSignedInUser()?.name || savedMemberName())
  }, [])

  const lastDay = setTime ? (length === 'date' ? endDay : addLocalDays(today, length - 1)) : null

  // The shaken field is drawn afresh, so it takes the focus once it is back.
  useEffect(() => {
    if (missing) (missing.field === 'name' ? nameInput : memberInput).current?.focus()
  }, [missing])

  const stop = (field: Field, message: string) => {
    errorFeedback()
    setError(message)
    setMissing((m) => ({ field, n: (m?.n ?? 0) + 1 }))
  }

  const submit = async () => {
    if (busy) return
    setError('')
    if (!name.trim()) return stop('name', 'Give the halaqa a name.')
    if (!memberName.trim()) return stop('memberName', 'Add your name so the others know who you are.')
    setBusy(true)
    try {
      const { id } = await createHalaqa({
        name,
        memberName,
        length: setTime && length !== 'date' ? length : undefined,
        endDay: setTime && length === 'date' ? endDay : null,
        khatmah,
        finishBy: khatmah ? finishBy || lastDay : null,
      })
      successFeedback()
      router.replace(`/halaqa/${id}/invite`)
    } catch (err) {
      errorFeedback()
      setError(errorMessage(err, 'Could not start the halaqa.'))
      setBusy(false)
    }
  }

  const shakeClass = (field: Field) => (missing?.field === field ? 'fx-shake' : '')

  return (
    <HalaqaScreen>
      <HalaqaHeader title="New halaqa" />

      <SectionLabel>Name</SectionLabel>
      <input
        ref={nameInput}
        key={missing?.field === 'name' ? `name-${missing.n}` : 'name'}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          if (missing?.field === 'name') setError('')
        }}
        maxLength={50}
        placeholder="e.g. Family Quran"
        aria-label="Halaqa name"
        aria-invalid={missing?.field === 'name' && !name.trim() ? true : undefined}
        className={cn(inputClass, shakeClass('name'))}
      />

      <SectionLabel>Your name</SectionLabel>
      <input
        ref={memberInput}
        key={missing?.field === 'memberName' ? `member-${missing.n}` : 'member'}
        value={memberName}
        onChange={(e) => {
          setMemberName(e.target.value)
          if (missing?.field === 'memberName') setError('')
        }}
        maxLength={40}
        placeholder="How the others will see you"
        aria-label="Your name"
        aria-invalid={missing?.field === 'memberName' && !memberName.trim() ? true : undefined}
        className={cn(inputClass, shakeClass('memberName'))}
      />

      <SectionLabel>How long</SectionLabel>
      <div className="home-card overflow-hidden rounded-2xl" role="radiogroup" aria-label="How long">
        <button
          type="button"
          role="radio"
          aria-checked={!setTime}
          onClick={() => {
            if (setTime) tapFeedback()
            setSetTime(false)
          }}
          className="set-row"
          style={{ paddingBlock: 9 }}
        >
          <span className="set-row__icon" aria-hidden>
            <InfinityIcon className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-medium">Every day</span>
            <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">Keeps going, no end date</span>
          </span>
          <Radio on={!setTime} />
        </button>
        <div className="set-row__divider" aria-hidden />
        <button
          type="button"
          role="radio"
          aria-checked={setTime}
          onClick={() => {
            if (!setTime) tapFeedback()
            setSetTime(true)
          }}
          className="set-row"
          style={{ paddingBlock: 9 }}
        >
          <span className="set-row__icon" aria-hidden>
            <Hourglass className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-medium">For a set time</span>
            <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">Ramadan, 30 days, 40 days</span>
          </span>
          <Radio on={setTime} />
        </button>
        {setTime ? (
          <div className="qari-enter pb-3.5 pl-14 pr-3.5 pt-0.5">
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
                  {option === 'date' ? 'Pick date' : `${option} days`}
                </button>
              ))}
            </div>
            {length === 'date' ? (
              <input
                type="date"
                value={endDay}
                min={addLocalDays(today, 1)}
                max={addLocalDays(today, 366)}
                onChange={(e) => e.target.value && setEndDay(e.target.value)}
                aria-label="Last day"
                className="qari-enter mt-2.5 h-10 w-full rounded-xl border border-[var(--home-rule)] bg-transparent px-3 text-sm text-[var(--home-heading)] outline-none focus:border-[var(--home-sage)]"
              />
            ) : null}
            {lastDay ? (
              <p className="mt-2.5 text-[0.78125rem] text-[var(--home-muted)]">Ends {shortDay(lastDay)}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <SectionLabel>Khatmah</SectionLabel>
      <div className="home-card overflow-hidden rounded-2xl">
        <label className="set-row cursor-pointer" style={{ paddingBlock: 9 }}>
          <span className="set-row__icon" aria-hidden>
            <BookOpen className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-medium">Khatmah together</span>
            <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">Split the 30 juz between members</span>
          </span>
          <Switch checked={khatmah} onChange={setKhatmah} label="Khatmah together" />
        </label>
        {khatmah ? (
          <div className="qari-enter">
            <div className="set-row__divider" aria-hidden />
            <label className="set-row">
              <span className="set-row__icon" aria-hidden>
                <CalendarDays className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="set-row__label">Finish by</span>
              <input
                type="date"
                value={finishBy || lastDay || ''}
                min={today}
                max={addLocalDays(today, 366)}
                onChange={(e) => setFinishBy(e.target.value)}
                aria-label="Finish the khatmah by"
                className={cn(
                  'h-9 rounded-lg bg-transparent px-1 text-right text-sm outline-none',
                  finishBy || lastDay ? 'text-[var(--home-heading)]' : 'text-[var(--home-muted)]'
                )}
              />
            </label>
          </div>
        ) : null}
      </div>

      {error ? (
        <p key={missing?.n ?? error} className="qari-enter mt-4 text-center text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : null}

      <ActionButton busy={busy} onClick={() => void submit()} className="mt-6">
        {busy ? 'Creating…' : 'Create halaqa'}
      </ActionButton>
      <p className="mt-3 text-center text-[0.78125rem] text-[var(--home-muted)]">You can change all of this later.</p>
    </HalaqaScreen>
  )
}
