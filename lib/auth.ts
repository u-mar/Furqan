import { tr } from '@/lib/i18n-core'
import { getGuestId } from '@/lib/guest-id'

export interface AppUser {
  id: string
  username: string
  name: string
  /** How this account signs in, when it is not a username and PIN. */
  via?: 'google' | 'email'
}

const AUTH_KEY = 'muyassar_auth_user'
/** Set when "Remember me" was left off: the sign-in lasts until the app is closed. */
const SESSION_ONLY_KEY = 'muyassar_auth_session_only'
const SESSION_ALIVE_KEY = 'muyassar_auth_alive'
const LOCAL_USERS_KEY = 'muyassar_local_users'

export function getSignedInUser(): AppUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    // Not remembered, and this is a fresh launch: sign out now.
    if (localStorage.getItem(SESSION_ONLY_KEY) && !sessionStorage.getItem(SESSION_ALIVE_KEY)) {
      localStorage.removeItem(AUTH_KEY)
      localStorage.removeItem(SESSION_ONLY_KEY)
      return null
    }
    const parsed = JSON.parse(raw) as AppUser
    if (!parsed?.id || !parsed?.username || !parsed?.name) return null
    return parsed
  } catch {
    return null
  }
}

export function setSignedInUser(user: AppUser, options: { remember?: boolean } = {}): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_KEY, JSON.stringify(user))
  try {
    if (options.remember === false) {
      localStorage.setItem(SESSION_ONLY_KEY, '1')
      sessionStorage.setItem(SESSION_ALIVE_KEY, '1')
    } else {
      localStorage.removeItem(SESSION_ONLY_KEY)
    }
  } catch {
    // Without storage the choice just isn't kept.
  }
  window.dispatchEvent(new CustomEvent('auth-user-changed', { detail: user }))
  mergeGuestLikes(user.id)
}

/**
 * Hearts given before signing in belong to this phone's guest id; once there
 * is an account they move to it. Quiet and best-effort: a failure leaves the
 * guest's likes where they were, still counted, and the next sign-in tries again.
 */
function mergeGuestLikes(userId: string): void {
  const guestId = getGuestId()
  if (!guestId) return
  void fetch('/api/qari/likes/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestId, userId }),
  }).catch(() => {})
}

export function clearSignedInUser(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(SESSION_ONLY_KEY)
  window.dispatchEvent(new CustomEvent('auth-user-changed', { detail: null }))
}

interface LocalAuthUser extends AppUser {
  pin: string
}

function readLocalUsers(): LocalAuthUser[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LocalAuthUser[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalUsers(users: LocalAuthUser[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users))
}

/** Forget a local-only account on this device. */
export function deleteLocalUser(username: string): void {
  writeLocalUsers(readLocalUsers().filter((u) => u.username !== username))
}

/** Rename a local-only account. Database accounts are renamed server-side. */
export function renameLocalUser(username: string, name: string): void {
  const users = readLocalUsers()
  const match = users.find((u) => u.username === username)
  if (!match) return
  match.name = name
  writeLocalUsers(users)
}

export function signupLocalUser(username: string, name: string, pin: string): AppUser {
  const cleanUsername = username.trim().toLowerCase()
  const cleanName = name.trim()
  const cleanPin = pin.trim()
  const users = readLocalUsers()
  if (users.some((u) => u.username === cleanUsername)) {
    throw new Error(tr('Username already exists.'))
  }
  const user: LocalAuthUser = {
    id: `local_${cleanUsername}`,
    username: cleanUsername,
    name: cleanName,
    pin: cleanPin,
  }
  users.push(user)
  writeLocalUsers(users)
  return { id: user.id, username: user.username, name: user.name }
}

export function loginLocalUser(username: string, pin: string): AppUser {
  const cleanUsername = username.trim().toLowerCase()
  const cleanPin = pin.trim()
  const user = readLocalUsers().find((u) => u.username === cleanUsername && u.pin === cleanPin)
  if (!user) throw new Error(tr('Invalid username or PIN.'))
  return { id: user.id, username: user.username, name: user.name }
}
