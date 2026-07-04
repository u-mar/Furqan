const UNLOCK_KEY = 'muyassar_imitate_unlocked'
const IMITATE_PIN = '2424'

export function isImitateUnlocked(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

export function unlockImitate(pin: string): boolean {
  if (pin.trim() !== IMITATE_PIN) return false
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1')
    window.dispatchEvent(new CustomEvent('imitate-access-changed', { detail: true }))
    return true
  } catch {
    return false
  }
}

export function lockImitate(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(UNLOCK_KEY)
    window.dispatchEvent(new CustomEvent('imitate-access-changed', { detail: false }))
  } catch {
    // ignore
  }
}
