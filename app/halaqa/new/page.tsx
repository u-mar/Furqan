'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, Hourglass, Infinity as InfinityIcon } from 'lucide-react'
import Switch from '@/components/qari/Switch'
import { HalaqaHeader, HalaqaScreen, SectionLabel } from '@/components/halaqa/HalaqaScreen'
import { getSignedInUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { addLocalDays, createHalaqa, localDay, savedMemberName, shortDay } from '@/lib/halaqa'

type Length = 7 | 30 | 40 | 'date'

const inputClass =
  'block h-[52px] w-full rounded-2xl bg-[var(--home-card-bg)] px-4 text-[0.9375rem] font-medium text-[var(--home-heading)] shadow-[var(--home-lift)] outline-none placeholder:font-normal placeholder:text-[var(--home-muted)] focus:ring-2 focus:ring-[var(--home-sage)]'

function Radio({ on }: { on: boolean }) {
  return on ? (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--home-sage)]" aria-hidden>
      <span className="h-2 w-2 rounded-full bg-[var(--home-ink-fg)]" />
    </span>
  ) : (
    <span className="h-[22px] w-[22px] shrink-0 rounded-full border-[1.5px] border-[var(--home-rule-strong)]" aria-hidden />
  )
}

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

  useEffect(() => {
    setMemberName(getSignedInUser()?.name || savedMemberName())
  }, [])

  const lastDay = setTime ? (length === 'date' ? endDay : addLocalDays(today, length - 1)) : null

  const submit = async () => {
    if (busy) return
    setError('')
    if (!name.trim()) return setError('Give the halaqa a name.')
    if (!memberName.trim()) return setError('Add your name so the others know who you are.')
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
      router.replace(`/halaqa/${id}/invite`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the halaqa.')
      setBusy(false)
    }
  }

  return (
    <HalaqaScreen>
      <HalaqaHeader title="New halaqa" />

      <SectionLabel>Name</SectionLabel>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={50}
        placeholder="e.g. Family Quran"
        aria-label="Halaqa name"
        className={inputClass}
      />

      <SectionLabel>Your name</SectionLabel>
      <input
        value={memberName}
        onChange={(e) => setMemberName(e.target.value)}
        maxLength={40}
        placeholder="How the others will see you"
        aria-label="Your name"
        className={inputClass}
      />

      <SectionLabel>How long</SectionLabel>
      <div className="home-card overflow-hidden rounded-2xl" role="radiogroup" aria-label="How long">
        <button type="button" role="radio" aria-checked={!setTime} onClick={() => setSetTime(false)} className="set-row" style={{ paddingBlock: 9 }}>
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
        <button type="button" role="radio" aria-checked={setTime} onClick={() => setSetTime(true)} className="set-row" style={{ paddingBlock: 9 }}>
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
          <div className="pb-3.5 pl-14 pr-3.5 pt-0.5">
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
                value={endDay}
                min={addLocalDays(today, 1)}
                max={addLocalDays(today, 366)}
                onChange={(e) => e.target.value && setEndDay(e.target.value)}
                aria-label="Last day"
                className="mt-2.5 h-10 w-full rounded-xl border border-[var(--home-rule)] bg-transparent px-3 text-sm text-[var(--home-heading)] outline-none focus:border-[var(--home-sage)]"
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
          <>
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
          </>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 text-center text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className="ed-ink ed-focus mt-6 flex h-12 w-full items-center justify-center rounded-full text-[0.90625rem] font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? 'Starting…' : 'Create halaqa'}
      </button>
      <p className="mt-3 text-center text-[0.78125rem] text-[var(--home-muted)]">You can change all of this later.</p>
    </HalaqaScreen>
  )
}
