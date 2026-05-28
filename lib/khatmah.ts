import { TOTAL_MUSHAF_PAGES } from '@/lib/mushaf'
import { resolveJuzPageRange, splitPageRange } from '@/lib/juz-pages'

export type KhatmahDuration = '1week' | '1month' | '2months'

export interface KhatmahDay {
  day: number
  startPage: number
  endPage: number
  completed: boolean
  /** Juz label for this day (when plan is juz-aligned). */
  juzLabel?: string
}

export interface KhatmahPlan {
  id: string
  title: string
  duration: KhatmahDuration
  totalDays: number
  createdAt: number
  days: KhatmahDay[]
  reminderEnabled?: boolean
  reminderTime?: string
}

const STORAGE_KEY = 'muyassar_khatmah_plans'

const DURATION_DAYS: Record<KhatmahDuration, number> = {
  '1week': 7,
  '1month': 30,
  '2months': 60,
}

const DURATION_LABELS: Record<KhatmahDuration, string> = {
  '1week': '1 week',
  '1month': '1 month',
  '2months': '2 months',
}

export function durationLabel(d: KhatmahDuration): string {
  return DURATION_LABELS[d]
}

function createEvenPagePlan(duration: KhatmahDuration): KhatmahPlan {
  const totalDays = DURATION_DAYS[duration]
  const pagesPerDay = Math.ceil(TOTAL_MUSHAF_PAGES / totalDays)
  const days: KhatmahDay[] = []
  let page = 1

  for (let day = 1; day <= totalDays; day++) {
    const startPage = page
    const endPage = Math.min(
      TOTAL_MUSHAF_PAGES,
      day === totalDays ? TOTAL_MUSHAF_PAGES : page + pagesPerDay - 1
    )
    days.push({ day, startPage, endPage, completed: false })
    page = endPage + 1
    if (page > TOTAL_MUSHAF_PAGES) break
  }

  return {
    id: `khatmah-${Date.now()}`,
    title: `Khatmah · ${DURATION_LABELS[duration]}`,
    duration,
    totalDays: days.length,
    createdAt: Date.now(),
    days,
  }
}

/** 1 month = one juz per day (day 3 → juz 3 pages). */
async function createMonthlyJuzPlan(): Promise<KhatmahPlan> {
  const days: KhatmahDay[] = []

  for (let juz = 1; juz <= 30; juz += 1) {
    const range = await resolveJuzPageRange(juz)
    days.push({
      day: juz,
      startPage: range.startPage,
      endPage: range.endPage,
      completed: false,
      juzLabel: `Juz ${juz}`,
    })
  }

  return {
    id: `khatmah-${Date.now()}`,
    title: `Khatmah · ${DURATION_LABELS['1month']}`,
    duration: '1month',
    totalDays: days.length,
    createdAt: Date.now(),
    days,
  }
}

/** 2 months = each juz split across 2 days. */
async function createTwoMonthJuzPlan(): Promise<KhatmahPlan> {
  const days: KhatmahDay[] = []
  let day = 1

  for (let juz = 1; juz <= 30; juz += 1) {
    const range = await resolveJuzPageRange(juz)
    for (let half = 0; half < 2; half += 1) {
      const part = splitPageRange(range.startPage, range.endPage, half, 2)
      days.push({
        day,
        startPage: part.startPage,
        endPage: part.endPage,
        completed: false,
        juzLabel: `Juz ${juz} · ${half === 0 ? '1/2' : '2/2'}`,
      })
      day += 1
    }
  }

  return {
    id: `khatmah-${Date.now()}`,
    title: `Khatmah · ${DURATION_LABELS['2months']}`,
    duration: '2months',
    totalDays: days.length,
    createdAt: Date.now(),
    days,
  }
}

/** 1 week ≈ 4–5 juz per day. */
async function createWeeklyJuzPlan(): Promise<KhatmahPlan> {
  const days: KhatmahDay[] = []
  const juzPerDay = Math.ceil(30 / 7)

  for (let day = 1; day <= 7; day += 1) {
    const firstJuz = (day - 1) * juzPerDay + 1
    const lastJuz = Math.min(30, day * juzPerDay)
    const startRange = await resolveJuzPageRange(firstJuz)
    const endRange = await resolveJuzPageRange(lastJuz)
    days.push({
      day,
      startPage: startRange.startPage,
      endPage: endRange.endPage,
      completed: false,
      juzLabel: firstJuz === lastJuz ? `Juz ${firstJuz}` : `Juz ${firstJuz}–${lastJuz}`,
    })
  }

  return {
    id: `khatmah-${Date.now()}`,
    title: `Khatmah · ${DURATION_LABELS['1week']}`,
    duration: '1week',
    totalDays: days.length,
    createdAt: Date.now(),
    days,
  }
}

export async function createKhatmahPlan(duration: KhatmahDuration): Promise<KhatmahPlan> {
  if (duration === '1month') return createMonthlyJuzPlan()
  if (duration === '2months') return createTwoMonthJuzPlan()
  if (duration === '1week') return createWeeklyJuzPlan()
  return createEvenPagePlan(duration)
}

export function getKhatmahPlans(): KhatmahPlan[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as KhatmahPlan[]) : []
  } catch {
    return []
  }
}

export function saveKhatmahPlans(plans: KhatmahPlan[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
}

export function addKhatmahPlan(plan: KhatmahPlan): void {
  const plans = getKhatmahPlans()
  plans.unshift(plan)
  saveKhatmahPlans(plans)
}

export function updateKhatmahPlan(updated: KhatmahPlan): void {
  const plans = getKhatmahPlans().map((p) => (p.id === updated.id ? updated : p))
  saveKhatmahPlans(plans)
}

export function markDayComplete(planId: string, day: number, completed: boolean): KhatmahPlan | null {
  const plans = getKhatmahPlans()
  const plan = plans.find((p) => p.id === planId)
  if (!plan) return null
  const next = {
    ...plan,
    days: plan.days.map((d) => (d.day === day ? { ...d, completed } : d)),
  }
  updateKhatmahPlan(next)
  return next
}

export function deleteKhatmahPlan(planId: string): void {
  saveKhatmahPlans(getKhatmahPlans().filter((p) => p.id !== planId))
}

export function firstIncompleteDay(plan: KhatmahPlan): number {
  return plan.days.find((d) => !d.completed)?.day ?? plan.days[0]?.day ?? 1
}

export function dayScheduleLabel(dayNum: number, focusDay: number): string {
  if (dayNum === focusDay) return 'Today'
  if (dayNum === focusDay + 1) return 'Tomorrow'
  if (dayNum < focusDay) return 'Earlier'
  return 'Upcoming'
}
