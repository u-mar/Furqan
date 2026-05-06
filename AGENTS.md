# AGENTS.md — Hifdh Testing App

This file guides Codex in building the Hifdh (Quran memorization) testing app. Read it entirely before writing any code.

---

## What this app does

A web app that lets a person test their Quran memorization (hifdh) by speaking ayahs aloud. The app records their recitation, transcribes it using a Quran-specific ASR model, compares it to the canonical Uthmanic text, and shows a word-by-word accuracy report. Think of it as a pronunciation/accuracy drill where the Quran text is ground truth.

---

## MVP scope — build exactly this, nothing more

### In scope
- Surah + ayah range selector (pick which ayah to recite)
- Reference audio playback (hear the correct recitation before recording)
- Microphone capture + stop recording
- Transcription via HuggingFace Inference API (cloud, no local model)
- Word-level diff display (green = correct, red = wrong/missing)
- Accuracy score as a percentage
- Session history stored in localStorage (ayah key, score, timestamp)
- Basic "weak ayahs" list (ayahs scored below 80%)

### Out of scope for MVP (add later)
- Continuation mode (app plays first N words, you finish)
- Blind identification mode (identify the ayah from memory)
- Tajweed error categorisation (ghunnah, idgham, etc.)
- User accounts / backend persistence
- Streak tracking / gamification
- Multiple reciter reference audio
- Mobile app
- Offline ASR (transformers.js / local model)

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | API routes + React in one project |
| Language | TypeScript strict mode | Catches Arabic string bugs early |
| Styling | Tailwind CSS | Fast iteration, RTL support built-in |
| ASR | HuggingFace Inference API | No GPU needed for MVP, model is hosted |
| Quran text | Quran Foundation API (api.quran.com/api/v4) | Best structured data, word-by-word |
| Reference audio | EveryAyah CDN | Per-ayah MP3 by surah/ayah number |
| Word diff | custom levenshtein (no lib needed, ~30 lines) | Avoids general-purpose libs that don't understand Arabic |
| State | React useState + localStorage | Simple, no backend required for MVP |
| Font | KFGQPC Uthmanic Script HAFS | Correct Quranic glyph rendering |

---

## Repository structure

```
/
├── AGENTS.md                      ← this file
├── .env.local                     ← secrets (never commit)
├── .env.example                   ← committed template
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── app/
│   ├── layout.tsx                 ← root layout, loads Quranic font
│   ├── page.tsx                   ← home: selector + recent session list
│   ├── globals.css                ← Tailwind base + RTL + font-face
│   │
│   ├── test/
│   │   └── page.tsx               ← main testing screen
│   │
│   └── api/
│       ├── transcribe/
│       │   └── route.ts           ← POST: receives audio blob, returns Arabic text
│       └── ayah/
│           └── route.ts           ← GET: proxies Quran Foundation API
│
├── components/
│   ├── AyahSelector.tsx           ← surah + ayah number pickers
│   ├── AudioPlayer.tsx            ← plays reference recitation (EveryAyah CDN)
│   ├── Recorder.tsx               ← mic capture, waveform, start/stop
│   ├── DiffDisplay.tsx            ← renders word-by-word coloured diff
│   ├── ScoreCard.tsx              ← accuracy %, word counts, retry button
│   └── WeakAyahsList.tsx          ← list from localStorage of ayahs < 80%
│
├── lib/
│   ├── quran.ts                   ← typed wrappers for Quran Foundation API
│   ├── transcribe.ts              ← HuggingFace Inference API call
│   ├── diff.ts                    ← word-level Arabic diff algorithm
│   ├── normalise.ts               ← Arabic text normalisation (strip harakat etc.)
│   └── session.ts                 ← localStorage read/write for session history
│
└── types/
    └── index.ts                   ← shared TypeScript types
```

---

## Environment variables

```bash
# .env.example

# HuggingFace Inference API token (free tier works for MVP)
# Get one at: https://huggingface.co/settings/tokens
HF_API_TOKEN=hf_...

# Base URL for Quran Foundation API — no auth needed
QURAN_API_BASE=https://api.quran.com/api/v4
```

Never hardcode secrets. Always read from `process.env`.

---

## Key external APIs

### Quran Foundation API

Base URL: `https://api.quran.com/api/v4`

Endpoints used in this app:

```
GET /chapters
  → list all 114 surahs with name, englishName, versesCount

GET /verses/by_chapter/{chapter_number}
  ?words=true
  &word_fields=text_uthmani
  &per_page=50
  &page=1
  → ayah list with Uthmanic text and word-by-word breakdown

GET /verses/by_key/{verse_key}
  ?words=true
  &word_fields=text_uthmani
  → single ayah (verse_key = "2:255" format)
```

All responses are JSON. No API key needed. Respect their rate limits — cache chapter lists and ayah text in memory for the session (do not re-fetch the same ayah twice).

### EveryAyah CDN (reference audio)

URL pattern:
```
https://everyayah.com/data/Alafasy_128kbps/{surahPadded}{ayahPadded}.mp3
```

Where `surahPadded` = surah number zero-padded to 3 digits, `ayahPadded` = ayah number zero-padded to 3 digits.

Example: Surah 2, Ayah 255 → `002255.mp3`

```ts
export function everyAyahUrl(surah: number, ayah: number): string {
  return `https://everyayah.com/data/Alafasy_128kbps/${String(surah).padStart(3,'0')}${String(ayah).padStart(3,'0')}.mp3`
}
```

Alafasy is the default. Other reciters follow the same pattern with a different path segment.

### HuggingFace Inference API (ASR)

Model: `tarteel-ai/whisper-base-ar-quran`

This is a Whisper model fine-tuned specifically for Quranic Arabic, achieving ~5.75% WER. It is hosted on the HuggingFace Inference API so no local GPU is needed.

```ts
// lib/transcribe.ts
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const arrayBuffer = await audioBlob.arrayBuffer()
  
  const response = await fetch(
    'https://api-inference.huggingface.co/models/tarteel-ai/whisper-base-ar-quran',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
        'Content-Type': 'audio/wav',
      },
      body: arrayBuffer,
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`HuggingFace API error: ${err}`)
  }

  const data = await response.json()
  // Response shape: { text: "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ" }
  return data.text as string
}
```

**Important**: The HF Inference API cold-starts models that haven't been used recently. If you get a 503 with `"loading"` in the body, retry after 20 seconds. The API route should handle this with a retry loop (max 3 attempts, 20s delay).

Audio must be sent as WAV. The Web Audio API captures as whatever the browser supports natively — convert to WAV before sending. Use `MediaRecorder` with `audio/webm` and convert server-side, or record at 16kHz mono and send raw PCM wrapped in a WAV header.

---

## Core algorithm: word-level Arabic diff

This is the heart of the app. Implement it in `lib/diff.ts`.

### Step 1: Normalise both strings before comparison

```ts
// lib/normalise.ts

// Arabic Unicode ranges
const HARAKAT = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g
const TATWEEL = /\u0640/g
const ALEF_VARIANTS = /[\u0622\u0623\u0625]/g  // normalise to bare alef ا

export function normalise(text: string): string {
  return text
    .replace(HARAKAT, '')      // strip diacritics (tashkeel)
    .replace(TATWEEL, '')      // strip tatweel (elongation character)
    .replace(ALEF_VARIANTS, '\u0627')  // normalise alef forms
    .replace(/\s+/g, ' ')
    .trim()
}
```

Why normalise before diff: the ASR model may drop harakat; the canonical Uthmanic text always has them. Comparing without normalisation produces false mismatches.

### Step 2: Split into word arrays

```ts
const groundTruthWords = normalise(canonicalText).split(' ')
const hypothesisWords  = normalise(transcribedText).split(' ')
```

### Step 3: Levenshtein alignment (word-level)

Build a standard DP table, but the atoms are whole words, not characters. This gives you an edit path: which canonical words are matched, substituted, deleted, or inserted.

```ts
type Op = 'match' | 'substitution' | 'deletion' | 'insertion'

export interface WordResult {
  canonical: string     // the correct word (may be '' for insertions)
  hypothesis: string    // what was said (may be '' for deletions)
  op: Op
}

export function diffWords(canonical: string[], hypothesis: string[]): WordResult[] {
  // Standard Levenshtein backtrace on word arrays.
  // Implement the DP table, then backtrack from [m][n] to [0][0].
  // Cost: match=0, substitution=1, deletion=1, insertion=1
  // Return aligned pairs as WordResult[]
}
```

### Step 4: Score

```ts
export function score(results: WordResult[]): number {
  const correct = results.filter(r => r.op === 'match').length
  const total   = results.filter(r => r.op !== 'insertion').length  // canonical word count
  return total === 0 ? 0 : Math.round((correct / total) * 100)
}
```

### Step 5: Render

`DiffDisplay.tsx` maps `WordResult[]` to coloured spans:
- `match` → green text
- `substitution` → red text, show canonical word (what it should have been) as tooltip or strikethrough
- `deletion` → show missing canonical word in red with an underline
- `insertion` → show the extra word in grey with strikethrough

All Arabic text must render `dir="rtl"`. The outer container should be `dir="rtl"`.

---

## Audio capture implementation

Use the browser `MediaRecorder` API. Record as `audio/webm;codecs=opus` (best cross-browser support), then send the blob to the `/api/transcribe` route.

```ts
// Inside Recorder.tsx
const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
  const chunks: BlobPart[] = []
  
  recorder.ondataavailable = (e) => chunks.push(e.data)
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'audio/webm' })
    // pass blob up to parent for transcription
    onRecordingComplete(blob)
    stream.getTracks().forEach(t => t.stop())
  }
  
  recorder.start()
  return recorder
}
```

The API route (`app/api/transcribe/route.ts`) receives the blob, converts it using `ffmpeg-static` or a raw WAV header, then calls the HuggingFace API. If `ffmpeg-static` adds complexity, accept WebM directly — HuggingFace's hosted Whisper can handle it.

---

## Session storage schema

Stored in `localStorage` under the key `hifdh_sessions`.

```ts
// types/index.ts

export interface Session {
  id: string               // uuid or timestamp string
  verseKey: string         // "2:255"
  surahName: string        // "Al-Baqarah"
  score: number            // 0–100
  canonical: string        // full Uthmanic text
  transcript: string       // what was transcribed
  timestamp: number        // Date.now()
}

export type SessionStore = Session[]
```

Functions in `lib/session.ts`:
- `getSessions(): Session[]`
- `addSession(s: Session): void`
- `getWeakAyahs(threshold?: number): Session[]` — returns latest session per ayah where score < threshold (default 80)
- `clearSessions(): void`

---

## Quranic font setup

Add to `app/globals.css`:

```css
@font-face {
  font-family: 'UthmanicHafs';
  src: url('https://fonts.qurancdn.com/kfgqpc-uthmanic-script-hafs-regular.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

.arabic-text {
  font-family: 'UthmanicHafs', 'Amiri', 'Noto Naskh Arabic', serif;
  font-size: 1.6rem;
  line-height: 2.4;
  direction: rtl;
  text-align: right;
}
```

Use `.arabic-text` on every element rendering Quranic text. Never render Quranic text in a sans-serif or Latin font — it will display but look wrong.

If the Qurancdn font CDN is unavailable, fall back to Google Fonts Amiri: `https://fonts.googleapis.com/css2?family=Amiri&display=swap`. Amiri is not perfect for Quran but is acceptable.

---

## Page flow

```
/ (home)
  → AyahSelector (pick surah, pick ayah number)
  → "Start test" button → navigates to /test?surah=2&ayah=255

/test?surah=2&ayah=255
  1. Fetch canonical text for this ayah from Quran Foundation API
  2. Show AudioPlayer with EveryAyah CDN URL (optional — user can skip)
  3. Show Recorder — "Start reciting" button
  4. User recites, clicks Stop
  5. POST audio blob to /api/transcribe
  6. Run diffWords(canonical, transcript)
  7. Show DiffDisplay + ScoreCard
  8. Save session to localStorage
  9. Buttons: "Try again" | "Next ayah" | "Go home"
```

State machine for the test screen:

```ts
type TestState = 
  | 'idle'           // showing ayah, waiting for user to start
  | 'recording'      // mic active
  | 'transcribing'   // waiting for API response
  | 'results'        // showing diff
  | 'error'          // API failed
```

---

## Error handling rules

- HuggingFace model loading (503 with `"loading"` body): retry up to 3 times with 20s delay, show "model warming up..." UI state
- HuggingFace rate limit (429): show clear message, link to HF token settings
- Microphone permission denied: show friendly message with instructions per browser
- Quran API failure: show error, allow retry; never crash the whole page
- Empty transcript returned: treat as 0% score, show "nothing was detected" message

---

## Code style rules

- TypeScript strict mode — no `any`, no non-null assertions without a comment explaining why
- No default exports on utility functions in `lib/` — named exports only
- Components use default exports (Next.js convention)
- All Arabic string processing goes through `normalise()` before any comparison — never compare raw strings
- Never fetch the Quran API from the client directly — always go through the `/api/ayah` proxy route (avoids CORS issues, allows caching)
- Use `async`/`await` everywhere, no `.then()` chains
- Keep components under 150 lines; split if larger

---

## Commands

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Type check
npx tsc --noEmit

# Build for production
npm run build
```

---

## Suggested implementation order

1. Set up Next.js project with TypeScript + Tailwind
2. Implement `lib/quran.ts` + `/api/ayah` route — verify you can fetch ayah text
3. Build `AyahSelector.tsx` — verify surah list loads and ayah count is correct
4. Implement `lib/normalise.ts` + `lib/diff.ts` — write a quick test in the console before wiring to UI
5. Implement `lib/transcribe.ts` + `/api/transcribe` route — test with a local MP3 first
6. Build `Recorder.tsx` — verify blob is captured and sent correctly
7. Wire the full `/test` page flow: record → transcribe → diff → display
8. Build `DiffDisplay.tsx` + `ScoreCard.tsx` — Arabic RTL rendering
9. Implement `lib/session.ts` + `WeakAyahsList.tsx`
10. Polish home page, add AudioPlayer, handle all error states

Test the diff algorithm thoroughly before building any UI — it is the most logic-dense piece and bugs there will propagate everywhere.

---

## Adding features later

The MVP is designed so each major feature extension is additive, not a rewrite.

| Future feature | Where to add it |
|---|---|
| Continuation mode | New TestState value + new `/test` variant |
| Tajweed error detection | New `lib/tajweed.ts`, extend `WordResult` type with `tajweedError?` field |
| Backend persistence | Replace `lib/session.ts` localStorage calls with fetch to a new `/api/sessions` route |
| User accounts | Add NextAuth.js; session store gets a `userId` field |
| Offline ASR | Replace `lib/transcribe.ts` HF call with `transformers.js` call; same interface |
| Multiple reciters | `AudioPlayer` already accepts a URL; add a reciter picker to `AyahSelector` |
| Mobile app | Expo + React Native — share `lib/` entirely, rewrite components |

Keep `lib/` functions pure and independent of the HTTP layer — this is what makes them reusable across future targets.
