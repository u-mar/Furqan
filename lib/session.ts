import type { Session } from '@/types'

const SESSIONS_KEY = 'hifdh_sessions'

export function getSessions(): Session[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(SESSIONS_KEY)
  return stored ? JSON.parse(stored) : []
}

export function addSession(session: Session): void {
  if (typeof window === 'undefined') return
  const sessions = getSessions()
  sessions.push(session)
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export function getWeakAyahs(threshold = 80): Session[] {
  const sessions = getSessions()
  const latestByAyah = new Map<string, Session>()

  for (const session of sessions) {
    const existing = latestByAyah.get(session.verseKey)
    if (!existing || session.timestamp > existing.timestamp) {
      latestByAyah.set(session.verseKey, session)
    }
  }

  return Array.from(latestByAyah.values())
    .filter(s => s.score < threshold)
    .sort((a, b) => a.score - b.score)
}

export function clearSessions(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSIONS_KEY)
}