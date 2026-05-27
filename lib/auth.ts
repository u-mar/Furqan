export interface AppUser {
  id: string
  username: string
  name: string
}

const AUTH_KEY = 'muyassar_auth_user'
const LOCAL_USERS_KEY = 'muyassar_local_users'

export function getSignedInUser(): AppUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppUser
    if (!parsed?.id || !parsed?.username || !parsed?.name) return null
    return parsed
  } catch {
    return null
  }
}

export function setSignedInUser(user: AppUser): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_KEY, JSON.stringify(user))
  window.dispatchEvent(new CustomEvent('auth-user-changed', { detail: user }))
}

export function clearSignedInUser(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_KEY)
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

export function signupLocalUser(username: string, name: string, pin: string): AppUser {
  const cleanUsername = username.trim().toLowerCase()
  const cleanName = name.trim()
  const cleanPin = pin.trim()
  const users = readLocalUsers()
  if (users.some((u) => u.username === cleanUsername)) {
    throw new Error('Username already exists.')
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
  if (!user) throw new Error('Invalid username or PIN.')
  return { id: user.id, username: user.username, name: user.name }
}
