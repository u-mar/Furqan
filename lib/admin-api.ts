/** Client-side admin API helpers (session cookie). */

export async function checkAdminSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/auth/session', { credentials: 'include', cache: 'no-store' })
    if (!res.ok) return false
    const data = (await res.json()) as { authenticated?: boolean }
    return Boolean(data.authenticated)
  } catch {
    return false
  }
}

export async function loginAdmin(username: string, password: string): Promise<void> {
  const res = await fetch('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? 'Invalid admin credentials.')
  }
}

export async function logoutAdmin(): Promise<void> {
  await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' })
}

export interface Uploader {
  username: string
  name: string
}

/** The accounts allowed to post recordings made outside the app. */
export async function listUploaders(): Promise<Uploader[]> {
  const res = await fetch('/api/admin/uploaders', { credentials: 'include', cache: 'no-store' })
  if (!res.ok) throw new Error('Could not load the list.')
  const data = (await res.json()) as { uploaders?: Uploader[] }
  return data.uploaders ?? []
}

/** Turns uploading on or off for one account, by its username. */
export async function setUploader(username: string, allowed: boolean): Promise<Uploader> {
  const res = await fetch('/api/admin/uploaders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, allowed }),
  })
  const data = (await res.json().catch(() => ({}))) as Uploader & { error?: string }
  if (!res.ok) throw new Error(data.error ?? 'Could not change that.')
  return data
}
