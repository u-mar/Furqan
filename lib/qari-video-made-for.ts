/**
 * What a recitation's share video shows besides the recording: its background, and its title when
 * it has no ayah marks (the video then shows the title instead). A cloud video made for anything
 * else is out of date. Shared by the page that makes it and the server that keeps it.
 */
export function cloudVideoFor(r: { background?: string | null; title?: string | null; verseTimeline?: unknown }): string {
  const marked = Array.isArray(r.verseTimeline) && r.verseTimeline.length > 0
  return JSON.stringify({ background: r.background || 'black', title: marked ? '' : r.title || 'Recitation' })
}
