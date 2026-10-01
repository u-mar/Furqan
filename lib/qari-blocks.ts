'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { tr } from '@/lib/i18n-core'

/**
 * The accounts the signed-in person has blocked in Qari, kept here so every
 * list can leave their posts out the moment a block happens, without waiting
 * for the next fetch (the server leaves them out of every fetch after that).
 */

interface Viewer {
  id: string
  username: string
}

let owner: string | null = null
let blocked: ReadonlySet<string> = new Set()
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const NONE: ReadonlySet<string> = new Set()

function emit() {
  for (const listener of listeners) listener()
}

function set(next: ReadonlySet<string>) {
  blocked = next
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Fetches the list once per signed-in person. */
function load(viewer: Viewer): Promise<void> {
  const who = viewer.username.toLowerCase()
  if (owner === who && loading) return loading
  // A different person signed in: their list, not the last one's.
  if (owner !== who) {
    owner = who
    blocked = new Set()
  }
  loading = (async () => {
    try {
      const params = new URLSearchParams({ username: who, userId: viewer.id })
      const res = await fetch(`/api/qari/block?${params.toString()}`)
      if (!res.ok) return
      const data = (await res.json()) as { blocked?: string[] }
      if (owner === who) set(new Set(data.blocked ?? []))
    } catch {
      // Without the list, the server still leaves blocked people out of every feed.
    }
  })()
  return loading
}

/** Fetches the list again — for the Blocked accounts screen, which should never be out of date. */
export function refreshBlockedUsers(viewer: Viewer): Promise<void> {
  loading = null
  return load(viewer)
}

/** Lower-case usernames the viewer has blocked; empty when signed out. */
export function useBlockedUsers(viewer: Viewer | null): ReadonlySet<string> {
  useEffect(() => {
    if (viewer) void load(viewer)
  }, [viewer])
  const current = useSyncExternalStore(subscribe, () => blocked, () => NONE)
  return viewer ? current : NONE
}

async function send(method: 'POST' | 'DELETE', viewer: Viewer, target: string): Promise<void> {
  const res = await fetch('/api/qari/block', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: viewer.id, username: viewer.username, target }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(data.error || tr('Could not change that.'))
}

export async function blockUser(viewer: Viewer, target: string): Promise<void> {
  const who = target.toLowerCase()
  await send('POST', viewer, who)
  set(new Set([...blocked, who]))
}

export async function unblockUser(viewer: Viewer, target: string): Promise<void> {
  const who = target.toLowerCase()
  await send('DELETE', viewer, who)
  set(new Set([...blocked].filter((u) => u !== who)))
}
