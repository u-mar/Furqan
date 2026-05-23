const LOCATION_KEY = 'user_location'

export interface UserLocation {
  lat: number
  lng: number
  label: string
  enabledAt: number
}

export function getSavedLocation(): UserLocation | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LOCATION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UserLocation
  } catch {
    return null
  }
}

export function saveLocation(loc: UserLocation): void {
  localStorage.setItem(LOCATION_KEY, JSON.stringify(loc))
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    if (!res.ok) throw new Error('Geocode failed')
    const data = (await res.json()) as {
      address?: { city?: string; town?: string; village?: string; state?: string }
      display_name?: string
    }
    const a = data.address
    return (
      a?.city ||
      a?.town ||
      a?.village ||
      a?.state ||
      data.display_name?.split(',')[0]?.trim() ||
      'Your location'
    )
  } catch {
    return `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`
  }
}

export function requestUserLocation(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not supported on this device'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const label = await reverseGeocode(lat, lng)
        const loc: UserLocation = { lat, lng, label, enabledAt: Date.now() }
        saveLocation(loc)
        resolve(loc)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission denied. Allow location in browser settings.'))
        } else if (err.code === err.TIMEOUT) {
          reject(new Error('Location request timed out. Try again.'))
        } else {
          reject(new Error('Could not get your location'))
        }
      },
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 300_000 }
    )
  })
}
