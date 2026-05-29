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
