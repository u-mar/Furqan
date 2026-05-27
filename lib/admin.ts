'use client'

import { getSignedInUser } from '@/lib/auth'

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
}

const DEFAULT_DAILY_VERSE: DailyVerseConfig = {
  verseKey: '2:152',
  surahName: 'Al-Baqarah',
  label: 'Surah Al-Baqarah',
}

export function getOrCreateUserProfile(): { id: string; name: string; createdAt: number } {
  const authUser = getSignedInUser()
  const ts = Date.now()
  if (authUser) return { id: authUser.id, name: authUser.name, createdAt: ts }
  return { id: 'anon', name: 'Reader', createdAt: ts }
}

export async function getDailyVerseConfig(): Promise<DailyVerseConfig> {
  try {
    const res = await fetch('/api/admin/daily-verse', { cache: 'no-store' })
    if (!res.ok) return DEFAULT_DAILY_VERSE
    return (await res.json()) as DailyVerseConfig
  } catch {
    return DEFAULT_DAILY_VERSE
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
    throw new Error('Could not update daily verse.')
  }
  const updated = (await res.json()) as DailyVerseConfig
  window.dispatchEvent(new CustomEvent('admin-store-changed'))
  return updated
}

export async function trackUsage(pathname: string): Promise<void> {
  const profile = getOrCreateUserProfile()
  if (profile.id === 'anon') return
  try {
    await fetch('/api/admin/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.id, userName: profile.name, pathname }),
    })
  } catch {
    // no-op
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
  if (!res.ok) throw new Error('Could not send feedback.')
  window.dispatchEvent(new CustomEvent('admin-store-changed'))
  return (await res.json()) as FeedbackMessage
}

export async function listAdminData(): Promise<AdminStore> {
  const res = await fetch('/api/admin', { cache: 'no-store' })
  if (!res.ok) {
    return { dailyVerse: DEFAULT_DAILY_VERSE, feedback: [], users: [] }
  }
  return (await res.json()) as AdminStore
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
    throw new Error('Could not send popup.')
  }
  window.dispatchEvent(new CustomEvent('admin-store-changed'))
  return (await res.json()) as AdminPopupMessage
}

export async function getPendingPopupsForCurrentUser(): Promise<AdminPopupMessage[]> {
  const profile = getOrCreateUserProfile()
  if (profile.id === 'anon') return []
  const res = await fetch(`/api/admin/popup?userId=${encodeURIComponent(profile.id)}`, {
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as { popups: AdminPopupMessage[] }
  return data.popups
}

export async function dismissPopupForCurrentUser(popupId: string): Promise<void> {
  const profile = getOrCreateUserProfile()
  if (profile.id === 'anon') return
  await fetch('/api/admin/popup/dismiss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ popupId, userId: profile.id }),
  })
  window.dispatchEvent(new CustomEvent('admin-store-changed'))
}
