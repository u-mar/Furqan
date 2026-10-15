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
  'motion-kaaba-door',
  'motion-neon-rain',
  'motion-moonlit-minaret',
  'motion-night-rider',
  'motion-green-dome',
  'motion-walk-into-the-fog',
  'motion-quran-script',
]

/**
 * The kinds of scene a Quran edit cuts between, a new one for every ayah — the
 * look of the videos people share (one mood, many places): fifteen clips each,
 * no two alike.
 */
export const EDIT_GROUPS = [
  'Winter sunsets',
  'Waterfalls',
  'Misty rivers',
  'Night sea',
  'Mountain meadows',
  'Light through clouds',
  'Foggy mountains',
  'Snowy nights',
] as const

/** The kinds of scenery, each a set of clips alike enough to cut between in one video. */
export const SCENERY_GROUPS = [
  'Night sky',
  'Rain',
  'Golden hour',
  'Clouds',
  'Mountains',
  'Ocean',
  'Desert',
  'Snow',
  'Forest',
  'Waterfalls & lakes',
] as const

// Several groups hold both moving clips and photos, so each is listed once.
export const VIDEO_BACKGROUND_GROUPS = [
  ...new Set([
    'Plain',
    ...EDIT_GROUPS,
    'Makkah & Madinah',
    'Mosques',
    'Quran',
    'Prayer',
    'Night drives',
    'Streets',
    'Moody night',
    'Silhouettes',
    'Storms',
    ...SCENERY_GROUPS,
    'Motion',
    'Landscapes',
    ...SHARE_BACKGROUND_GROUPS,
  ]),
]

const MOTION_CLOUD_BASE = 'https://res.cloudinary.com/r2ule9za/video/upload/nadir/share-bg-video'

type SceneryGroup = (typeof SCENERY_GROUPS)[number]
type EditGroup = (typeof EDIT_GROUPS)[number]

type MotionGroup =
  | 'Motion'
  | 'Makkah & Madinah'
  | 'Mosques'
  | 'Quran'
  | 'Prayer'
  | 'Night drives'
  | 'Streets'
  | 'Moody night'
  | 'Silhouettes'
  | 'Storms'
  | SceneryGroup
  | EditGroup

/**
 * Looping clips, hosted on Cloudinary (see public/share-bg-video's absence: these never ship in the app bundle).
 * The first six are Coverr footage; the rest are Pexels clips cut into short portrait loops (720×1280, silent,
 * the end faded into the start).
 */
const MOTION_BACKGROUNDS: VideoBackground[] = (
  [
    ['sunset-in-auckland-new-zealand', 'Auckland sunset', 'Motion'],
    ['sunset-on-sayulita-beach-in-mexico', 'Sayulita beach', 'Motion'],
    ['river-surrounded-by-mountains', 'Mountain river', 'Motion'],
    ['sunset-on-the-beach', 'Beach sunset', 'Motion'],
    ['purple-flowers-at-sunset', 'Purple flowers', 'Motion'],
    ['sun-setting-in-auckland-new-zealand', 'Auckland sun', 'Motion'],
    ['lone-tree-sunset', 'Lone tree', 'Motion'],
    ['pink-sea', 'Pink sea', 'Motion'],
    ['calm-lake-dusk', 'Calm lake', 'Motion'],
    ['winding-river', 'Winding river', 'Motion'],
    ['lakeside-tree', 'Lakeside tree', 'Motion'],
    ['wild-tulips', 'Wild tulips', 'Motion'],
    ['white-blossoms', 'White blossoms', 'Motion'],
    ['pink-roses', 'Pink roses', 'Motion'],
    ['misty-autumn-road', 'Misty road', 'Motion'],
    ['windy-hills', 'Windy hills', 'Motion'],
    ['wind-turbine-dusk', 'Wind turbine', 'Motion'],
    ['forest-cabin', 'Forest cabin', 'Motion'],
    ['green-meadow', 'Green meadow', 'Motion'],
    ['lake-castle', 'Lake castle', 'Motion'],
    ['town-at-sunset', 'Town at sunset', 'Motion'],
    ['sea-at-dusk', 'Sea at dusk', 'Motion'],
    ['wild-daisies', 'Wild daisies', 'Motion'],
    ['golden-grass', 'Golden grass', 'Motion'],
    ['island-at-dusk', 'Island at dusk', 'Motion'],
    ['treetop', 'Treetop', 'Motion'],
    ['ferry-at-sunset', 'Ferry at sunset', 'Motion'],
    ['cliff-and-sea', 'Cliff & sea', 'Motion'],
    ['deep-dive', 'Deep dive', 'Motion'],
    ['white-horse', 'White horse', 'Motion'],

    ['kaaba-pilgrims', 'Pilgrims at the Kaaba', 'Mosques'],
    ['toward-the-tower', 'Toward the tower', 'Mosques'],
    ['under-the-dome', 'Under the dome', 'Mosques'],
    ['green-corridor', 'Green corridor', 'Mosques'],
    ['nabawi-plaza', 'Nabawi plaza', 'Mosques'],
    ['nabawi-evening', 'Nabawi evening', 'Mosques'],
    ['umbrellas-minaret', 'Umbrellas & minaret', 'Mosques'],
    ['nabawi-interior', 'Nabawi interior', 'Mosques'],
    ['mosque-doorway', 'Mosque doorway', 'Mosques'],
    ['pigeons-arches', 'Pigeons & arches', 'Mosques'],
    ['prayer-hall', 'Prayer hall', 'Mosques'],
    ['night-courtyard', 'Night courtyard', 'Mosques'],
    ['mosque-interior', 'Mosque interior', 'Mosques'],
    ['red-mihrab', 'Red mihrab', 'Mosques'],
    ['before-the-mihrab', 'Before the mihrab', 'Mosques'],
    ['ornate-gate', 'Ornate gate', 'Mosques'],
    ['open-door', 'Open door', 'Mosques'],
    ['mosque-window', 'Mosque window', 'Mosques'],
    ['green-tiles', 'Green tiles', 'Mosques'],
    ['stained-glass', 'Stained glass', 'Mosques'],
    ['blue-domes', 'Blue domes', 'Mosques'],
    ['waterfront-mosque', 'Waterfront mosque', 'Mosques'],
    ['mosque-pigeons', 'Pigeons at the mosque', 'Mosques'],
    ['mosque-in-rain', 'Rain at the mosque', 'Mosques'],
    ['fish-pool', 'Fish pool', 'Mosques'],
    ['courtyard-arches', 'Courtyard arches', 'Mosques'],

    ['night-drive', 'Night drive', 'Night drives'],
    ['wet-road', 'Wet road', 'Night drives'],
    ['palm-road', 'Palm road', 'Night drives'],
    ['highway-lights', 'Highway lights', 'Night drives'],
    ['night-city', 'Night city', 'Night drives'],
    ['night-highway', 'Night highway', 'Night drives'],
    ['night-road', 'Night road', 'Night drives'],
    ['quiet-road', 'Quiet road', 'Night drives'],
    ['dusk-traffic', 'Dusk traffic', 'Night drives'],

    ['rainy-street', 'Rainy street', 'Streets'],
    ['old-quarter', 'Old quarter', 'Streets'],
    ['neon-street', 'Neon street', 'Streets'],
    ['city-street', 'City street', 'Streets'],
    ['village-street', 'Village street', 'Streets'],

    // The cinematic collection (Pexels, picked for recitation videos)
    ['kaaba-tawaf', 'Tawaf', 'Makkah & Madinah'],
    ['hajj-crowd', 'Hajj crowd', 'Makkah & Madinah'],
    ['kaaba-arcade', 'Kaaba through the arches', 'Makkah & Madinah'],
    ['kaaba-door', 'Kaaba door', 'Makkah & Madinah'],
    ['kaaba-night', 'Kaaba at night', 'Makkah & Madinah'],
    ['haram-from-above', 'The Haram from above', 'Makkah & Madinah'],
    ['nabawi-courtyard', 'Nabawi courtyard', 'Makkah & Madinah'],
    ['nabawi-gathering', 'Evening at Nabawi', 'Makkah & Madinah'],
    ['green-dome', 'Green Dome', 'Makkah & Madinah'],
    ['nabawi-gate', 'Nabawi gate', 'Makkah & Madinah'],
    ['nabawi-canopies', 'Nabawi canopies', 'Makkah & Madinah'],
    ['moonlit-minaret', 'Moonlit minaret', 'Mosques'],
    ['mosque-at-night', 'Mosque at night', 'Mosques'],
    ['lit-mosque-above', 'Lit mosque from above', 'Mosques'],
    ['selimiye-above', 'Selimiye from above', 'Mosques'],
    ['selimiye-minaret', 'Selimiye minaret', 'Mosques'],
    ['calligraphy-ceiling', 'Calligraphy ceiling', 'Mosques'],
    ['dome-calligraphy', 'Dome calligraphy', 'Mosques'],
    ['grand-chandelier', 'Grand chandelier', 'Mosques'],
    ['eyup-sultan', 'Eyüp Sultan', 'Mosques'],
    ['quran-script', 'Quran script', 'Quran'],
    ['quran-misbaha', 'Quran & misbaha', 'Quran'],
    ['reading-by-window', 'Reading by the window', 'Quran'],
    ['lantern-table', 'Lantern on the table', 'Quran'],
    ['ramadan-lamps', 'Ramadan lamps', 'Quran'],
    ['night-rain', 'Night rain', 'Night drives'],
    ['city-drive', 'City drive', 'Night drives'],
    ['rainstorm-drive', 'Rainstorm drive', 'Night drives'],
    ['rain-on-window', 'Rain on the window', 'Night drives'],
    ['windshield-rain', 'Windshield rain', 'Night drives'],
    ['city-lights', 'City lights', 'Night drives'],
    ['night-traffic', 'Night traffic', 'Night drives'],
    ['traffic-bokeh', 'Traffic bokeh', 'Night drives'],
    ['the-road-ahead', 'The road ahead', 'Night drives'],
    ['blue-tunnel', 'Blue tunnel', 'Night drives'],
    ['lit-bridge', 'Lit bridge', 'Night drives'],
    ['night-rider', 'Night rider', 'Night drives'],
    ['metro-arrival', 'Metro arrival', 'Streets'],
    ['yellow-train', 'Yellow train', 'Streets'],
    ['night-tram', 'Night tram', 'Streets'],
    ['neon-rain', 'Neon rain', 'Streets'],
    ['rainy-night-street', 'Rainy night street', 'Streets'],
    ['rain-and-lights', 'Rain and lights', 'Streets'],
    ['walking-at-night', 'Walking at night', 'Streets'],
    ['red-tram', 'Red tram', 'Streets'],
    ['historic-alley', 'Historic alley', 'Streets'],
    ['alley-at-night', 'Alley at night', 'Streets'],
    ['old-cafe', 'Old café', 'Streets'],
    ['crowd-shadows', 'Crowd shadows', 'Streets'],
    ['walk-into-the-fog', 'Walk into the fog', 'Streets'],
    // Scenery: Pexels clips, six of each kind.
    ['scenery-alpenglow-peak', 'Alpenglow peak', 'Mountains'],
    ['scenery-cloud-valley', 'Cloud valley at dusk', 'Mountains'],
    ['scenery-sea-of-clouds', 'Sea of clouds', 'Mountains'],
    ['scenery-blue-ridges', 'Blue ridges', 'Mountains'],
    ['scenery-dark-mist', 'Dark mist', 'Mountains'],
    ['scenery-rolling-clouds', 'Rolling clouds', 'Mountains'],
    ['scenery-storm-tower', 'Storm tower', 'Clouds'],
    ['scenery-dreamy-blue', 'Dreamy blue', 'Clouds'],
    ['scenery-hidden-sun', 'Hidden sun', 'Clouds'],
    ['scenery-wing-view', 'Above the clouds', 'Clouds'],
    ['scenery-window-seat', 'Window seat', 'Clouds'],
    ['scenery-golden-horizon', 'Golden horizon', 'Clouds'],
    ['scenery-sun-on-the-sea', 'Sun on the sea', 'Golden hour'],
    ['scenery-shore-silhouette', 'Shore silhouette', 'Golden hour'],
    ['scenery-grass-flare', 'Grass & sun', 'Golden hour'],
    ['scenery-fire-sky', 'Fire sky', 'Golden hour'],
    ['scenery-golden-river', 'Golden river', 'Golden hour'],
    ['scenery-orange-sun', 'Orange sun', 'Golden hour'],
    ['scenery-turquoise-surf', 'Turquoise surf', 'Ocean'],
    ['scenery-deep-teal', 'Deep teal', 'Ocean'],
    ['scenery-black-sand', 'Black sand', 'Ocean'],
    ['scenery-sea-at-dusk', 'Sea at dusk', 'Ocean'],
    ['scenery-mono-waves', 'Mono waves', 'Ocean'],
    ['scenery-violet-sea', 'Violet sea', 'Ocean'],
    ['scenery-star-vortex', 'Star vortex', 'Night sky'],
    ['scenery-milky-way-lake', 'Milky Way lake', 'Night sky'],
    ['scenery-stars-through-trees', 'Stars through trees', 'Night sky'],
    ['scenery-lighthouse-stars', 'Lighthouse stars', 'Night sky'],
    ['scenery-moon-and-clouds', 'Moon & clouds', 'Night sky'],
    ['scenery-milky-way-forest', 'Milky Way forest', 'Night sky'],
    ['scenery-rainy-sunset', 'Rainy sunset', 'Rain'],
    ['scenery-raindrops', 'Raindrops', 'Rain'],
    ['scenery-rainy-highway', 'Rainy highway', 'Rain'],
    ['scenery-wet-reflections', 'Wet reflections', 'Rain'],
    ['scenery-night-window', 'Night window', 'Rain'],
    ['scenery-city-bokeh', 'City bokeh', 'Rain'],
    ['scenery-camel-shadows', 'Camel shadows', 'Desert'],
    ['scenery-dune-pattern', 'Dune pattern', 'Desert'],
    ['scenery-dune-walker', 'Dune walker', 'Desert'],
    ['scenery-caravan', 'Caravan', 'Desert'],
    ['scenery-sahara-sunset', 'Sahara sunset', 'Desert'],
    ['scenery-dune-ridge', 'Dune ridge', 'Desert'],
    ['scenery-glowing-tree', 'Glowing tree', 'Snow'],
    ['scenery-lantern-snow', 'Lantern snow', 'Snow'],
    ['scenery-snowy-street', 'Snowy street', 'Snow'],
    ['scenery-winter-sunrise', 'Winter sunrise', 'Snow'],
    ['scenery-winter-stream', 'Winter stream', 'Snow'],
    ['scenery-frosted-pines', 'Frosted pines', 'Snow'],
    ['scenery-pink-dawn', 'Pink dawn', 'Forest'],
    ['scenery-golden-road', 'Golden road', 'Forest'],
    ['scenery-green-road', 'Green road', 'Forest'],
    ['scenery-into-the-mist', 'Into the mist', 'Forest'],
    ['scenery-sun-in-the-pines', 'Sun in the pines', 'Forest'],
    ['scenery-forest-beams', 'Forest beams', 'Forest'],
    ['scenery-rainbow-falls', 'Rainbow falls', 'Waterfalls & lakes'],
    ['scenery-gorge-falls', 'Gorge falls', 'Waterfalls & lakes'],
    ['scenery-mossy-falls', 'Mossy falls', 'Waterfalls & lakes'],
    ['scenery-lone-pine', 'Lone pine', 'Waterfalls & lakes'],
    ['scenery-reed-lake', 'Reed lake', 'Waterfalls & lakes'],
    ['scenery-still-sunset', 'Still sunset', 'Waterfalls & lakes'],
    // Moody night, Islamic, cinematic nature and silhouettes: Pexels clips.
    ['night-crescent', 'Night crescent', 'Night sky'],
    ['city-lights-drive', 'City lights drive', 'Night drives'],
    ['porch-light-rain', 'Porch light rain', 'Rain'],
    ['single-candle', 'Single candle', 'Moody night'],
    ['full-moon-clouds', 'Full moon in cloud', 'Night sky'],
    ['red-lights-wet-road', 'Red lights, wet road', 'Night drives'],
    ['windshield-rain-rays', 'Rain and light rays', 'Rain'],
    ['neon-wet-street', 'Neon wet street', 'Moody night'],
    ['stormy-sea-dusk', 'Stormy sea at dusk', 'Storms'],
    ['teal-street-lamps', 'Teal street lamps', 'Moody night'],
    ['rainy-bus-window', 'Rainy bus window', 'Rain'],
    ['foggy-city-night', 'Foggy city night', 'Moody night'],
    ['quran-on-carpet', 'Quran on the carpet', 'Quran'],
    ['minaret-crescent-dusk', 'Minarets and crescent', 'Mosques'],
    ['teal-sky-mosque', 'Mosque, teal sky', 'Mosques'],
    ['sujood', 'Sujood', 'Prayer'],
    ['ramadan-lights-mosque', 'Ramadan lights', 'Mosques'],
    ['standing-in-prayer', 'Standing in prayer', 'Prayer'],
    ['lit-minaret-night', 'Lit minaret', 'Mosques'],
    ['hands-holding-quran', 'Holding the Quran', 'Quran'],
    ['blue-mosque-dusk', 'Blue mosque at dusk', 'Mosques'],
    ['candle-lanterns', 'Candle lanterns', 'Quran'],
    ['golden-mosque-night', 'Golden mosque at night', 'Mosques'],
    ['dome-and-arches', 'Dome and arches', 'Mosques'],
    ['ocean-foam-aerial', 'Ocean foam', 'Ocean'],
    ['foggy-road-headlights', 'Foggy road at night', 'Night drives'],
    ['gulls-golden-sea', 'Gulls, golden sea', 'Ocean'],
    ['violet-lightning', 'Violet lightning', 'Storms'],
    ['sun-through-fog', 'Sun through fog', 'Forest'],
    ['fiery-cloud', 'Fiery cloud', 'Clouds'],
    ['sun-halo', 'Sun halo', 'Clouds'],
    ['bird-flock-dusk', 'Birds at dusk', 'Clouds'],
    ['misty-pine-forest', 'Misty pine forest', 'Forest'],
    ['golden-storm-clouds', 'Golden storm clouds', 'Storms'],
    ['glittering-dark-water', 'Glittering dark water', 'Ocean'],
    ['city-lightning', 'Lightning over the city', 'Storms'],
    ['kneeling-prayer-rug', 'On the prayer rug', 'Prayer'],
    ['hilltop-silhouette', 'Hilltop silhouette', 'Silhouettes'],
    ['rocks-by-the-sea', 'By the sea', 'Silhouettes'],
    ['kufi-by-the-sea', 'Watching the sea', 'Silhouettes'],
    ['backlit-silhouette', 'Backlit', 'Silhouettes'],
    ['shadow-lane-walk', 'Walk in the shadows', 'Silhouettes'],
    ['rooftop-dusk', 'Rooftop at dusk', 'Silhouettes'],
    ['sunset-railing', 'Sunset railing', 'Silhouettes'],
    ['walk-into-the-light', 'Into the light', 'Silhouettes'],
    ['streetlamp-walk', 'Under the streetlamp', 'Silhouettes'],
    ['foggy-road-walker', 'Foggy road walker', 'Silhouettes'],

    ['snow-field-sunset', 'Snow field sunset', 'Winter sunsets'],
    ['frozen-reflection', 'Frozen reflection', 'Winter sunsets'],
    ['snowy-river-dusk', 'Snowy river at dusk', 'Winter sunsets'],
    ['sun-over-snow', 'Sun over the snow', 'Winter sunsets'],
    ['icy-shore', 'Icy shore', 'Winter sunsets'],
    ['sunset-through-pines', 'Sunset through pines', 'Winter sunsets'],
    ['blue-hour-forest', 'Blue hour forest', 'Winter sunsets'],
    ['pink-frozen-lake', 'Pink frozen lake', 'Winter sunsets'],
    ['red-winter-sun', 'Red winter sun', 'Winter sunsets'],
    ['lake-tree-sunset', 'Lake tree at sunset', 'Winter sunsets'],
    ['frozen-sea-haze', 'Frozen sea haze', 'Winter sunsets'],
    ['snowy-rail-sunset', 'Snowy rail at sunset', 'Winter sunsets'],
    ['pink-cloud-dusk', 'Pink cloud at dusk', 'Winter sunsets'],
    ['bare-trees-sunset', 'Bare trees at sunset', 'Winter sunsets'],
    ['reeds-in-snow', 'Reeds in snow', 'Winter sunsets'],

    ['two-tier-falls', 'Two-tier falls', 'Waterfalls'],
    ['falls-and-flowers', 'Falls & flowers', 'Waterfalls'],
    ['jungle-falls', 'Jungle falls', 'Waterfalls'],
    ['blue-rapids', 'Blue rapids', 'Waterfalls'],
    ['mossy-cascade', 'Mossy cascade', 'Waterfalls'],
    ['curtain-falls', 'Curtain falls', 'Waterfalls'],
    ['falls-from-below', 'Falls from below', 'Waterfalls'],
    ['roaring-falls', 'Roaring falls', 'Waterfalls'],
    ['black-rock-cascade', 'Black rock cascade', 'Waterfalls'],
    ['green-cliff-falls', 'Green cliff falls', 'Waterfalls'],
    ['dark-gorge', 'Dark gorge', 'Waterfalls'],
    ['blue-gorge', 'Blue gorge', 'Waterfalls'],
    ['canyon-falls', 'Canyon falls', 'Waterfalls'],
    ['pine-falls', 'Pine falls', 'Waterfalls'],
    ['wide-falls', 'Wide falls', 'Waterfalls'],

    ['peonies-in-mist', 'Peonies in mist', 'Misty rivers'],
    ['misty-sun', 'Misty sun', 'Misty rivers'],
    ['dawn-lake', 'Dawn lake', 'Misty rivers'],
    ['foggy-pier', 'Foggy pier', 'Misty rivers'],
    ['misty-woods', 'Misty woods', 'Misty rivers'],
    ['mirror-lake', 'Mirror lake', 'Misty rivers'],
    ['blue-mist', 'Blue mist', 'Misty rivers'],
    ['pink-mist', 'Pink mist', 'Misty rivers'],
    ['golden-mist-swans', 'Golden mist', 'Misty rivers'],
    ['misty-pines', 'Misty pines', 'Misty rivers'],
    ['rose-fog', 'Rose fog', 'Misty rivers'],
    ['river-glow', 'River glow', 'Misty rivers'],
    ['dusk-river', 'Dusk river', 'Misty rivers'],
    ['lake-through-branches', 'Lake through branches', 'Misty rivers'],
    ['green-river', 'Green river', 'Misty rivers'],

    ['pier-lights', 'Pier lights', 'Night sea'],
    ['silver-sea', 'Silver sea', 'Night sea'],
    ['moon-path', 'Moon path', 'Night sea'],
    ['dark-waves', 'Dark waves', 'Night sea'],
    ['lighthouse-storm', 'Lighthouse', 'Night sea'],
    ['night-foam', 'Night foam', 'Night sea'],
    ['glinting-waves', 'Glinting waves', 'Night sea'],
    ['ships-at-night', 'Ships at night', 'Night sea'],
    ['harbour-at-night', 'Harbour at night', 'Night sea'],
    ['last-light', 'Last light', 'Night sea'],
    ['black-sand-shore', 'Black sand shore', 'Night sea'],
    ['ember-horizon', 'Ember horizon', 'Night sea'],
    ['golden-moon', 'Golden moon', 'Night sea'],
    ['storm-surf', 'Storm surf', 'Night sea'],
    ['coast-lights', 'Coast lights', 'Night sea'],

    ['golden-meadow', 'Golden meadow', 'Mountain meadows'],
    ['alpine-lake', 'Alpine lake', 'Mountain meadows'],
    ['meadow-stream', 'Meadow stream', 'Mountain meadows'],
    ['valley-at-dusk', 'Valley at dusk', 'Mountain meadows'],
    ['valley-sunset', 'Valley sunset', 'Mountain meadows'],
    ['peaks-in-fog', 'Peaks in fog', 'Mountain meadows'],
    ['river-gorge', 'River gorge', 'Mountain meadows'],
    ['sunbeam-valley', 'Sunbeam valley', 'Mountain meadows'],
    ['alpine-valley', 'Alpine valley', 'Mountain meadows'],
    ['dusk-ridges', 'Dusk ridges', 'Mountain meadows'],
    ['mountain-range', 'Mountain range', 'Mountain meadows'],
    ['pink-hills', 'Pink hills', 'Mountain meadows'],
    ['lake-from-above', 'Lake from above', 'Mountain meadows'],
    ['mountain-huts', 'Mountain huts', 'Mountain meadows'],
    ['snowy-peak-dusk', 'Snowy peak', 'Mountain meadows'],

    ['rays-over-fields', 'Rays over fields', 'Light through clouds'],
    ['sun-behind-cloud', 'Sun behind a cloud', 'Light through clouds'],
    ['forest-sunbeams', 'Forest sunbeams', 'Light through clouds'],
    ['light-shaft', 'Light shaft', 'Light through clouds'],
    ['glowing-storm', 'Glowing storm', 'Light through clouds'],
    ['golden-layers', 'Golden layers', 'Light through clouds'],
    ['golden-sun', 'Golden sun', 'Light through clouds'],
    ['gilded-clouds', 'Gilded clouds', 'Light through clouds'],
    ['sun-through-leaves', 'Sun through leaves', 'Light through clouds'],
    ['above-the-clouds-dusk', 'Above the clouds', 'Light through clouds'],
    ['sun-over-clouds', 'Sun over clouds', 'Light through clouds'],
    ['towering-cloud', 'Towering cloud', 'Light through clouds'],
    ['pink-sky', 'Pink sky', 'Light through clouds'],
    ['lit-clouds', 'Lit clouds', 'Light through clouds'],
    ['break-in-the-clouds', 'Break in the clouds', 'Light through clouds'],

    ['jagged-peaks', 'Jagged peaks', 'Foggy mountains'],
    ['fog-over-the-ridge', 'Fog over the ridge', 'Foggy mountains'],
    ['peak-in-fog', 'Peak in fog', 'Foggy mountains'],
    ['misty-hill', 'Misty hill', 'Foggy mountains'],
    ['golden-haze', 'Golden haze', 'Foggy mountains'],
    ['blue-dusk-peaks', 'Blue dusk peaks', 'Foggy mountains'],
    ['misty-crag', 'Misty crag', 'Foggy mountains'],
    ['cloud-ridge', 'Cloud ridge', 'Foggy mountains'],
    ['valley-of-clouds', 'Valley of clouds', 'Foggy mountains'],
    ['cliff-falls', 'Cliff falls', 'Foggy mountains'],
    ['green-peak-in-mist', 'Green peak in mist', 'Foggy mountains'],
    ['fog-and-blossom', 'Fog & blossom', 'Foggy mountains'],
    ['rising-fog', 'Rising fog', 'Foggy mountains'],
    ['peaks-above-clouds', 'Peaks above clouds', 'Foggy mountains'],
    ['misty-cliffs', 'Misty cliffs', 'Foggy mountains'],

    ['lamp-in-branches', 'Lamp in branches', 'Snowy nights'],
    ['globe-lamp', 'Globe lamp', 'Snowy nights'],
    ['warm-lamp', 'Warm lamp', 'Snowy nights'],
    ['snowy-pine', 'Snowy pine', 'Snowy nights'],
    ['snowstorm-light', 'Snowstorm light', 'Snowy nights'],
    ['frosted-branch', 'Frosted branch', 'Snowy nights'],
    ['snowy-lane', 'Snowy lane', 'Snowy nights'],
    ['quiet-street', 'Quiet street', 'Snowy nights'],
    ['lantern-in-snow', 'Lantern in snow', 'Snowy nights'],
    ['golden-flakes', 'Golden flakes', 'Snowy nights'],
    ['teal-lamp', 'Teal lamp', 'Snowy nights'],
    ['lamps-and-trees', 'Lamps & trees', 'Snowy nights'],
    ['snowfall', 'Snowfall', 'Snowy nights'],
    ['frost-tree', 'Frost tree', 'Snowy nights'],
    ['snowy-road', 'Snowy road', 'Snowy nights'],
  ] as const satisfies readonly (readonly [string, string, MotionGroup])[]
).map(([id, label, group]) => ({
  id: `motion-${id}`,
  label,
  // Cloudinary derives a JPG frame from the video on request — no separate upload needed.
  url: `${MOTION_CLOUD_BASE}/${id}.jpg`,
  // A small crop of that frame for the pickers — the full one is 1920px wide.
  thumb: `${MOTION_CLOUD_BASE.replace('/video/upload/', '/video/upload/w_240,h_300,c_fill,q_auto/')}/${id}.jpg`,
  videoUrl: `${MOTION_CLOUD_BASE}/${id}.mp4`,
  group,
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
  'motion-snow-field-sunset',
  'motion-falls-and-flowers',
  'motion-pier-lights',
  'motion-rays-over-fields',
  'motion-kaaba-door',
  'motion-neon-rain',
  'motion-moonlit-minaret',
  'motion-night-rider',
  'motion-green-dome',
  'motion-blue-tunnel',
  'motion-quran-script',
  'motion-walk-into-the-fog',
  'motion-night-tram',
  'motion-calligraphy-ceiling',
  'photo-haram-arch-sunset',
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

/** Kinds whose clips look alike enough to cut between: not the old mixed "Motion" set. */
const MIXABLE_GROUPS = new Set<string>([
  ...EDIT_GROUPS,
  'Makkah & Madinah',
  'Mosques',
  'Quran',
  'Prayer',
  'Night drives',
  'Streets',
  'Moody night',
  'Silhouettes',
  'Storms',
  ...SCENERY_GROUPS,
])

/**
 * The clips a recitation's background moves through: the one chosen first, then
 * the others of its kind, so a video cuts between scenes like it instead of one
 * loop over and over. Just the chosen one for a photo, black, or a clip of no
 * particular kind.
 */
export function backgroundReel(background: VideoBackground): VideoBackground[] {
  if (!background.videoUrl || !MIXABLE_GROUPS.has(background.group)) return [background]
  const kin = MOTION_BACKGROUNDS.filter((b) => b.group === background.group && b.id !== background.id)
  // The rest always in the same order for the same choice, but not the gallery's.
  let seed = 0
  for (let i = 0; i < background.id.length; i += 1) seed = (seed * 31 + background.id.charCodeAt(i)) | 0
  const order = kin
    .map((b, i) => ({ b, k: Math.abs((seed + i * 2654435761) | 0) % 997 }))
    .sort((x, y) => x.k - y.k)
    .map((x) => x.b)
  // Ten scenes at most: a new one for each ayah of most recitations, without fetching a whole gallery.
  return [background, ...order.slice(0, 9)]
}
