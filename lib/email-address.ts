/** Loose on purpose: a real check is whether mail arrives, not a pattern. */
export const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 254) : ''
}
