'use client'

import { getFirstSeenAt, getUsageIdentity } from '@/lib/usage-identity'
import {
  formatPresenceLabel,
  isUserOnline,
  resolveUserKind,
  type UserKind,
} from '@/lib/presence'

const USAGE_SESSION_KEY = 'muyassar_usage_session_logged'

export interface DailyVerseConfig {
  verseKey: string
  surahName: string
  label: string
}

export interface FeedbackMessage {
  id: string
  userId: string
  userName: string
  message: string
  contact: string
  createdAt: number
}

export interface UserUsage {
  userId: string
  userName: string
  userKind: UserKind
  createdAt: number
  lastSeenAt: number
  lastOfflineAt: number | null
  isOnline: boolean
  presenceLabel: string
  presenceDetail: string
  totalVisits: number
  lastPath: string
  pageViews: Record<string, number>
}

export interface AdminStats {
  totalUsers: number
  registered: number
  guests: number
  onlineNow: number
}

export interface AdminPopupMessage {
  id: string
  title: string
  body: string
  targetUserId: string | 'all'
  createdAt: number
  shownTo: string[]
  dismissedBy: string[]
}

interface AdminStore {
  dailyVerse: DailyVerseConfig
  feedback: FeedbackMessage[]
  users: UserUsage[]
  popups: AdminPopupMessage[]
  stats?: AdminStats
}

const DEFAULT_DAILY_VERSE: DailyVerseConfig = {
  verseKey: '2:152',
  surahName: 'Al-Baqarah',
  label: 'Surah Al-Baqarah',
}
const LOCAL_ADMIN_KEY = 'muyassar_admin_fallback'

function readLocalAdminStore(): AdminStore {
  if (typeof window === 'undefined') {
    return { dailyVerse: DEFAULT_DAILY_VERSE, feedback: [], users: [], popups: [] }
  }
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_KEY)
    if (!raw) return { dailyVerse: DEFAULT_DAILY_VERSE, feedback: [], users: [], popups: [] }
    const parsed = JSON.parse(raw) as Partial<AdminStore>
    return {
      dailyVerse: parsed.dailyVerse ?? DEFAULT_DAILY_VERSE,
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      popups: Array.isArray(parsed.popups) ? parsed.popups : [],
    }
  } catch {
    return { dailyVerse: DEFAULT_DAILY_VERSE, feedback: [], users: [], popups: [] }
  }
}

function writeLocalAdminStore(store: AdminStore): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(store))
  window.dispatchEvent(new CustomEvent('admin-store-changed'))
}

function isDbConfigError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('database is not configured') || lower.includes('database_url')
}

export function getOrCreateUserProfile(): { id: string; name: string; createdAt: number } {
  const identity = getUsageIdentity()
  return { id: identity.userId, name: identity.userName, createdAt: getFirstSeenAt() }
}

function popupIsNewForUser(popup: AdminPopupMessage, userId: string, firstSeenAt: number): boolean {
  if (popup.dismissedBy.includes(userId)) return false
  if (popup.targetUserId !== 'all' && popup.targetUserId !== userId) return false
  return popup.createdAt >= firstSeenAt
}

function isNewUsageSession(): boolean {
  if (typeof sessionStorage === 'undefined') return true
  try {
    if (sessionStorage.getItem(USAGE_SESSION_KEY)) return false
    sessionStorage.setItem(USAGE_SESSION_KEY, String(Date.now()))
    return true
  } catch {
    return true
  }
}

export async function getDailyVerseConfig(): Promise<DailyVerseConfig> {
  try {
    const res = await fetch('/api/admin/daily-verse', { cache: 'no-store' })
    if (!res.ok) return readLocalAdminStore().dailyVerse
    return (await res.json()) as DailyVerseConfig
  } catch {
    return readLocalAdminStore().dailyVerse
  }
}

export async function setDailyVerseConfig(
  nextVerseKey: string,
  surahName?: string
): Promise<DailyVerseConfig> {
  const res = await fetch('/api/admin/daily-verse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ verseKey: nextVerseKey, surahName }),
  })
  if (!res.ok) {
    const raw = await res.text()
    if (isDbConfigError(raw)) {
      const [surahPart] = nextVerseKey.split(':')
      const updated: DailyVerseConfig = {
        verseKey: /^\d+:\d+$/.test(nextVerseKey.trim()) ? nextVerseKey.trim() : DEFAULT_DAILY_VERSE.verseKey,
        surahName: surahName?.trim() || `Surah ${surahPart || ''}`.trim(),
        label: surahName?.trim() || `Surah ${surahPart || ''}`.trim(),
      }
      const store = readLocalAdminStore()
      writeLocalAdminStore({ ...store, dailyVerse: updated })
      return updated
    }
    throw new Error('Could not update daily verse.')
  }
  const updated = (await res.json()) as DailyVerseConfig
  window.dispatchEvent(new CustomEvent('admin-store-changed'))
  return updated
}

function mapLocalUser(
  partial: Omit<UserUsage, 'isOnline' | 'presenceLabel' | 'presenceDetail' | 'userKind'> & {
    userKind?: UserKind
    lastOfflineAt?: number | null
  },
  now = Date.now()
): UserUsage {
  const userKind = partial.userKind ?? resolveUserKind(partial.userId)
  const presence = formatPresenceLabel(partial.lastSeenAt, partial.lastOfflineAt ?? null, now)
  return {
    ...partial,
    userKind,
    lastOfflineAt: partial.lastOfflineAt ?? null,
    isOnline: isUserOnline(partial.lastSeenAt, now),
    presenceLabel: presence.status === 'online' ? 'Online' : 'Offline',
    presenceDetail: presence.detail,
  }
}

function applyLocalUsageUpdate(
  profile: { id: string; name: string },
  pathname: string,
  countSession: boolean,
  isActive: boolean
): void {
  const store = readLocalAdminStore()
  const current = store.users.find((u) => u.userId === profile.id)
  const now = Date.now()
  const userKind = resolveUserKind(profile.id)

  if (!isActive) {
    const updated = mapLocalUser({
      userId: profile.id,
      userName: profile.name,
      userKind,
      createdAt: current?.createdAt ?? now,
      lastSeenAt: current?.lastSeenAt ?? now,
      lastOfflineAt: now,
      totalVisits: current?.totalVisits ?? 0,
      lastPath: current?.lastPath ?? pathname,
      pageViews: current?.pageViews ?? {},
    })
    writeLocalAdminStore({
      ...store,
      users: [...store.users.filter((u) => u.userId !== profile.id), updated],
    })
    return
  }

  const updated = mapLocalUser({
    userId: profile.id,
    userName: profile.name,
    userKind,
    createdAt: current?.createdAt ?? now,
    lastSeenAt: now,
    lastOfflineAt: current?.lastOfflineAt ?? null,
    totalVisits: (current?.totalVisits ?? 0) + (countSession ? 1 : 0),
    lastPath: pathname,
    pageViews: {
      ...(current?.pageViews ?? {}),
      [pathname]: ((current?.pageViews ?? {})[pathname] ?? 0) + 1,
    },
  })
  writeLocalAdminStore({
    ...store,
    users: [...store.users.filter((u) => u.userId !== profile.id), updated],
  })
}

export async function trackUsage(
  pathname: string,
  options?: { isActive?: boolean }
): Promise<void> {
  const profile = getOrCreateUserProfile()
  const countSession = options?.isActive === false ? false : isNewUsageSession()
  const isActive = options?.isActive !== false

  try {
    const res = await fetch('/api/admin/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.id,
        userName: profile.name,
        pathname,
        countSession,
        isActive,
      }),
    })
    if (!res.ok) {
      const raw = await res.text()
      if (isDbConfigError(raw)) {
        applyLocalUsageUpdate(profile, pathname, countSession, isActive)
      }
    }
  } catch {
    applyLocalUsageUpdate(profile, pathname, countSession, isActive)
  }
}

export async function addFeedbackMessage(message: string, contact: string): Promise<FeedbackMessage> {
  const profile = getOrCreateUserProfile()
  const res = await fetch('/api/admin/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: profile.id,
      userName: profile.name,
      message,
      contact,
    }),
  })
  if (!res.ok) {
    const raw = await res.text()
    if (isDbConfigError(raw)) {
      const feedback: FeedbackMessage = {
        id: `fb_${Math.random().toString(36).slice(2, 10)}`,
        userId: profile.id,
        userName: profile.name,
        message: message.trim(),
        contact: contact.trim(),
        createdAt: Date.now(),
      }
      const store = readLocalAdminStore()
      writeLocalAdminStore({ ...store, feedback: [feedback, ...store.feedback] })
      return feedback
    }
    throw new Error('Could not send feedback.')
  }
  window.dispatchEvent(new CustomEvent('admin-store-changed'))
  return (await res.json()) as FeedbackMessage
}

function buildLocalStats(users: UserUsage[]): AdminStats {
  return {
    totalUsers: users.length,
    registered: users.filter((u) => u.userKind === 'registered').length,
    guests: users.filter((u) => u.userKind === 'guest').length,
    onlineNow: users.filter((u) => u.isOnline).length,
  }
}

export async function listAdminData(): Promise<AdminStore> {
  try {
    const res = await fetch('/api/admin', { cache: 'no-store', credentials: 'include' })
    if (res.status === 401) throw new Error('Admin session expired.')
    if (!res.ok) return readLocalAdminStore()
    const data = (await res.json()) as Partial<AdminStore>
    return {
      dailyVerse: data.dailyVerse ?? DEFAULT_DAILY_VERSE,
      feedback: data.feedback ?? [],
      users: data.users ?? [],
      popups: data.popups ?? readLocalAdminStore().popups,
      stats: data.stats,
    }
  } catch {
    const local = readLocalAdminStore()
    const users = local.users.map((u) =>
      mapLocalUser({
        userId: u.userId,
        userName: u.userName,
        userKind: u.userKind,
        createdAt: u.createdAt,
        lastSeenAt: u.lastSeenAt,
        lastOfflineAt: u.lastOfflineAt,
        totalVisits: u.totalVisits,
        lastPath: u.lastPath,
        pageViews: u.pageViews,
      })
    )
    return { ...local, users, stats: buildLocalStats(users) }
  }
}

export async function sendPopupToUser(input: {
  title: string
  body: string
  targetUserId: string | 'all'
}): Promise<AdminPopupMessage> {
  const res = await fetch('/api/admin/popup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const raw = await res.text()
    if (isDbConfigError(raw)) {
      const popup: AdminPopupMessage = {
        id: `pop_${Math.random().toString(36).slice(2, 10)}`,
        title: input.title.trim() || 'Message',
        body: input.body.trim(),
        targetUserId: input.targetUserId,
        createdAt: Date.now(),
        shownTo: [],
        dismissedBy: [],
      }
      const store = readLocalAdminStore()
      writeLocalAdminStore({ ...store, popups: [popup, ...store.popups] })
      return popup
    }
    throw new Error('Could not send popup.')
  }
  window.dispatchEvent(new CustomEvent('admin-store-changed'))
  return (await res.json()) as AdminPopupMessage
}

export async function getPendingPopupsForCurrentUser(): Promise<AdminPopupMessage[]> {
  const profile = getOrCreateUserProfile()
  if (profile.id === 'anon') return []
  const firstSeenAt = getFirstSeenAt()
  try {
    const res = await fetch(
      `/api/admin/popup?userId=${encodeURIComponent(profile.id)}&since=${firstSeenAt}`,
      { cache: 'no-store' }
    )
    if (!res.ok) {
      const store = readLocalAdminStore()
      return store.popups.filter((popup) => popupIsNewForUser(popup, profile.id, firstSeenAt))
    }
    const data = (await res.json()) as { popups: AdminPopupMessage[] }
    return data.popups
  } catch {
    const store = readLocalAdminStore()
    return store.popups.filter((popup) => popupIsNewForUser(popup, profile.id, firstSeenAt))
  }
}

export async function dismissPopupForCurrentUser(popupId: string): Promise<void> {
  const profile = getOrCreateUserProfile()
  if (profile.id === 'anon') return
  const res = await fetch('/api/admin/popup/dismiss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ popupId, userId: profile.id }),
  })
  if (!res.ok) {
    const store = readLocalAdminStore()
    writeLocalAdminStore({
      ...store,
      popups: store.popups.map((popup) =>
        popup.id === popupId && !popup.dismissedBy.includes(profile.id)
          ? { ...popup, dismissedBy: [...popup.dismissedBy, profile.id] }
          : popup
      ),
    })
    return
  }
  window.dispatchEvent(new CustomEvent('admin-store-changed'))
}
