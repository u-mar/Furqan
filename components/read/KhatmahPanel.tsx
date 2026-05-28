'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, ChevronLeft, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useDayBounds } from '@/hooks/useDayBounds'
import {
  addKhatmahPlan,
  createKhatmahPlan,
  dayScheduleLabel,
  deleteKhatmahPlan,
  durationLabel,
  firstIncompleteDay,
  getKhatmahPlans,
  markDayComplete,
  type KhatmahDuration,
  type KhatmahPlan,
} from '@/lib/khatmah'

interface KhatmahPanelProps {
  onGoToPage: (page: number) => void
  onClose: () => void
}

type Screen = 'day' | 'allDays'

interface KhatmahContextValue {
  plans: KhatmahPlan[]
  activePlan: KhatmahPlan | undefined
  currentDay: KhatmahPlan['days'][number] | undefined
  focusDay: number
  selectedDay: number
  screen: Screen
  showNew: boolean
  setScreen: (s: Screen) => void
  setShowNew: (v: boolean) => void
  setSelectedDay: (d: number) => void
  setActivePlanId: (id: string) => void
  handleCreate: (duration: KhatmahDuration) => Promise<void>
  creating: boolean
  handleComplete: () => void
  handleDelete: () => void
  onGoToPage: (page: number) => void
  onClose: () => void
}

const KhatmahContext = createContext<KhatmahContextValue | null>(null)

function useKhatmah(): KhatmahContextValue {
  const ctx = useContext(KhatmahContext)
  if (!ctx) throw new Error('useKhatmah must be used within KhatmahProvider')
  return ctx
}

function KhatmahProvider({
  children,
  onGoToPage,
  onClose,
}: KhatmahPanelProps & { children: ReactNode }) {
  const [plans, setPlans] = useState<KhatmahPlan[]>([])
  const [activePlanId, setActivePlanId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState(1)
  const [screen, setScreen] = useState<Screen>('day')
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const stored = getKhatmahPlans()
    setPlans(stored)
    if (stored.length > 0) {
      setActivePlanId(stored[0].id)
      setSelectedDay(firstIncompleteDay(stored[0]))
    }
  }, [])

  const activePlan = plans.find((p) => p.id === activePlanId) ?? plans[0]
  const focusDay = activePlan ? firstIncompleteDay(activePlan) : 1
  const currentDay = activePlan?.days.find((d) => d.day === selectedDay)

  const refreshPlans = useCallback(() => {
    const stored = getKhatmahPlans()
    setPlans(stored)
    if (stored.length === 0) {
      setActivePlanId(null)
      return
    }
    if (!stored.some((p) => p.id === activePlanId)) {
      setActivePlanId(stored[0].id)
      setSelectedDay(firstIncompleteDay(stored[0]))
    }
  }, [activePlanId])

  const handleCreate = useCallback(async (duration: KhatmahDuration) => {
    setCreating(true)
    try {
      const plan = await createKhatmahPlan(duration)
      addKhatmahPlan(plan)
      setPlans(getKhatmahPlans())
      setActivePlanId(plan.id)
      setSelectedDay(1)
      setScreen('day')
      setShowNew(false)
    } finally {
      setCreating(false)
    }
  }, [])

  const handleComplete = useCallback(() => {
    if (!activePlan || !currentDay || currentDay.completed) return

    markDayComplete(activePlan.id, currentDay.day, true)
    const updated = getKhatmahPlans().find((p) => p.id === activePlan.id)
    setPlans(getKhatmahPlans())

    if (!updated) return

    const nextDayNum = currentDay.day + 1
    const hasNext = updated.days.some((d) => d.day === nextDayNum)
    if (hasNext) {
      setSelectedDay(nextDayNum)
    } else {
      setSelectedDay(firstIncompleteDay(updated))
    }
  }, [activePlan, currentDay])

  const handleDelete = useCallback(() => {
    if (!activePlan) return
    if (!confirm('Delete this khatmah plan?')) return
    deleteKhatmahPlan(activePlan.id)
    refreshPlans()
    setScreen('day')
  }, [activePlan, refreshPlans])

  const value = useMemo<KhatmahContextValue>(
    () => ({
      plans,
      activePlan,
      currentDay,
      focusDay,
      selectedDay,
      screen,
      showNew,
      setScreen,
      setShowNew,
      setSelectedDay,
      setActivePlanId,
      handleCreate,
      creating,
      handleComplete,
      handleDelete,
      onGoToPage,
      onClose,
    }),
    [
      plans,
      activePlan,
      currentDay,
      focusDay,
      selectedDay,
      screen,
      showNew,
      creating,
      handleCreate,
      handleComplete,
      handleDelete,
      onGoToPage,
      onClose,
    ]
  )

  return <KhatmahContext.Provider value={value}>{children}</KhatmahContext.Provider>
}

function KhatmahNewScreen() {
  const { plans, handleCreate, creating, setShowNew, showNew } = useKhatmah()

  if (!showNew && plans.length > 0) return null

  return (
    <div className="flex h-full flex-col px-5 pb-8">
      <h1 className="pt-4 text-3xl font-semibold text-white">Khatmah</h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-500">
        Create a plan to finish the Quran on schedule.
      </p>

      <div className="mt-10 rounded-2xl bg-[#1c1c1e] p-5">
        <p className="mb-4 text-sm text-stone-400">Choose duration</p>
        <div className="flex flex-col gap-3">
          {(['1week', '1month', '2months'] as KhatmahDuration[]).map((d) => (
            <button
              key={d}
              type="button"
              disabled={creating}
              onClick={() => void handleCreate(d)}
              className="rounded-xl bg-teal-500/15 py-3.5 text-sm font-medium text-teal-400 disabled:opacity-50"
            >
              {creating ? 'Creating plan…' : durationLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {plans.length > 0 && (
        <button
          type="button"
          onClick={() => setShowNew(false)}
          className="mt-6 text-sm text-stone-500"
        >
          Cancel
        </button>
      )}
    </div>
  )
}

function KhatmahAllDaysScreen() {
  const { activePlan, focusDay, screen, setScreen, setSelectedDay, selectedDay } = useKhatmah()

  if (screen !== 'allDays' || !activePlan) return null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <button
        type="button"
        onClick={() => setScreen('day')}
        className="flex shrink-0 items-center gap-2 px-5 pt-4 text-teal-400"
      >
        <ChevronLeft className="h-5 w-5" />
        <span className="text-sm font-medium">Back</span>
      </button>
      <h1 className="shrink-0 px-5 pt-4 text-2xl font-semibold text-white">All Days</h1>
      <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-8 pt-6">
        {activePlan.days.map((day) => (
          <li key={day.day}>
            <button
              type="button"
              onClick={() => {
                setSelectedDay(day.day)
                setScreen('day')
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-2xl bg-[#1c1c1e] px-5 py-4 text-left',
                selectedDay === day.day && 'ring-1 ring-teal-500/50'
              )}
            >
              <div>
                <span className="font-medium text-white">Day {day.day}</span>
                <span className="mt-1 block text-xs text-stone-500">
                  {day.juzLabel ? `${day.juzLabel} · ` : ''}p.{day.startPage}–{day.endPage}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {day.completed && <CheckCircle2 className="h-5 w-5 text-teal-500" />}
                <span className="text-sm text-stone-500">
                  {dayScheduleLabel(day.day, focusDay)}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ayahPreview(text: string | undefined): string {
  if (!text) return ''
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length > 9 ? `${words.slice(0, 9).join(' ')}…` : words.join(' ')
}

function KhatmahDayContent() {
  const {
    activePlan,
    currentDay,
    focusDay,
    plans,
    screen,
    setActivePlanId,
    setSelectedDay,
    selectedDay,
  } = useKhatmah()

  const { bounds, loading: boundsLoading } = useDayBounds(
    currentDay?.startPage ?? 0,
    currentDay?.endPage ?? 0,
    Boolean(currentDay && screen === 'day')
  )

  if (screen !== 'day' || !activePlan || !currentDay) return null

  return (
  <div className="shrink-0 px-5 pb-4 pt-4">
        <div className="flex items-start justify-between">
          <h1 className="text-3xl font-semibold text-white">Khatmah</h1>
          {plans.length > 1 && (
            <select
              value={activePlan.id}
              onChange={(e) => {
                const plan = plans.find((p) => p.id === e.target.value)
                if (plan) {
                  setActivePlanId(plan.id)
                  setSelectedDay(firstIncompleteDay(plan))
                }
              }}
              className="mt-2 rounded-lg bg-[#1c1c1e] px-2 py-1.5 text-xs text-stone-400"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={selectedDay <= 1}
              onClick={() => setSelectedDay(selectedDay - 1)}
              className="rounded-lg p-2 text-teal-400 disabled:opacity-30"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-[5rem] text-center text-base font-medium text-white">
              Day {currentDay.day}
            </span>
            <button
              type="button"
              disabled={selectedDay >= activePlan.totalDays}
              onClick={() => setSelectedDay(selectedDay + 1)}
              className="rounded-lg p-2 text-teal-400 disabled:opacity-30"
              aria-label="Next day"
            >
              <ChevronLeft className="h-5 w-5 rotate-180" />
            </button>
          </div>
          <span className="text-xs text-stone-500">{dayScheduleLabel(currentDay.day, focusDay)}</span>
        </div>

        {currentDay.juzLabel ? (
          <p className="mt-2 text-center text-xs font-medium text-teal-400/90">{currentDay.juzLabel}</p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <section className="rounded-xl bg-[#1c1c1e] px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">From</p>
            <p className="mt-0.5 text-xs text-stone-300">
              {bounds ? `${bounds.from.surahName} ${bounds.from.ayah}` : '…'}
              <span className="text-stone-500"> · p.{currentDay.startPage}</span>
            </p>
            <p
              className="arabic-text mt-1 line-clamp-1 text-right text-[13px] leading-snug text-white/75"
              dir="rtl"
            >
              {boundsLoading ? '…' : ayahPreview(bounds?.from.arabic) || '…'}
            </p>
          </section>

          <section className="rounded-xl bg-[#1c1c1e] px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">To</p>
            <p className="mt-0.5 text-xs text-stone-300">
              {bounds ? `${bounds.to.surahName} ${bounds.to.ayah}` : '…'}
              <span className="text-stone-500"> · p.{currentDay.endPage}</span>
            </p>
            <p
              className="arabic-text mt-1 line-clamp-1 text-right text-[13px] leading-snug text-white/75"
              dir="rtl"
            >
              {boundsLoading ? '…' : ayahPreview(bounds?.to.arabic) || '…'}
            </p>
          </section>
        </div>
    </div>
  )
}

export function KhatmahActionBar() {
  const { activePlan, currentDay, handleComplete, onClose, onGoToPage, screen } = useKhatmah()

  if (screen !== 'day' || !activePlan || !currentDay) return null

  const allDone = activePlan.days.every((d) => d.completed)

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#0d0d0d] px-5 py-4">
      <button
        type="button"
        onClick={handleComplete}
        disabled={currentDay.completed || allDone}
        className={cn(
          'flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-base font-semibold transition-colors',
          currentDay.completed || allDone
            ? 'bg-teal-900/30 text-teal-500/80'
            : 'bg-teal-400 text-black active:bg-teal-300'
        )}
      >
        <CheckCircle2 className="h-5 w-5" />
        {currentDay.completed ? 'Completed' : 'Complete This Day'}
      </button>

      {!currentDay.completed && (
        <button
          type="button"
          onClick={() => {
            onGoToPage(currentDay.startPage)
            onClose()
          }}
          className="mt-3 w-full py-2 text-center text-sm font-medium text-teal-400"
        >
          Start reading
        </button>
      )}
    </div>
  )
}

function KhatmahFooterActions() {
  const { activePlan, handleDelete, screen, setScreen, setShowNew } = useKhatmah()

  if (screen !== 'day' || !activePlan) return null

  return (
    <div className="shrink-0 border-t border-white/5 px-5 pb-4 pt-4">
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setScreen('allDays')}
          className="flex w-full items-center justify-between rounded-2xl bg-[#1c1c1e] px-5 py-4 text-left"
        >
          <span className="font-medium text-white">All Days</span>
          <span className="text-lg text-stone-500">{activePlan.totalDays}</span>
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="w-full rounded-2xl bg-[#1c1c1e] px-5 py-4 text-center font-medium text-rose-400"
        >
          Delete Khatmah
        </button>

        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex w-full items-center justify-center gap-2 py-4 text-sm text-stone-500"
        >
          <Plus className="h-4 w-4" />
          New plan
        </button>
      </div>
    </div>
  )
}

function KhatmahInner() {
  const { plans, showNew, screen } = useKhatmah()

  if (showNew || plans.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <KhatmahNewScreen />
      </div>
    )
  }

  if (screen === 'allDays') {
    return (
      <div className="min-h-0 flex-1 overflow-hidden">
        <KhatmahAllDaysScreen />
      </div>
    )
  }

  return <KhatmahDayContent />
}

export default function KhatmahPanel(props: KhatmahPanelProps) {
  return (
    <KhatmahProvider {...props}>
      <KhatmahInner />
    </KhatmahProvider>
  )
}

export function KhatmahDrawerLayout(props: KhatmahPanelProps) {
  return (
    <KhatmahProvider {...props}>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <KhatmahInner />
        </div>
        <KhatmahActionBar />
        <KhatmahFooterActions />
      </div>
    </KhatmahProvider>
  )
}
