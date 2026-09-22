/**
 * The pictures a verse card or a recitation video can sit on.
 *
 * They ship with the app in /public/share-bg (Unsplash licence, 1080x1350),
 * each with a small copy in /public/share-bg/thumb for the pickers. Adding one
 * is: drop the two files in, add a line below.
 */

export interface ShareBackground {
  id: string
  label: string
  /** The full picture. */
  src: string
  /** A small copy for the pickers. */
  thumb: string
  group: ShareBackgroundGroup
  /** Reference-line colour on the verse card, picked to sit with this photo rather than one gold for all. */
  accent: string
}

export type ShareBackgroundGroup = 'Sacred' | 'Light and sky' | 'Nature' | 'Flowers and wildlife' | 'Quiet everyday'

/** The order the gallery lists them in. */
export const SHARE_BACKGROUND_GROUPS: ShareBackgroundGroup[] = [
  'Sacred',
  'Light and sky',
  'Nature',
  'Flowers and wildlife',
  'Quiet everyday',
]

function bg(id: string, label: string, group: ShareBackgroundGroup, accent: string): ShareBackground {
  return { id, label, src: `/share-bg/${id}.jpg`, thumb: `/share-bg/thumb/${id}.jpg`, group, accent }
}

export const SHARE_BACKGROUNDS: ShareBackground[] = [
  // Sacred
  bg('mosque-arches', 'Mosque arches', 'Sacred', '#e8d3a8'),
  bg('mosque-columns', 'Mosque columns', 'Sacred', '#f0d9a6'),
  bg('kiswah-gold', 'Gold calligraphy', 'Sacred', '#f3d489'),
  bg('islamic-pattern', 'Pattern', 'Sacred', '#ffd9a3'),
  bg('quran-flowers', 'Quran & flowers', 'Sacred', '#f6c9cd'),
  bg('quran-ornate', 'Mushaf', 'Sacred', '#eccf9c'),
  bg('tasbih', 'Tasbih', 'Sacred', '#a8e0d2'),
  bg('sujood', 'In prayer', 'Sacred', '#a9dcc4'),

  // Light and sky
  bg('sunrise', 'Sunrise', 'Light and sky', '#ffd8a0'),
  bg('above-clouds', 'Above the clouds', 'Light and sky', '#ffc9a8'),
  bg('palm-sunset', 'Palm sunset', 'Light and sky', '#ffc9a3'),
  bg('night-sky', 'Night sky', 'Light and sky', '#d4c2f0'),
  bg('milky-way', 'Milky way', 'Light and sky', '#bcd2f5'),
  bg('candle', 'Candle', 'Light and sky', '#ffcf94'),
  bg('lantern', 'Lantern', 'Light and sky', '#ffd39a'),
  bg('bokeh-lights', 'City lights', 'Light and sky', '#ffc9b0'),
  bg('silhouette', 'Dusk', 'Light and sky', '#e6c6ea'),

  // Nature
  bg('lake-sunset', 'Lake sunset', 'Nature', '#ffd39a'),
  bg('still-water', 'Still water', 'Nature', '#a9d8e6'),
  bg('blue-hills', 'Blue hills', 'Nature', '#b4d4e8'),
  bg('peaks', 'Peaks', 'Nature', '#f2c3b4'),
  bg('cliffs', 'Cliffs', 'Nature', '#bfe0c4'),
  bg('river', 'River', 'Nature', '#b6e2c6'),
  bg('forest', 'Forest', 'Nature', '#c8e4b8'),
  bg('woodland', 'Woodland', 'Nature', '#c4e2bb'),
  bg('old-tree', 'Old tree', 'Nature', '#dbe6b4'),
  bg('sunlight', 'Sunlight', 'Nature', '#e4dfa6'),
  bg('meadow', 'Meadow', 'Nature', '#ffe0a0'),

  // Flowers and wildlife
  bg('fox', 'Fox', 'Flowers and wildlife', '#f2c48a'),
  bg('butterfly', 'Butterfly', 'Flowers and wildlife', '#f5e27a'),
  bg('white-rose', 'White rose', 'Flowers and wildlife', '#f3d9a0'),
  bg('daisies', 'Daisies', 'Flowers and wildlife', '#f1e8a0'),
  bg('poppies', 'Poppies', 'Flowers and wildlife', '#ffc7bd'),
  bg('soft-bloom', 'Soft bloom', 'Flowers and wildlife', '#f8cddc'),

  // Quiet everyday
  bg('rain-window', 'Rain (warm)', 'Quiet everyday', '#e8d5a4'),
  bg('rain-cool', 'Rain (cool)', 'Quiet everyday', '#aed8de'),
  bg('misty-road', 'Open road', 'Quiet everyday', '#ecd9a6'),
  bg('teacup', 'Quiet morning', 'Quiet everyday', '#e9cfae'),
  bg('elderly-hands', 'Elder hands', 'Quiet everyday', '#e2cdb2'),
  bg('small-hand', 'Small hand', 'Quiet everyday', '#dcdcdc'),
  bg('hospital', 'Hospital', 'Quiet everyday', '#a9dde0'),
  bg('hospital-drip', 'Hospital room', 'Quiet everyday', '#a9d4f0'),
]

/** The few shown in the picker's strip before "More". */
export const FEATURED_SHARE_BACKGROUND_IDS = [
  'mosque-arches',
  'kiswah-gold',
  'sunrise',
  'night-sky',
  'lake-sunset',
  'fox',
  'white-rose',
]
