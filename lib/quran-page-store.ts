import type { Verse } from '@/types'

/**
 * Each mushaf page kept on its own on the phone (IndexedDB), so Read opens a page by reading just
 * that page, at once, instead of the whole Quran (16 MB parsed in one go, a second or two on a phone
 * every time the app was opened and Read was reached). Filled once, quietly, the first time the
 * whole Quran has been read in (lib/local-quran-store.ts); used from then on.
 */
const DB_NAME = 'naba-quran-pages'
const STORE = 'pages'
/** Bumped when the page data changes shape, so an old store is filled again. */
const STORE_VERSION = 1
const COMPLETE_KEY = 'complete'

let dbPromise: Promise<IDBDatabase | null> | null = null
let complete: boolean | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const request = indexedDB.open(DB_NAME, STORE_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE)
        db.createObjectStore(STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function get<T>(key: IDBValidKey): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null)
        try {
          const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
          request.onsuccess = () => resolve((request.result as T | undefined) ?? null)
          request.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      })
  )
}

/** Whether every page has been kept. */
export async function storedPagesComplete(): Promise<boolean> {
  if (complete !== null) return complete
  complete = (await get<boolean>(COMPLETE_KEY)) === true
  return complete
}

/** One page's verses, as kept on the phone; null when not kept (yet). */
export async function readStoredPage(page: number): Promise<Verse[] | null> {
  const verses = await get<Verse[]>(page)
  return verses?.length ? verses : null
}

let storing = false

/**
 * Keeps every page, a few at a time while the phone is otherwise idle, so reading is never held up
 * by it. Marked complete only once all are in.
 */
export function storeAllPages(pages: Map<number, Verse[]>): void {
  if (storing || complete === true) return
  storing = true
  void (async () => {
    try {
      if (await storedPagesComplete()) return
      const db = await openDb()
      if (!db) return
      const entries = [...pages.entries()].sort((a, b) => a[0] - b[0])
      const idle = () =>
        new Promise<void>((resolve) => {
          if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => resolve(), { timeout: 1500 })
          else window.setTimeout(resolve, 30)
        })
      for (let i = 0; i < entries.length; i += 30) {
        await idle()
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite')
          const store = tx.objectStore(STORE)
          for (const [page, verses] of entries.slice(i, i + 30)) store.put(verses, page)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        })
      }
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(true, COMPLETE_KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      })
      complete = true
    } catch {
      // Tried again the next time the whole Quran is read in.
    } finally {
      storing = false
    }
  })()
}
