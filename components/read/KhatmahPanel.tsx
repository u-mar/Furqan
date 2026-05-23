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
  updateKhatmahPlan,
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
  handleCreate: (duration: KhatmahDuration) => void
  handleComplete: () => void
  handleDelete: () => void
  toggleReminder: () => void
  onGoToPage: (page: number) => void
  onClose: () => void
}

const KhatmahContext = createContext<KhatmahContextValue | null>(null)

function useKhatmah(): KhatmahContextValue {
  const ctx = useContext(KhatmahContext)
  if (!ctx) throw new Error('useKhatmah must be used within KhatmahProvider')
  return ctx
}

function formatReminderTime(time24: string): string {
  const [hStr, mStr] = time24.split(':')
  const h = Number(hStr)
  const m = Number(mStr) || 0
  const hour = h % 12 || 12
  const ampm = h >= 12 ? 'pm' : 'am'
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
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

  const handleCreate = useCallback((duration: KhatmahDuration) => {
    const plan = createKhatmahPlan(duration)
    addKhatmahPlan(plan)
    setPlans(getKhatmahPlans())
    setActivePlanId(plan.id)
    setSelectedDay(1)
    setScreen('day')
    setShowNew(false)
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

  const toggleReminder = useCallback(() => {
    if (!activePlan) return
    updateKhatmahPlan({
      ...activePlan,
      reminderEnabled: !activePlan.reminderEnabled,
      reminderTime: activePlan.reminderTime ?? '19:00',
    })
    refreshPlans()
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
      handleComplete,
      handleDelete,
      toggleReminder,
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
      handleCreate,
      handleComplete,
      handleDelete,
      toggleReminder,
      onGoToPage,
      onClose,
    ]
  )

  return <KhatmahContext.Provider value={value}>{children}</KhatmahContext.Provider>
}

function KhatmahNewScreen() {
  const { plans, handleCreate, setShowNew, showNew } = useKhatmah()

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
              onClick={() => handleCreate(d)}
              className="rounded-xl bg-teal-500/15 py-3.5 text-sm font-medium text-teal-400"
            >
              {durationLabel(d)}
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
                  Pages {day.startPage} – {day.endPage}
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

function KhatmahDayContent() {
  const { activePlan, currentDay, focusDay, plans, screen, setActivePlanId, setSelectedDay } =
    useKhatmah()

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

        <div className="mt-6 flex items-center justify-between">
          <span className="text-base font-medium text-white">Day {currentDay.day}</span>
          <span className="text-sm text-stone-500">
            {dayScheduleLabel(currentDay.day, focusDay)}
          </span>
        </div>

        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-stone-400">
              From {bounds ? `${bounds.from.surahName}: ${bounds.from.ayah}` : '…'}
            </p>
            <span className="shrink-0 text-sm tabular-nums text-stone-500">
              {currentDay.startPage}
            </span>
          </div>
          <p
            className="arabic-text mt-4 line-clamp-2 text-right text-lg leading-[2] text-white/90"
            dir="rtl"
          >
            {boundsLoading ? '…' : bounds?.from.arabic ?? ''}
          </p>
        </section>

        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-stone-400">
              To {bounds ? `${bounds.to.surahName}: ${bounds.to.ayah}` : '…'}
            </p>
            <span className="shrink-0 text-sm tabular-nums text-stone-500">
              {currentDay.endPage}
            </span>
          </div>
          <p
            className="arabic-text mt-4 line-clamp-2 text-right text-lg leading-[2] text-white/90"
            dir="rtl"
          >
            {boundsLoading ? '…' : bounds?.to.arabic ?? ''}
          </p>
        </section>
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

function KhatmahReminderSection() {
  const { activePlan, handleDelete, screen, setScreen, setShowNew, toggleReminder } = useKhatmah()

  if (screen !== 'day' || !activePlan) return null

  return (
    <div className="shrink-0 border-t border-white/5 px-5 pb-4 pt-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-stone-600">Reminder</p>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#1c1c1e] px-5 py-4">
        <div>
          <p className="text-sm font-medium text-white">Daily Reading</p>
          <p className="mt-1 text-xs text-stone-500">
            {formatReminderTime(activePlan.reminderTime ?? '19:00')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={activePlan.reminderEnabled ?? false}
          onClick={toggleReminder}
          className={cn(
            'relative h-7 w-12 shrink-0 rounded-full transition-colors',
            activePlan.reminderEnabled ? 'bg-teal-500' : 'bg-stone-600'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform',
              activePlan.reminderEnabled ? 'left-[22px]' : 'left-0.5'
            )}
          />
        </button>
      </div>

      <div className="mt-6 space-y-3">
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
        <KhatmahInner />
        <KhatmahActionBar />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <KhatmahReminderSection />
        </div>
      </div>
    </KhatmahProvider>
  )
}
