export interface AppUser {
  id: string
  username: string
  name: string
}

const AUTH_KEY = 'muyassar_auth_user'

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
