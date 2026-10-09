/**
 * The id a phone uses before it has an account: `guest_<uuid>`, made once and
 * kept in this browser. Liking a recitation works with it, so nobody has to
 * sign up just to show they loved one; the likes move to the account made later.
 */

export const DEVICE_ID_KEY = 'muyassar_device_id'
const FIRST_SEEN_KEY = 'muyassar_first_seen_at'

const GUEST_ID_RE = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for an id made by getGuestId: what the server accepts from someone without an account. */
export function isGuestId(id: unknown): id is string {
  return typeof id === 'string' && GUEST_ID_RE.test(id)
}

/** This phone's guest id, made the first time it is asked for. Null where there is no storage. */
export function getGuestId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!isGuestId(id)) {
      id = `guest_${crypto.randomUUID()}`
      localStorage.setItem(DEVICE_ID_KEY, id)
      if (!localStorage.getItem(FIRST_SEEN_KEY)) localStorage.setItem(FIRST_SEEN_KEY, String(Date.now()))
    }
    return id
  } catch {
    return null
  }
}
