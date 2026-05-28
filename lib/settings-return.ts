const STORAGE_KEY = 'muyassar_settings_return_to'

/** Remember where to go back after Settings (works offline — no query string on /settings). */
export function setSettingsReturnTo(href: string): void {
  if (typeof sessionStorage === 'undefined') return
  if (!href.startsWith('/')) return
  try {
    sessionStorage.setItem(STORAGE_KEY, href)
  } catch {
    /* ignore */
  }
}

export function peekSettingsReturnTo(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const href = sessionStorage.getItem(STORAGE_KEY)
    return href?.startsWith('/') ? href : null
  } catch {
    return null
  }
}

export function resolveSettingsReturnHref(searchReturnTo: string | null): string {
  const fromQuery =
    searchReturnTo && searchReturnTo.startsWith('/') ? searchReturnTo : null
  const fromStore = peekSettingsReturnTo()
  const href = fromQuery ?? fromStore ?? '/'
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  return href
}
