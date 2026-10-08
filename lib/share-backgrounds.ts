/**
 * The pictures a verse card or a recitation video can sit on.
 *
 * Most ship with the app in /public/share-bg (Unsplash licence, 1080x1350),
 * each with a small copy in /public/share-bg/thumb for the pickers: drop the two
 * files in and add a `bg` line below. The rest live on Cloudinary under
 * nadir/share-bg/: upload one there and add a `cloudBg` line.
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

export type ShareBackgroundGroup =
  | 'Makkah & Madinah'
  | 'Mosques'
  | 'Night drives'
  | 'Streets'
  | 'Cinematic'
  | 'Soft aesthetic'
  | 'Sacred'
  | 'Light and sky'
  | 'Nature'
  | 'Flowers and wildlife'
  | 'Quiet everyday'

/** The order the gallery lists them in (groups with nothing left to show are skipped by the pickers). */
export const SHARE_BACKGROUND_GROUPS: ShareBackgroundGroup[] = [
  'Makkah & Madinah',
  'Mosques',
  'Sacred',
  'Night drives',
  'Streets',
  'Cinematic',
  'Soft aesthetic',
  'Light and sky',
  'Quiet everyday',
]

function bg(id: string, label: string, group: ShareBackgroundGroup, accent: string): ShareBackground {
  return { id, label, src: `/share-bg/${id}.jpg`, thumb: `/share-bg/thumb/${id}.jpg`, group, accent }
}

const CLOUD_IMAGES = 'https://res.cloudinary.com/r2ule9za/image/upload'

/**
 * A picture kept on Cloudinary (nadir/share-bg/<id>) rather than in the app: it is
 * cut to the card's 4:5 there, around what matters in it, and only fetched when chosen.
 */
function cloudBg(id: string, label: string, group: ShareBackgroundGroup, accent: string): ShareBackground {
  return {
    id,
    label,
    src: `${CLOUD_IMAGES}/c_fill,w_1080,h_1350,g_auto,q_auto,f_jpg/nadir/share-bg/${id}`,
    thumb: `${CLOUD_IMAGES}/c_fill,w_240,h_300,g_auto,q_auto,f_jpg/nadir/share-bg/${id}`,
    group,
    accent,
  }
}

export const SHARE_BACKGROUNDS: ShareBackground[] = [
  // Makkah & Madinah
  bg('haram-arch-sunset', 'Haram at sunset', 'Makkah & Madinah', '#ffd39a'),
  bg('kaaba-door', 'Kaaba door', 'Makkah & Madinah', '#f3d489'),
  bg('kaaba-night', 'Kaaba at night', 'Makkah & Madinah', '#f3d489'),
  bg('haram-night', 'The Haram at night', 'Makkah & Madinah', '#f0d9a6'),
  bg('kaaba-day', 'Kaaba by day', 'Makkah & Madinah', '#e8d3a8'),
  bg('kaaba-clock-tower', 'Kaaba & tower', 'Makkah & Madinah', '#e8d3a8'),
  bg('makkah-clock-tower', 'Makkah clock tower', 'Makkah & Madinah', '#a9e0c4'),
  bg('green-dome', 'Green Dome', 'Makkah & Madinah', '#b6e2c6'),
  bg('green-dome-sky', 'Green Dome & sky', 'Makkah & Madinah', '#b6e2c6'),
  bg('nabawi-dusk', 'Minaret at dusk', 'Makkah & Madinah', '#ffcf94'),
  bg('madinah-night', 'Madinah at night', 'Makkah & Madinah', '#ffd39a'),
  bg('nabawi-umbrella-minaret', 'Umbrella frame', 'Makkah & Madinah', '#b4d4e8'),
  bg('nabawi-minarets', 'Nabawi minarets', 'Makkah & Madinah', '#b4d4e8'),
  bg('nabawi-umbrellas', 'Nabawi umbrellas', 'Makkah & Madinah', '#f0d9a6'),

  // The cinematic collection (Pexels, on Cloudinary)
  cloudBg('kaaba-corner', 'Kaaba corner', 'Makkah & Madinah', '#f3d489'),
  cloudBg('kaaba-from-above', 'Kaaba from above', 'Makkah & Madinah', '#f0d9a6'),
  cloudBg('tower-and-kaaba', 'Tower & Kaaba', 'Makkah & Madinah', '#e8d3a8'),
  cloudBg('green-dome-night', 'Green Dome at night', 'Makkah & Madinah', '#b6e2c6'),
  cloudBg('green-dome-blue-sky', 'Green Dome & blue sky', 'Makkah & Madinah', '#b6e2c6'),
  cloudBg('clock-tower-night', 'Clock tower at night', 'Makkah & Madinah', '#a9e0c4'),
  cloudBg('haram-crowds', 'Haram crowds', 'Makkah & Madinah', '#f0d9a6'),
  cloudBg('star-framed-minaret', 'Star-framed minaret', 'Makkah & Madinah', '#b4d4e8'),
  cloudBg('sujood-calligraphy', 'Sujood', 'Mosques', '#dcdcdc'),
  cloudBg('prayer-under-lanterns', 'Prayer under lanterns', 'Mosques', '#ffd39a'),
  cloudBg('prostration', 'Prostration', 'Mosques', '#e9cfae'),
  cloudBg('under-the-chandelier', 'Under the chandelier', 'Mosques', '#f0d9a6'),
  cloudBg('blue-minaret', 'Blue minaret', 'Mosques', '#b4d4e8'),
  cloudBg('mosque-silhouette', 'Mosque silhouette', 'Mosques', '#ffc98a'),
  cloudBg('courtyard-at-night', 'Courtyard at night', 'Mosques', '#f0d9a6'),
  cloudBg('quran-verses', 'Quran verses', 'Sacred', '#ffc7bd'),
  cloudBg('quran-in-light', 'Quran in the light', 'Sacred', '#eccf9c'),
  cloudBg('tasbih-on-quran', 'Tasbih on the Quran', 'Sacred', '#b4d4e8'),
  cloudBg('hands-and-tasbih', 'Hands & tasbih', 'Sacred', '#dcdcdc'),
  cloudBg('ramadan-evening', 'Ramadan evening', 'Sacred', '#ffcf94'),
  cloudBg('oil-lamp', 'Oil lamp', 'Sacred', '#ffcf94'),
  cloudBg('rider-at-night', 'Rider at night', 'Night drives', '#dcdcdc'),
  cloudBg('light-trails', 'Light trails', 'Night drives', '#ffc98a'),
  cloudBg('winding-road', 'Winding road', 'Night drives', '#ffd39a'),
  cloudBg('blue-traffic', 'Blue traffic', 'Night drives', '#b4d4e8'),
  cloudBg('dashboard-glow', 'Dashboard glow', 'Night drives', '#ffcf94'),
  cloudBg('car-under-lights', 'Car under lights', 'Night drives', '#dcdcdc'),
  cloudBg('black-car', 'Black car', 'Night drives', '#dcdcdc'),
  cloudBg('speed-lights', 'Speed lights', 'Night drives', '#ffc98a'),
  cloudBg('umbrella-in-neon', 'Umbrella in neon', 'Streets', '#ffc7bd'),
  cloudBg('neon-corner', 'Neon corner', 'Streets', '#ffc7bd'),
  cloudBg('red-umbrella', 'Red umbrella', 'Streets', '#ffc7bd'),
  cloudBg('umbrella-silhouettes', 'Umbrella silhouettes', 'Streets', '#ffcf94'),
  cloudBg('rain-glow', 'Rain glow', 'Streets', '#ffc98a'),
  cloudBg('wet-avenue', 'Wet avenue', 'Streets', '#b4d4e8'),
  cloudBg('rainy-boulevard', 'Rainy boulevard', 'Streets', '#b4d4e8'),
  cloudBg('night-reflections', 'Night reflections', 'Streets', '#b4d4e8'),
  cloudBg('city-reflection', 'City reflection', 'Streets', '#ffd39a'),
  cloudBg('street-lamps', 'Street lamps', 'Streets', '#dcdcdc'),
  cloudBg('crossing-light', 'Crossing light', 'Streets', '#dcdcdc'),
  cloudBg('light-lines', 'Light lines', 'Streets', '#a9d8e6'),
  cloudBg('two-trams', 'Two trams', 'Streets', '#b4d4e8'),
  cloudBg('tram-window', 'Tram window', 'Streets', '#ffd39a'),
  cloudBg('pink-tram', 'Pink tram', 'Streets', '#f8cddc'),
  cloudBg('galata-at-night', 'Galata at night', 'Streets', '#ffd39a'),
  cloudBg('lantern-alley', 'Lantern alley', 'Streets', '#ffd39a'),
  cloudBg('cobbled-lane', 'Cobbled lane', 'Streets', '#ffd39a'),
  cloudBg('arched-window', 'Arched window', 'Streets', '#ffcf94'),
  cloudBg('cafe-window', 'Café window', 'Streets', '#ffcf94'),
  cloudBg('night-cafe', 'Night café', 'Streets', '#ffcf94'),

  // Mosques (on Cloudinary)
  cloudBg('mihrab-calligraphy', 'Mihrab', 'Mosques', '#f3d489'),
  cloudBg('blue-night', 'Blue night', 'Mosques', '#b4d4e8'),
  cloudBg('golden-minbar', 'Golden minbar', 'Mosques', '#f3d489'),
  cloudBg('lamp-lit-hall', 'Lamp-lit hall', 'Mosques', '#f0d9a6'),
  cloudBg('ibn-tulun', 'Ibn Tulun courtyard', 'Mosques', '#ffd39a'),
  cloudBg('raised-hands', 'Raised hands', 'Mosques', '#dcdcdc'),
  cloudBg('chandelier-hall', 'Chandelier hall', 'Mosques', '#a9d8e6'),
  cloudBg('blue-tile-wall', 'Blue tiles', 'Mosques', '#b4d4e8'),
  cloudBg('green-carpet', 'Green carpet', 'Mosques', '#b6e2c6'),
  cloudBg('sunlit-prayer-hall', 'Sunlit prayer hall', 'Mosques', '#ffcf94'),
  cloudBg('framed-mosque', 'Framed mosque', 'Mosques', '#ffc9a3'),
  cloudBg('striped-arches', 'Striped arches', 'Mosques', '#ffc9a3'),
  cloudBg('golden-hour-mosque', 'Golden hour mosque', 'Mosques', '#ffd39a'),
  cloudBg('blue-mosque', 'Blue Mosque', 'Mosques', '#b4d4e8'),
  cloudBg('twin-minarets', 'Twin minarets', 'Mosques', '#bcd2f5'),
  cloudBg('tall-minaret', 'Tall minaret', 'Mosques', '#e9cfae'),
  cloudBg('old-courtyard', 'Old courtyard', 'Mosques', '#ecd9a6'),

  // Cinematic
  bg('golden-dunes', 'Golden dunes', 'Cinematic', '#ffc98a'),
  cloudBg('autumn-mist', 'Autumn mist', 'Cinematic', '#e9cfae'),
  bg('crescent-dusk', 'Crescent moon', 'Cinematic', '#ffcf94'),
  bg('storm-at-sea', 'Storm at sea', 'Cinematic', '#bcd2f5'),
  bg('misty-valley', 'Misty valley', 'Cinematic', '#c8e4b8'),
  bg('wild-sea', 'Wild sea', 'Cinematic', '#a9d8e6'),
  bg('lone-tree-fog', 'Lone tree', 'Cinematic', '#e2dccb'),
  bg('alpenglow', 'Mountain glow', 'Cinematic', '#f6c6c0'),
  bg('storm-clouds', 'Storm clouds', 'Cinematic', '#d4dbe3'),
  bg('still-dusk', 'Still dusk', 'Cinematic', '#f2c3b4'),
  bg('red-clouds', 'Red clouds', 'Cinematic', '#ffc7bd'),
  bg('peaks-above-clouds', 'Above the peaks', 'Cinematic', '#d6dde8'),
  bg('windswept-tree', 'Windswept tree', 'Cinematic', '#d8e0d2'),
  bg('deep-water', 'Deep water', 'Cinematic', '#a9cfe6'),
  bg('dark-shore', 'Dark shore', 'Cinematic', '#dcdcdc'),

  // Soft aesthetic
  bg('golden-shadows', 'Golden shadows', 'Soft aesthetic', '#ffcf94'),
  bg('window-glow', 'Window glow', 'Soft aesthetic', '#ffc9a3'),
  bg('sunlit-arch', 'Sunlit arch', 'Soft aesthetic', '#ffd39a'),
  bg('palm-shadow', 'Palm shadow', 'Soft aesthetic', '#e2dccb'),
  bg('pampas', 'Pampas', 'Soft aesthetic', '#e9cfae'),
  bg('light-on-wall', 'Light on a wall', 'Soft aesthetic', '#ecd9a6'),
  bg('golden-water', 'Golden water', 'Soft aesthetic', '#ffcf94'),
  bg('dried-fern', 'Dried fern', 'Soft aesthetic', '#e9cfae'),
  bg('palm-fan', 'Palm fan', 'Soft aesthetic', '#ecd9a6'),
  bg('window-shadow', 'Window shadow', 'Soft aesthetic', '#ecd9a6'),
  bg('dappled-light', 'Dappled light', 'Soft aesthetic', '#ecd9a6'),
  bg('dried-petals', 'Dried petals', 'Soft aesthetic', '#e2cdb2'),

  // Sacred
  bg('quran-flowers', 'Quran & flowers', 'Sacred', '#f6c9cd'),
  bg('quran-ornate', 'Mushaf', 'Sacred', '#eccf9c'),
  bg('tasbih', 'Tasbih', 'Sacred', '#a8e0d2'),
  bg('sujood', 'In prayer', 'Sacred', '#a9dcc4'),

  // Light and sky
  bg('above-clouds', 'Above the clouds', 'Light and sky', '#ffc9a8'),
  bg('lake-sunset', 'Lake sunset', 'Light and sky', '#ffd39a'),
  bg('candle', 'Candle', 'Light and sky', '#ffcf94'),
  bg('lantern', 'Lantern', 'Light and sky', '#ffd39a'),

  // Quiet everyday
  bg('white-rose', 'White rose', 'Quiet everyday', '#f3d9a0'),
  cloudBg('old-alley', 'Old alley', 'Quiet everyday', '#ffd39a'),
  cloudBg('city-corner', 'City corner', 'Quiet everyday', '#dcdcdc'),
  bg('rain-window', 'Rain (warm)', 'Quiet everyday', '#e8d5a4'),
  bg('rain-cool', 'Rain (cool)', 'Quiet everyday', '#aed8de'),
  bg('teacup', 'Quiet morning', 'Quiet everyday', '#e9cfae'),
  bg('elderly-hands', 'Elder hands', 'Quiet everyday', '#e2cdb2'),
  bg('small-hand', 'Small hand', 'Quiet everyday', '#dcdcdc'),
  bg('hospital', 'Hospital', 'Quiet everyday', '#a9dde0'),
  bg('hospital-drip', 'Hospital room', 'Quiet everyday', '#a9d4f0'),
]

/**
 * Taken out of the pickers, but still drawn for the recitations already posted on
 * them — so those keep the picture they were shared with. Their files stay in public/.
 */
export const RETIRED_SHARE_BACKGROUNDS: ShareBackground[] = [
  bg('mosque-arches', 'Mosque arches', 'Sacred', '#e8d3a8'),
  bg('mosque-columns', 'Mosque columns', 'Sacred', '#f0d9a6'),
  bg('kiswah-gold', 'Gold calligraphy', 'Sacred', '#f3d489'),
  bg('islamic-pattern', 'Pattern', 'Sacred', '#ffd9a3'),
  bg('sunrise', 'Sunrise', 'Light and sky', '#ffd8a0'),
  bg('palm-sunset', 'Palm sunset', 'Light and sky', '#ffc9a3'),
  bg('night-sky', 'Night sky', 'Light and sky', '#d4c2f0'),
  bg('milky-way', 'Milky way', 'Light and sky', '#bcd2f5'),
  bg('bokeh-lights', 'City lights', 'Light and sky', '#ffc9b0'),
  bg('silhouette', 'Dusk', 'Light and sky', '#e6c6ea'),
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
  bg('fox', 'Fox', 'Flowers and wildlife', '#f2c48a'),
  bg('butterfly', 'Butterfly', 'Flowers and wildlife', '#f5e27a'),
  bg('daisies', 'Daisies', 'Flowers and wildlife', '#f1e8a0'),
  bg('poppies', 'Poppies', 'Flowers and wildlife', '#ffc7bd'),
  bg('soft-bloom', 'Soft bloom', 'Flowers and wildlife', '#f8cddc'),
  bg('misty-road', 'Open road', 'Quiet everyday', '#ecd9a6'),
]

/** The few shown in the picker's strip before "More". */
export const FEATURED_SHARE_BACKGROUND_IDS = [
  'haram-arch-sunset',
  'kaaba-door',
  'green-dome',
  'golden-dunes',
  'crescent-dusk',
  'golden-shadows',
  'sunlit-arch',
]
