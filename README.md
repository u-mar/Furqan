# Hifdh Practice

A personal Quran memorization (hifdh) tool. Browse the Mushaf by surah, juz, or custom range — then test yourself with hidden-verse recall on authentic Uthmani-script pages.

## Features

- **Test mode** — a random verse from your selected scope is revealed; tap adjacent verses to uncover them one by one and check your recall. Navigate across all pages in the scope.
- **Read mode** — browse the full Mushaf page-by-page with authentic QCF v2 script.
- **Mutashabihat** — reference list of similar/repeated verses to help distinguish them during memorization.
- **Scope selection** — pick a juz, a surah, or a custom ayah range.
- **Offline-first** — verse data is bundled locally; only the QCF page rendering hits an external API (with automatic fallback).
- **Dark mode** — system-aware with manual toggle.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Download Quran data (required for beautiful offline mushaf)

Run once before deploy (or when updating the bundle). This fetches **all 604 Madani pages** with QCF glyph data plus mushaf fonts:

```bash
npm run download-quran
```

This writes:

- `public/quran-data.json` — verses with `code_v2` line-accurate layout (~50 MB)
- `public/fonts/qcf/p1.woff2` … `p604.woff2` — page fonts for offline rendering
- `public/fonts/surah-name-v2.ttf` — surah headers
- `public/offline-manifest.json` — bundle metadata

Options:

```bash
npm run download-quran:text   # text only, skip fonts
npm run download-quran:fonts    # fonts only (if text already downloaded)
```

Then in the app: **Settings → Download for offline** (caches fonts in the browser if not bundled).

The old bash script only downloaded plain text (no glyphs) — always use the Node script above.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/
  page.tsx          # Home — scope selector (juz / surah / range)
  test/page.tsx     # Test mode
  read/page.tsx     # Read mode
  mutashabihat/     # Mutashabihat reference page
  api/ayah/         # API route — serves verse data & QCF page rendering

components/
  QuranPageView.tsx # Renders a Mushaf page with line-accurate layout
  ThemeToggle.tsx

features/
  recitation/       # Speech recognition for recitation checking

lib/
  quran.ts          # Data access (chapters, verses by page/juz/surah)
  session.ts        # Session persistence

public/
  quran-data.json   # Full verse dataset (generated — not in git)
  quran-chapters.json
  mutashabihat.json

scripts/
  download-quran-data.sh   # Data download script
```

## Stack

- [Next.js 16](https://nextjs.org) (App Router)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [api.quran.com](https://api.quran.com) — verse data & QCF v2 page rendering
