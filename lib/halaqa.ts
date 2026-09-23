'use client'

import { APP_NAME } from '@/lib/app-brand'
import { tr } from '@/lib/i18n-core'

const KEY_STORAGE = 'muyassar_halaqa_key'
const MEMBER_FLAG = 'muyassar_halaqa_member'
const READ_DAY = 'muyassar_halaqa_read_day'
const NAME_STORAGE = 'muyassar_halaqa_name'

/* ----------------------------------------------------------------- types */

export interface DayLine {
  /** Oldest first: 1 read, 0 did not, -1 had not joined yet. */
  days: number[]
  count: number
  possible: number
}

export interface HalaqaListItem {
  id: string
  name: string
  memberCount: number
  readCount: number
  startDay: string
  endDay: string | null
  dayNumber: number
  khatmah: { done: number; total: number; completed: boolean } | null
}

export interface HalaqaMemberView {
  id: string
  name: string
  isCreator: boolean
  isMe: boolean
  joinedAt: string
  readToday: boolean
  recent: DayLine
}

export interface KhatmahJuzView {
  juz: number
  done: boolean
  memberId: string
  memberName: string | null
  mine: boolean
}

export interface HalaqaDetail {
  halaqa: {
    id: string
    name: string
    code: string
    startDay: string
    endDay: string | null
    khatmahEnabled: boolean
    dayNumber: number
    ended: boolean
  }
  me: { id: string; isCreator: boolean; readToday: boolean }
  members: HalaqaMemberView[]
  khatmah: {
    id: string
    finishBy: string | null
    startedAt: string
    completedAt: string | null
    done: number
    readers: number
    juz: KhatmahJuzView[]
  } | null
  summary: { total: number; everyoneDays: number; lines: Array<DayLine & { id: string }> } | null
  windowDays: number
}

export interface JoinPreview {
  id: string
  name: string
  creatorName: string | null
  memberCount: number
  initials: string[]
  readCount: number
  endDay: string | null
  khatmah: { done: number; total: number } | null
  isMember: boolean
  full: boolean
}

/* ------------------------------------------------------------- identity */

function randomKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * This phone's halaqa key: a random secret sent only to the halaqa server,
 * which keeps just its hash. Clearing the app's data loses it, and with it the
 * phone's place in its halaqas.
 */
export function halaqaKey(): string {
  try {
    let key = localStorage.getItem(KEY_STORAGE)
    if (!key || key.length < 32) {
      key = randomKey()
      localStorage.setItem(KEY_STORAGE, key)
    }
    return key
  } catch {
    return randomKey()
  }
}

export function isHalaqaMember(): boolean {
  try {
    return localStorage.getItem(MEMBER_FLAG) === '1'
  } catch {
    return false
  }
}

export function setHalaqaMember(member: boolean) {
  try {
    if (member) localStorage.setItem(MEMBER_FLAG, '1')
    else localStorage.removeItem(MEMBER_FLAG)
  } catch {
    // Only a shortcut for Read; the server is the record.
  }
}

export function savedMemberName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function saveMemberName(name: string) {
  try {
    localStorage.setItem(NAME_STORAGE, name.trim())
  } catch {
    // Nothing to remember it in.
  }
}

/* ------------------------------------------------------------------ days */

/** Today on this phone's own calendar, as YYYY-MM-DD. */
export function localDay(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addLocalDays(day: string, amount: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return localDay(new Date(y, m - 1, d + amount))
}

export function dayGap(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

/** e.g. "Thu 15 Oct" */
export function shortDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', options).format(date)
  return `${part({ weekday: 'short' })} ${d} ${part({ month: 'short' })}`
}

/** e.g. "Tuesday 15 September" */
export function longDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', options).format(date)
  return `${part({ weekday: 'long' })} ${d} ${part({ month: 'long' })}`
}

/** "Every day", "Day 12 of 40", or "Finished" once a set time is over. */
export function scheduleLabel(h: { startDay: string; endDay: string | null; dayNumber: number }): string {
  if (!h.endDay) return tr('Every day')
  const total = dayGap(h.startDay, h.endDay) + 1
  if (h.dayNumber > total) return tr('Finished')
  return tr('Day {day} of {total}', { day: Math.max(h.dayNumber, 1), total })
}

/* ------------------------------------------------------------------- api */

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-halaqa-key': halaqaKey(),
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    })
  } catch {
    // The request never reached the server: say so plainly, not "Failed to fetch".
    throw new Error(tr('No connection. Check your internet and try again.'))
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || tr('Something went wrong. Try again.'))
  return data
}

/* What the phone saw last time, so a halaqa opens at once and the server only refreshes it. */
const LIST_CACHE = 'muyassar_halaqa_list'
const DETAIL_CACHE = 'muyassar_halaqa_detail_'

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const saved = JSON.parse(raw) as { day?: string; data?: T }
    // Yesterday's "read today" would be wrong; only today's copy is shown.
    return saved.day === localDay() && saved.data ? saved.data : null
  } catch {
    return null
  }
}

function writeCache(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ day: localDay(), data }))
  } catch {
    // A full disk only costs the shortcut.
  }
}

function dropCache(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing to remove.
  }
}

/** The list as last seen today, or an empty one for a phone that has never joined a halaqa. */
export function peekHalaqaList(): { readToday: boolean; halaqas: HalaqaListItem[] } | null {
  const cached = readCache<{ readToday: boolean; halaqas: HalaqaListItem[] }>(LIST_CACHE)
  if (cached) return cached
  return isHalaqaMember() ? null : { readToday: readTodayOnThisPhone(), halaqas: [] }
}

export function peekHalaqa(id: string): HalaqaDetail | null {
  return readCache<HalaqaDetail>(DETAIL_CACHE + id)
}

export async function listHalaqas(): Promise<{ readToday: boolean; halaqas: HalaqaListItem[] }> {
  const data = await request<{ readToday: boolean; halaqas: HalaqaListItem[] }>(
    `/api/halaqa?today=${localDay()}`
  )
  setHalaqaMember(data.halaqas.length > 0)
  if (data.readToday) rememberReadToday()
  writeCache(LIST_CACHE, data)
  return data
}

export async function createHalaqa(input: {
  name: string
  memberName: string
  length?: number
  endDay?: string | null
  khatmah: boolean
  finishBy?: string | null
}): Promise<{ id: string; code: string }> {
  const data = await request<{ id: string; code: string }>('/api/halaqa', {
    method: 'POST',
    body: JSON.stringify({ ...input, today: localDay() }),
  })
  setHalaqaMember(true)
  saveMemberName(input.memberName)
  dropCache(LIST_CACHE)
  return data
}

export function getJoinPreview(code: string): Promise<JoinPreview> {
  return request<JoinPreview>(`/api/halaqa/join?code=${encodeURIComponent(code)}&today=${localDay()}`)
}

export async function joinHalaqa(code: string, name: string): Promise<{ id: string }> {
  const data = await request<{ id: string }>('/api/halaqa/join', {
    method: 'POST',
    body: JSON.stringify({ code, name }),
  })
  setHalaqaMember(true)
  saveMemberName(name)
  dropCache(LIST_CACHE)
  return data
}

export async function getHalaqa(id: string): Promise<HalaqaDetail> {
  const data = await request<HalaqaDetail>(`/api/halaqa/${encodeURIComponent(id)}?today=${localDay()}`)
  writeCache(DETAIL_CACHE + id, data)
  return data
}

export async function halaqaAction(
  id: string,
  action: string,
  extra: Record<string, unknown> = {}
): Promise<{ ok: boolean; left?: boolean }> {
  const done = await request<{ ok: boolean; left?: boolean }>(`/api/halaqa/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({ action, today: localDay(), ...extra }),
  })
  if (done.left) {
    dropCache(DETAIL_CACHE + id)
    dropCache(LIST_CACHE)
  }
  return done
}

/** Pushes a "have you read today?" reminder to everyone else in the halaqa who has not read yet. */
export async function remindHalaqa(id: string): Promise<{ remindedCount: number }> {
  return request<{ remindedCount: number }>(`/api/halaqa/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'remind', today: localDay() }),
  })
}

export async function deleteHalaqa(id: string): Promise<{ ok: boolean }> {
  const done = await request<{ ok: boolean }>(`/api/halaqa/${encodeURIComponent(id)}`, { method: 'DELETE' })
  dropCache(DETAIL_CACHE + id)
  dropCache(LIST_CACHE)
  return done
}

function rememberReadToday() {
  try {
    localStorage.setItem(READ_DAY, localDay())
  } catch {
    // The server has it either way.
  }
}

export function readTodayOnThisPhone(): boolean {
  try {
    return localStorage.getItem(READ_DAY) === localDay()
  } catch {
    return false
  }
}

/** "I read today" — counted in every halaqa this phone is in. */
export async function markReadToday(source: 'app' | 'manual'): Promise<void> {
  await request('/api/halaqa/read', { method: 'POST', body: JSON.stringify({ today: localDay(), source }) })
  rememberReadToday()
}

/** The halaqa as it will look once today's tick is saved — shown before the server answers. */
export function withMeRead(detail: HalaqaDetail): HalaqaDetail {
  return {
    ...detail,
    me: { ...detail.me, readToday: true },
    members: detail.members.map((member) => (member.isMe ? { ...member, readToday: true } : member)),
  }
}

/* ------------------------------------------------------------- sharing */

export function inviteLink(code: string): string {
  return `${window.location.origin}/h/${code}`
}

export function inviteMessage(name: string, code: string): string {
  return tr('Join "{name}" on {app} and read the Quran with us:', { name, app: APP_NAME }) + `
${inviteLink(code)}`
}

/** What "Share today's check-in" posts: who has read, who has not, and where to tick. */
export function checkInMessage(detail: HalaqaDetail): string {
  const read = detail.members.filter((m) => m.readToday).map((m) => m.name)
  const notYet = detail.members.filter((m) => !m.readToday).map((m) => m.name)
  const lines = [`📖 ${detail.halaqa.name} — ${shortDay(localDay())}`, tr('Have you read today?'), '']
  if (read.length) lines.push(tr('✅ Read ({count}): {names}', { count: read.length, names: read.join(', ') }))
  if (notYet.length) lines.push(tr('⏳ Not yet ({count}): {names}', { count: notYet.length, names: notYet.join(', ') }))
  lines.push('', tr('Tick yours here:'), inviteLink(detail.halaqa.code))
  return lines.join('\n')
}

export function whatsAppLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/* ------------------------------------------------------------------ juz */

/** The first page of each juz in the 604-page Madinah mushaf the reader uses. */
const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422,
  442, 462, 482, 502, 522, 542, 562, 582,
]

export function juzPages(juz: number): { start: number; end: number } {
  const start = JUZ_START_PAGES[juz - 1] ?? 1
  const end = juz >= 30 ? 604 : (JUZ_START_PAGES[juz] ?? 605) - 1
  return { start, end }
}
