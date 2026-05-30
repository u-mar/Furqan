import { getSignedInUser } from '@/lib/auth'

const WELCOME_DISMISSED_KEY = 'muyassar_welcome_account_v1'

export function shouldShowWelcomeAccount(): boolean {
  if (typeof window === 'undefined') return false
  if (getSignedInUser()) return false
  try {
    return localStorage.getItem(WELCOME_DISMISSED_KEY) !== '1'
  } catch {
    return true
  }
}

export function dismissWelcomeAccount(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(WELCOME_DISMISSED_KEY, '1')
  } catch {
    /* ignore */
  }
}
