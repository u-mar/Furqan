'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronLeft, Download, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  applyThemeToDocument,
  getAppSettings,
  setAppSettings,
  type MushafStyle,
  type ThemeMode,
} from '@/lib/app-settings'
import {
  downloadOfflineQuran,
  hydrateOfflineFromDisk,
  isOfflineReady,
} from '@/lib/local-quran-store'

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [mushafStyle, setMushafStyle] = useState<MushafStyle>('uthmani-glyphs')
  const [offline, setOffline] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const s = getAppSettings()
    setTheme(s.theme)
    setMushafStyle(s.mushafStyle)
    setOffline(s.offlineDownloaded || isOfflineReady())
  }, [])

  function saveTheme(next: ThemeMode) {
    setTheme(next)
    setAppSettings({ theme: next })
    applyThemeToDocument(next)
  }

  function saveMushaf(next: MushafStyle) {
    setMushafStyle(next)
    setAppSettings({ mushafStyle: next })
  }

  async function handleDownload() {
    setDownloading(true)
    setError(null)
    setProgress(0)
    try {
      await downloadOfflineQuran(setProgress)
      setAppSettings({ offlineDownloaded: true })
      setOffline(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  async function handleUseBundled() {
    setDownloading(true)
    setError(null)
    try {
      await hydrateOfflineFromDisk()
      setAppSettings({ offlineDownloaded: true })
      setOffline(true)
      setProgress(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load offline data')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto max-w-lg px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="mb-8 flex items-center gap-3 border-b border-[var(--app-border)] pb-4">
          <Link
            href="/"
            className="rounded-lg p-2 text-teal-600 hover:bg-[var(--app-surface)] dark:text-teal-400"
            aria-label="Back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold">Settings</h1>
        </header>

        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            Appearance
          </h2>
          <div className="flex gap-2 rounded-xl bg-[var(--app-surface)] p-1">
            {(['light', 'dark'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => saveTheme(mode)}
                className={cn(
                  'flex-1 rounded-lg py-2.5 text-sm font-medium capitalize transition-colors',
                  theme === mode
                    ? 'bg-teal-600 text-white'
                    : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            Quran script
          </h2>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => saveMushaf('uthmani-glyphs')}
              className={cn(
                'w-full rounded-xl border px-4 py-4 text-left transition-colors',
                mushafStyle === 'uthmani-glyphs'
                  ? 'border-teal-500 bg-teal-500/10'
                  : 'border-[var(--app-border)] bg-[var(--app-surface)]'
              )}
            >
              <p className="font-medium">Uthmani (Mushaf)</p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">
                Madani layout with glyph fonts — best for reading like a printed mushaf
              </p>
            </button>
            <button
              type="button"
              onClick={() => saveMushaf('indopak')}
              className={cn(
                'w-full rounded-xl border px-4 py-4 text-left transition-colors',
                mushafStyle === 'indopak'
                  ? 'border-teal-500 bg-teal-500/10'
                  : 'border-[var(--app-border)] bg-[var(--app-surface)]'
              )}
            >
              <p className="font-medium">IndoPak (Naskh)</p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">
                Naskh-style text — faster offline, no per-page font downloads
              </p>
            </button>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            Offline reading
          </h2>
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            {offline ? (
              <div className="mb-4 flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                Quran saved for instant page turns
              </div>
            ) : (
              <p className="mb-4 text-sm text-[var(--app-muted)]">
                Download once (~45 MB) so swiping between pages is instant without waiting on the
                network.
              </p>
            )}

            {downloading && (
              <div className="mb-4">
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                  <div
                    className="h-full bg-teal-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-xs text-[var(--app-muted)]">{progress}%</p>
              </div>
            )}

            {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

            <button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {offline ? 'Re-download Quran' : 'Download for offline'}
            </button>

            {!offline && (
              <button
                type="button"
                disabled={downloading}
                onClick={handleUseBundled}
                className="mt-2 w-full py-2 text-center text-xs text-[var(--app-muted)] underline"
              >
                Already on server? Load bundled file
              </button>
            )}
          </div>
        </section>

        <Link
          href="/read"
          className="block rounded-xl border border-[var(--app-border)] py-3 text-center text-sm font-medium text-teal-600 dark:text-teal-400"
        >
          Open reader
        </Link>
      </div>
    </main>
  )
}
