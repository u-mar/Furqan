# Qari visual redesign — brief

Hand-off for a fresh session. Read all of this before touching code.

## How to start

1. Read this file.
2. Look at the mockup: `docs/qari-redesign/mockup.html`. To see it rendered, copy it to
   `public/qari-mockup.html`, open `http://localhost:3000/qari-mockup.html` in the browser pane, then
   **delete the copy** when done (it must not ship).
3. Do **one phase at a time**. After each phase: typecheck, test in the browser at phone size, show the
   user screenshots, and **stop for their approval** before the next phase.

## Context

- App: **Nadir**, a Quran PWA (Next.js 16, React 18, TypeScript, Tailwind 3.4, Prisma + MongoDB). Going to
  the Play Store.
- The user speaks English as a second language, writes short messages, and cares a lot about a premium,
  authentic look. Keep replies short and plain. Explain decisions in simple words.
- The **Read** screen was just redesigned to feel like a premium printed mushaf: warm ivory paper with fine
  grain, gold hairline rules, Madani calligraphy for surah names, a teal accent. Qari currently looks like
  a generic podcast app (cool grey background, white cards, **black** buttons, letter-only avatars, flat grey
  waveforms). **Goal: make Qari feel like the same premium world as Read, built for listening.**

## Ground rules

- **Visual redesign only.** Keep every existing behaviour working: play/queue, like, share sheet (incl.
  share-as-video), report, delete, privacy toggle, follow, pull-to-refresh, search, hashtags, sheikh
  imitation pages, notifications, drafts, the recording pipeline. No API or database changes unless a phase
  says so.
- **Scope the new palette to Qari.** Qari shares the Home screen's `--home-*` tokens (defined near the top
  of `app/globals.css`, light and dark). Do **not** change those globally — Home would change too. Add a
  `qari-theme` class on `QariScreen`'s `<main>` (`components/qari/QariShell.tsx`) and override tokens under
  it. `app/qari/record/page.tsx` does **not** use `QariScreen` — add the class to its root too.
- **Don't touch** `app/read/*`, `components/mushaf/*`, `components/QuranPageView.tsx`.
- **Translations:** every new UI string goes through `t()` / `tr()` from `@/lib/i18n`, with Somali and Arabic
  entries added in `lib/i18n-dict-qari.ts`.
- **Test at phone size, not the desktop pane:** `resize_window` preset `mobile` (375×812), light and dark
  (toggle `dark` on `<html>` via JS, or the app theme). Reset with preset `desktop` when finished.
- **Checks before reporting a phase done:** `npx tsc --noEmit -p .` must be clean. `npx eslint <changed
  files>`. Three lint errors in `app/read/page.tsx` already exist (unused `pageVerseKeys`, a missing
  `react-hooks` rule definition, one `no-unused-expressions`) — not yours to fix.
- **Don't commit** unless the user asks.

### Browser-pane quirks (save yourself tokens)

- The dev server's first compile takes ~15s; the first navigation may fail — retry once it answers.
- When the pane is hidden, timers, `requestAnimationFrame` and IntersectionObserver are throttled. Polling
  scripts with `setTimeout` loops can time out at 45s — use single-shot JS checks instead.
- Screenshots sometimes time out or come back stale/cropped; take another, or read the DOM with JS.
- A screenshot forces a paint, which lets throttled observers catch up.

## Design system

### Colours (set under `.qari-theme`)

| Role | Light | Dark (`html.dark`) |
|---|---|---|
| Paper (page background) | `#fbf7ee` + the same grain as Read (`var(--mushaf-grain)`, multiply) | `#191815` + `var(--mushaf-grain-dark)`, soft-light |
| Card | `#fffdf8`, border `rgba(29,25,20,0.10)` | `#221f1b`, border `rgba(255,250,240,0.09)` |
| Ink (headings/body) | `#1d1914` | `#ebe4d6` |
| Muted text | `#857a66` | `#938b7e` |
| **Primary (teal)** | `#0d6b63` | `#57c2a9` |
| Teal soft (chip bg, selected) | `#e1f0ec` | `rgba(87,194,169,0.14)` |
| Deep teal (hero card, Now Playing) | `#12332e` | `#0f2723` |
| Gold on light | `#9c7a2e` | — |
| Gold on dark surfaces | `#d9b86a` | `#c9a862` |
| Ivory on dark surfaces | `#f3ead6` | `#f3ead6` |

Black (AMOLED) mode (`html.dark.black`): paper `#000000`, card `#0f0f0f`, no grain.

**Colour rules**
- **Teal = primary actions** (selected chip, play buttons, Follow, Record, Play all). Today the heaviest
  things on screen are black controls (the sort switch, Record pill, Follow) — remove black from buttons.
  Black/ink is for text only.
- **Gold only for special moments:** recitation of the day, ayah highlight, sheikh/imitation accents,
  "new" rings. Never for ordinary UI.
- Keep contrast AA for text.

### Type

- Screen titles: Fraunces (`home-serif` class, `--font-home-serif`), 26px, weight 500–600, tracking −0.02em.
- UI text: the app sans, small and quiet (11–15px). Headings of sections: 13px, weight 500, sentence case
  (replace the current small-caps letter-spaced `home-label` in Qari).
- Arabic surah names (Phase 5, needs data): calligraphy font family `NadirSurahTitle`, loaded with
  `loadSurahTitleFont()` from `lib/mushaf-fonts.ts`; the text is a ligature code like
  `` `surah${String(n).padStart(3, '0')}` `` (e.g. `surah067` → سورة الملك). Other Arabic text: Amiri
  (`--font-amiri`, weight 400 — **never bold** Madani/QCF fonts).

### Spacing and shape

- 16px page edges, 12px between cards, 24px between sections.
- Cards: 18px radius, 0.5–1px border, no heavy shadow. Hero/Now Playing surfaces: 20px radius.
- Minimum tap target 40px.

## Phases

### Phase 1 — system, feed, card (biggest visible change) ≈150–200k tokens

Files: `components/qari/QariShell.tsx`, `app/qari/page.tsx`, `components/qari/RecitationCard.tsx`,
`components/qari/Waveform.tsx`, `components/qari/PlayButton.tsx`, `components/qari/QariRecordFab.tsx`,
`components/qari/QariAvatar.tsx`, `components/qari/SheikhCards.tsx`, `components/qari/EmptyState.tsx`,
Qari rules in `app/globals.css` (`.qari-card`, `.qari-chip`, `.qari-record-fab`, `.qari-monogram`, …).

1. **Theme** — `qari-theme` on QariScreen with the tokens above (paper + grain).
2. **Header** (`app/qari/page.tsx`) — "Qari" title on the left; on the right a search icon button and the
   viewer's **own avatar** (QariAvatar; guests get the sign-in prompt as now). Keep `NotificationsBell`
   (it only shows when signed in). Remove the separate "Qaris" (people icon) button — the reciters row's
   "See all" already goes to `/qari/qaris`. The search bar collapses behind the search icon: tapping it
   expands the existing `QariSearch` inline (keep `?q=` hashtag behaviour and debounce).
3. **One chip row** under the header replaces the black `QariSegmented` for the feed sort: Latest ·
   Most loved · Following (signed-in only), then the discover hashtags in the same horizontally scrolling
   row. Selected chip = teal fill, ivory text; others = card background, thin border.
4. **Recitation of the day** hero card above the reciters row (mockup): deep teal surface, gold "Recitation
   of the day" label with a sparkle icon, title large (Fraunces, ivory) — the Arabic calligraphy slot comes
   in Phase 5 — reciter + duration in 70% ivory, a 40px ivory play button, waveform in ivory (unplayed 32%).
   Source: first item of the "top" feed (`fetchFeed({ sort: 'top' })`); it may also appear in the list
   below, which is fine. Hide the card when the feed is empty. Playing it uses the normal player with the top feed as the queue.
5. **Reciters row** — keep "See all". Avatars 46px with a 2px ring and 2px gap: teal ring when that
   reciter has a recitation from the last 3 days **if** the discover data already has a date; otherwise all
   rings neutral (no API work in this phase). Full first name under, 11px.
6. **Imitations** (`SheikhCards`) — same card style, gold accent line/label.
7. **Recitation card** (`RecitationCard.tsx`), top to bottom:
   - Title leads: Fraunces 17px ink (private lock icon stays). Menu (⋯) top-right as now.
   - Waveform row: 30px **filled teal** play button, waveform, duration (11px muted).
   - Bottom meta line: 20px avatar + "Name · 6 days ago" on the left (name links to profile);
     "♥ 3 · 14 plays" on the right — write plays as words, no play-triangle icon (it looks like a second
     play button). Share button stays at the end. Show at most one hashtag chip.
   - "Imitating {sheikh}" stays as a small gold-accent chip when present.
   - Tapping empty card space toggles play (not when tapping links/buttons/waveform).
   - Playing state: 1px teal border (gold on dark hero), played part of the waveform teal, caption shows.
   - Keep: prefetch on pointer-down, like, share sheet, report sheet, delete, privacy, `memo`.
8. **Waveform** (`Waveform.tsx`) — it already uses real `peaks`, but recordings are loudness-levelled so all
   bars sit near the max and look flat. Normalise per recording: map the 5th–95th percentile of the peaks to
   18–100% height and apply a gentle curve (e.g. `h = x ** 1.6`) so quiet and loud parts differ. Bars: 2px
   gap, 2px radius; unplayed = ink at 16% (ivory at 32% on dark surfaces), played = teal (gold on dark).
   Height 22–28px on cards.
9. **Record button** (`QariRecordFab`) — a 50px teal circle with a mic icon (keep the aria-label
   "Record"). Hide on scroll down, show on scroll up. It currently covers the share icon of the card under
   it — lists need enough bottom padding that nothing important sits under it.
10. **Avatars** (`QariAvatar`) — default (no photo): the initial in Fraunces on a soft tinted tile
    (teal-soft / warm sand / lavender, chosen by username hash as today) with a very faint 8-point-star
    pattern (inline SVG, ~6% opacity).
11. **Skeletons and empty states** — match the new card shape; empty states get a fine line illustration
    style (simple inline SVG: mihrab arch / mic), serif title, teal action button.

### Phase 2 — Now Playing (new full-screen view) ≈80–120k tokens

New `components/qari/NowPlaying.tsx`, opened by tapping the mini player (`QariMiniPlayer.tsx`) — today
that tap only scrolls back to the card.

- Full-screen deep-teal surface, slides up; chevron-down and swipe-down close it.
- Avatar 92px with a thin gold ring and 4px gap; name (17px, 500); title underneath (12px, 65% ivory).
- **Ayah lines** when `recitation.verseTimeline` has entries (`{ verseKey, atSeconds }[]`, sorted by
  `atSeconds`): show the previous, current and next ayah; current = full ivory with a gold hairline under
  it, others 35% ivory. Current ayah = last entry with `atSeconds <= player.position`. Render with the QCF
  page font like `lib/qari-share-media.ts` does (`getVerseByKey`, `loadPageFont`, `code_v2` words, **no
  bold**), falling back to Amiri. When there's no timeline, show the caption instead.
- Large waveform with seek + elapsed/total times.
- Controls: speed chip (0.75× / 1× / 1.25× — `lib/qari-player.ts` has no playback-rate API yet; add a
  small `setPlaybackRate`), previous (restart the recitation), 60px ivory play/pause, next
  (`skipToNextRecitation`, disabled when `!hasNextRecitation()`), repeat-one toggle in gold when on.
- Bottom row: like (existing `LikeButton`), share (existing sheet). Leave room for "Compare with the
  sheikh" (Phase 5) — don't build it yet.
- **Lock-screen/headphone controls** via the Media Session API — copy the pattern already used in
  `lib/listen-player.ts` (metadata + action handlers, cleared on stop).

### Phase 3 — Profile ≈40–60k tokens

`app/qari/[username]/page.tsx`, `components/qari/ProfileHero.tsx`, `components/qari/FollowButton.tsx`.

- Header band behind the avatar with a faint geometric (8-point star) pattern; avatar 96px with ring.
- Name in Fraunces; "Imitates {sheikh}" chips in gold when `sheikhIds` has entries.
- Follow = teal filled; Following = outline. Edit profile = soft teal.
- When all stats are 0, hide the stat row and show a small "New reciter" badge instead.
- Tabs restyle (teal underline); "Play all" teal.

### Phase 4 — Record screen ≈80–120k tokens (largest file: `app/qari/record/page.tsx`, ~1000 lines)

- Countdown and recording steps in a dark "studio" mode (deep teal surface): large 96px mic/stop button
  centred, a live sound-level ring around it (Web Audio `AnalyserNode` on the existing mic stream, or reuse
  any level data the recorder hook already has), timer in Fraunces.
- Setup, review and publish steps stay on ivory paper with the new cards and teal primary buttons.
- Published screen: the recording's waveform animating in gold, one large teal "Share as video" button,
  secondary links below.

### Phase 5 — needs surah/ayah data first (separate task, ≈60–100k for the data part)

Recitations have **no structured Quran reference** today — only a free-text `title` and an optional
`verseTimeline`. Once a `surah` + `ayahFrom`/`ayahTo` field exists (chosen at record time, or derived from
the timeline):

- Calligraphic surah name (`NadirSurahTitle`) leading every card and the hero, with an "Ayat 12–19" chip.
- Auto-generated titles; search by surah in Arabic/English/Somali.
- "Compare with the sheikh": play the sheikh's real recitation of the same ayahs after an imitation.

## Not in this brief (separate tasks — mention to the user, don't do silently)

- **Username casing bug:** `/qari/cumar` shows the recitations but a letter avatar; `/qari/Cumar` shows the
  photo but "Nothing published yet". Avatar and recitations are stored under different spellings.
  Normalise usernames to lowercase and redirect other spellings.
- **Block user** — missing; Google Play requires report *and* block for user-generated content.
- **Record before signing in** — guests hit the account wall as soon as they open Record; ask only at
  publish (drafts are already saved locally).
- **Audio delivery** — `app/api/qari/audio/[id]/route.ts` streams through the app server with
  `Accept-Ranges: none`; move to a CDN with range support so seeking doesn't need the whole file.
- **Feed pagination** uses `skip`; switch to a cursor (last item seen) — skip breaks when new items arrive.
- **Mini player on-screen check** polls every 700ms plus scroll; use IntersectionObserver.
