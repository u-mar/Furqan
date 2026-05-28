'use client'

import { getUsageIdentity } from '@/lib/usage-identity'

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
  createdAt: number
  lastSeenAt: number
  totalVisits: number
  lastPath: string
  pageViews: Record<string, number>
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
  return { id: identity.userId, name: identity.userName, createdAt: Date.now() }
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

function applyLocalUsageUpdate(
  profile: { id: string; name: string },
  pathname: string,
  countSession: boolean
): void {
  const store = readLocalAdminStore()
  const current = store.users.find((u) => u.userId === profile.id)
  const updated: UserUsage = {
    userId: profile.id,
    userName: profile.name,
    createdAt: current?.createdAt ?? Date.now(),
    lastSeenAt: Date.now(),
    totalVisits: (current?.totalVisits ?? 0) + (countSession ? 1 : 0),
    lastPath: pathname,
    pageViews: {
      ...(current?.pageViews ?? {}),
      [pathname]: ((current?.pageViews ?? {})[pathname] ?? 0) + 1,
    },
  }
  writeLocalAdminStore({
    ...store,
    users: [...store.users.filter((u) => u.userId !== profile.id), updated],
  })
}

export async function trackUsage(pathname: string): Promise<void> {
  const profile = getOrCreateUserProfile()
  const countSession = isNewUsageSession()

  try {
    const res = await fetch('/api/admin/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.id,
        userName: profile.name,
        pathname,
        countSession,
      }),
    })
    if (!res.ok) {
      const raw = await res.text()
      if (isDbConfigError(raw)) {
        applyLocalUsageUpdate(profile, pathname, countSession)
      }
    }
  } catch {
    applyLocalUsageUpdate(profile, pathname, countSession)
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

export async function listAdminData(): Promise<AdminStore> {
  try {
    const res = await fetch('/api/admin', { cache: 'no-store' })
    if (!res.ok) return readLocalAdminStore()
    const data = (await res.json()) as Partial<AdminStore>
    return {
      dailyVerse: data.dailyVerse ?? DEFAULT_DAILY_VERSE,
      feedback: data.feedback ?? [],
      users: data.users ?? [],
      popups: data.popups ?? readLocalAdminStore().popups,
    }
  } catch {
    return readLocalAdminStore()
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
  try {
    const res = await fetch(`/api/admin/popup?userId=${encodeURIComponent(profile.id)}`, {
      cache: 'no-store',
    })
    if (!res.ok) {
      const store = readLocalAdminStore()
      return store.popups.filter(
        (popup) =>
          (popup.targetUserId === 'all' || popup.targetUserId === profile.id) &&
          !popup.dismissedBy.includes(profile.id)
      )
    }
    const data = (await res.json()) as { popups: AdminPopupMessage[] }
    return data.popups
  } catch {
    const store = readLocalAdminStore()
    return store.popups.filter(
      (popup) =>
        (popup.targetUserId === 'all' || popup.targetUserId === profile.id) &&
        !popup.dismissedBy.includes(profile.id)
    )
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
