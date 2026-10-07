/**
 * What a recitation can sit on — in the swipe view, on the record screen and
 * in the videos made to share it: plain black, a moving clip, one of the four
 * landscapes made for videos, or any of the verse-card photos.
 *
 * Plain data, so the server can check a posted id against it too.
 */

import { RETIRED_SHARE_BACKGROUNDS, SHARE_BACKGROUNDS, SHARE_BACKGROUND_GROUPS, type ShareBackground } from '@/lib/share-backgrounds'

export interface VideoBackground {
  id: string
  /** Shown under the swatch in the picker. */
  label: string
  /** null for the plain black background. */
  url: string | null
  /** A small copy for the pickers; null for the plain black one. */
  thumb: string | null
  /** The heading it is listed under in the full gallery. */
  group: string
  /** A moving clip, hosted on Cloudinary — takes priority over `url` when set. */
  videoUrl?: string | null
}

/** What the picker strip shows before "More": black, a few moving clips, and the best of the photos. */
export const FEATURED_VIDEO_BACKGROUND_IDS = [
  'black',
  'motion-lone-tree-sunset',
  'photo-haram-arch-sunset',
  'motion-winding-river',
  'photo-golden-dunes',
  'photo-green-dome',
  'motion-pink-sea',
  'photo-crescent-dusk',
]

export const VIDEO_BACKGROUND_GROUPS = ['Plain', 'Motion', 'Landscapes', ...SHARE_BACKGROUND_GROUPS]

const MOTION_CLOUD_BASE = 'https://res.cloudinary.com/r2ule9za/video/upload/nadir/share-bg-video'

/**
 * Looping clips, hosted on Cloudinary (see public/share-bg-video's absence: these never ship in the app bundle).
 * The first six are Coverr footage; the rest are Pexels clips cut into short portrait loops (720×1280, silent,
 * the end faded into the start).
 */
const MOTION_BACKGROUNDS: VideoBackground[] = (
  [
    ['sunset-in-auckland-new-zealand', 'Auckland sunset'],
    ['sunset-on-sayulita-beach-in-mexico', 'Sayulita beach'],
    ['river-surrounded-by-mountains', 'Mountain river'],
    ['sunset-on-the-beach', 'Beach sunset'],
    ['purple-flowers-at-sunset', 'Purple flowers'],
    ['sun-setting-in-auckland-new-zealand', 'Auckland sun'],
    ['lone-tree-sunset', 'Lone tree'],
    ['pink-sea', 'Pink sea'],
    ['calm-lake-dusk', 'Calm lake'],
    ['winding-river', 'Winding river'],
    ['lakeside-tree', 'Lakeside tree'],
    ['wild-tulips', 'Wild tulips'],
    ['white-blossoms', 'White blossoms'],
    ['pink-roses', 'Pink roses'],
    ['misty-autumn-road', 'Misty road'],
    ['windy-hills', 'Windy hills'],
    ['wind-turbine-dusk', 'Wind turbine'],
    ['forest-cabin', 'Forest cabin'],
    ['green-meadow', 'Green meadow'],
    ['lake-castle', 'Lake castle'],
    ['town-at-sunset', 'Town at sunset'],
  ] as const
).map(([id, label]) => ({
  id: `motion-${id}`,
  label,
  // Cloudinary derives a JPG frame from the video on request — no separate upload needed.
  url: `${MOTION_CLOUD_BASE}/${id}.jpg`,
  // A small crop of that frame for the pickers — the full one is 1920px wide.
  thumb: `${MOTION_CLOUD_BASE.replace('/video/upload/', '/video/upload/w_240,h_300,c_fill,q_auto/')}/${id}.jpg`,
  videoUrl: `${MOTION_CLOUD_BASE}/${id}.mp4`,
  group: 'Motion',
}))

export const VIDEO_BACKGROUNDS: VideoBackground[] = [
  { id: 'black', label: 'Black', url: null, thumb: null, group: 'Plain' },
  ...MOTION_BACKGROUNDS,
  ...[
    ['desert-dunes', 'Dunes'],
    ['canyon-pinnacles', 'Canyon'],
    ['mountain', 'Mountain'],
    ['valley', 'Valley'],
  ].map(([id, label]) => {
    const url = `/qari/video-backgrounds/${id}.avif`
    return { id, label, url, thumb: url, group: 'Landscapes' }
  }),
  // Everything the verse cards use, too.
  ...SHARE_BACKGROUNDS.map(photoBackground),
]

function photoBackground(b: ShareBackground): VideoBackground {
  return { id: `photo-${b.id}`, label: b.label, url: b.src, thumb: b.thumb, group: b.group }
}

/** Photos no longer offered, still drawn for the recitations already posted on them. */
const RETIRED_VIDEO_BACKGROUNDS: VideoBackground[] = RETIRED_SHARE_BACKGROUNDS.map(photoBackground)

export function findVideoBackground(id: string): VideoBackground {
  return (
    VIDEO_BACKGROUNDS.find((b) => b.id === id) ?? RETIRED_VIDEO_BACKGROUNDS.find((b) => b.id === id) ?? VIDEO_BACKGROUNDS[0]
  )
}

/** True for one the pickers offer. */
function isListedBackgroundId(id: unknown): id is string {
  return typeof id === 'string' && VIDEO_BACKGROUNDS.some((b) => b.id === id)
}

/** True for an id from the lists above — what the server accepts for a recitation, retired photos included. */
export function isVideoBackgroundId(id: unknown): id is string {
  return isListedBackgroundId(id) || (typeof id === 'string' && RETIRED_VIDEO_BACKGROUNDS.some((b) => b.id === id))
}

/** The strip under the preview when posting: a quick handful across every kind, before "More". */
export const FEATURED_RECITATION_BACKGROUND_IDS = [
  'photo-haram-arch-sunset',
  'motion-lone-tree-sunset',
  'photo-golden-dunes',
  'photo-green-dome',
  'motion-winding-river',
  'photo-crescent-dusk',
  'photo-kaaba-door',
  'motion-pink-sea',
  'photo-golden-shadows',
  'photo-storm-at-sea',
  'mountain',
  'black',
]

/** The landscapes recitations posted before backgrounds could be chosen are shown on. */
const LEGACY_BACKDROPS = ['desert-dunes', 'canyon-pinnacles', 'mountain', 'valley']

/**
 * What a recitation is shown on: the one its reciter chose, or — for those
 * posted before there was a choice — one of the landscapes, always the same
 * one for the same recitation.
 */
export function recitationBackground(r: { id: string; background?: string | null }): VideoBackground {
  if (r.background && isVideoBackgroundId(r.background)) return findVideoBackground(r.background)
  let h = 0
  for (let i = 0; i < r.id.length; i += 1) h = (h * 31 + r.id.charCodeAt(i)) | 0
  return findVideoBackground(LEGACY_BACKDROPS[Math.abs(h) % LEGACY_BACKDROPS.length])
}

const LAST_BACKGROUND_KEY = 'muyassar_qari_last_background'

/** The background the last recitation was posted on, so the next one starts there. */
export function lastRecitationBackground(): string {
  try {
    const saved = localStorage.getItem(LAST_BACKGROUND_KEY)
    // A photo since taken out of the pickers is not offered again.
    if (saved && isListedBackgroundId(saved)) return saved
  } catch {
    /* ignore */
  }
  return FEATURED_RECITATION_BACKGROUND_IDS[0]
}

export function rememberRecitationBackground(id: string): void {
  try {
    localStorage.setItem(LAST_BACKGROUND_KEY, id)
  } catch {
    /* ignore */
  }
}
