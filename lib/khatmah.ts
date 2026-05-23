import { TOTAL_MUSHAF_PAGES } from '@/lib/mushaf'

export type KhatmahDuration = '1week' | '1month' | '2months'

export interface KhatmahDay {
  day: number
  startPage: number
  endPage: number
  completed: boolean
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

export function createKhatmahPlan(duration: KhatmahDuration): KhatmahPlan {
  const totalDays = DURATION_DAYS[duration]
  const pagesPerDay = Math.ceil(TOTAL_MUSHAF_PAGES / totalDays)
  const days: KhatmahDay[] = []
  let page = 1

  for (let day = 1; day <= totalDays; day++) {
    const startPage = page
    const endPage = Math.min(TOTAL_MUSHAF_PAGES, day === totalDays ? TOTAL_MUSHAF_PAGES : page + pagesPerDay - 1)
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
