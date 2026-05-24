'use client'

import {
  ChevronLeft,
  Download,
  CheckCircle2,
  Sun,
  Moon,
  BookOpen,
  Wifi,
  ArrowUpDown,
  Languages,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import {
  applyThemeToDocument,
  getAppSettings,
  setAppSettings,
  type MushafStyle,
  type ThemeMode,
} from '@/lib/app-settings'
import {
  TRANSLATION_LANGUAGES,
  type TranslationLanguageId,
} from '@/lib/translations'
import {
  downloadOfflineQuran,
  hydrateOfflineFromDisk,
  isOfflineReady,
} from '@/lib/local-quran-store'

function SettingsRow({
  title,
  description,
  selected,
  onClick,
}: {
  title: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[56px] w-full flex-col justify-center rounded-2xl border px-4 py-3.5 text-left transition-colors active:scale-[0.99]',
        selected
          ? 'border-teal-500 bg-teal-500/10'
          : 'border-[var(--app-border)] bg-[var(--app-surface)]'
      )}
    >
      <p className="font-medium text-[var(--app-text)]">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-[var(--app-muted)]">{description}</p>
    </button>
  )
}

function SettingsToggle({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string
  description: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className="flex min-h-[56px] w-full items-center justify-between gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3.5 text-left transition-colors active:scale-[0.99]"
    >
      <div className="min-w-0">
        <p className="font-medium text-[var(--app-text)]">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--app-muted)]">{description}</p>
      </div>
      <span
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          enabled ? 'bg-teal-600' : 'bg-stone-300 dark:bg-stone-600'
        )}
        aria-hidden
      >
        <span
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </span>
    </button>
  )
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [mushafStyle, setMushafStyle] = useState<MushafStyle>('uthmani-glyphs')
  const [verticalPages, setVerticalPages] = useState(false)
  const [translationLanguage, setTranslationLanguage] = useState<TranslationLanguageId>('en')
  const [offline, setOffline] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const s = getAppSettings()
    setTheme(s.theme)
    setMushafStyle(s.mushafStyle)
    setVerticalPages(s.verticalPages)
    setTranslationLanguage(s.translationLanguage)
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

  function saveVerticalPages(next: boolean) {
    setVerticalPages(next)
    setAppSettings({ verticalPages: next })
  }

  function saveTranslationLanguage(next: TranslationLanguageId) {
    setTranslationLanguage(next)
    setAppSettings({ translationLanguage: next })
  }

  async function handleDownload() {
    setDownloading(true)
    setError(null)
    setProgress(0)
    setProgressLabel('')
    try {
      await downloadOfflineQuran((p) => {
        setProgress(p.percent)
        setProgressLabel(p.label)
      })
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
      <div className="mx-auto w-full max-w-lg px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="sticky top-0 z-10 -mx-4 mb-6 flex items-center gap-2 border-b border-[var(--app-border)] bg-[var(--app-bg)]/95 px-4 pb-4 pt-2 backdrop-blur-md">
          <a
            href="/"
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-teal-600 transition-colors hover:bg-[var(--app-surface)] active:scale-95 dark:text-teal-400"
            aria-label="Back to home"
          >
            <ChevronLeft className="h-7 w-7" />
          </a>
          <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        </header>

        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            <Sun className="h-3.5 w-3.5" />
            Appearance
          </h2>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--app-surface)] p-1.5">
            {(
              [
                { mode: 'light' as ThemeMode, Icon: Sun, label: 'Light' },
                { mode: 'dark' as ThemeMode, Icon: Moon, label: 'Dark' },
              ] as const
            ).map(({ mode, Icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => saveTheme(mode)}
                className={cn(
                  'flex min-h-[52px] items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]',
                  theme === mode
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--app-muted)]">
            Light mode applies to the home screen and reader.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            <BookOpen className="h-3.5 w-3.5" />
            Quran script
          </h2>
          <div className="space-y-2">
            <SettingsRow
              title="IndoPak (Naskh)"
              description="Recommended — connected Arabic text, works offline without extra fonts"
              selected={mushafStyle === 'indopak'}
              onClick={() => saveMushaf('indopak')}
            />
            <SettingsRow
              title="Uthmani (Mushaf)"
              description="Printed Madani layout — needs Wi‑Fi or full offline font download"
              selected={mushafStyle === 'uthmani-glyphs'}
              onClick={() => saveMushaf('uthmani-glyphs')}
            />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            <Languages className="h-3.5 w-3.5" />
            Translation language
          </h2>
          <div className="space-y-2">
            {TRANSLATION_LANGUAGES.map((lang) => (
              <SettingsRow
                key={lang.id}
                title={lang.label}
                description={
                  lang.id === 'en'
                    ? 'Sahih International (English)'
                    : 'Mahmud Muhammad Abduh (Somali)'
                }
                selected={translationLanguage === lang.id}
                onClick={() => saveTranslationLanguage(lang.id)}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--app-muted)]">
            Used in Read translation mode and when you long-press an ayah.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Reader
          </h2>
          <SettingsToggle
            title="Vertical pages"
            description="Next page slides up from below (like horizontal page turns). Off uses left/right swipes."
            enabled={verticalPages}
            onToggle={() => saveVerticalPages(!verticalPages)}
          />
        </section>

        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            <Wifi className="h-3.5 w-3.5" />
            Offline reading
          </h2>
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            {offline ? (
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                Full mushaf saved — Madani glyphs work offline
              </div>
            ) : (
              <p className="mb-4 text-sm leading-relaxed text-[var(--app-muted)]">
                One-time download (~50–80 MB): Quran text with proper page layout plus all
                mushaf fonts. Looks the same as online.
              </p>
            )}

            {downloading && (
              <div className="mb-4">
                <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                  <div
                    className="h-full bg-teal-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-xs font-medium text-[var(--app-muted)]">
                  {progress}%{progressLabel ? ` · ${progressLabel}` : ''}
                </p>
              </div>
            )}

            {error && (
              <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {offline ? 'Re-download Quran' : 'Download for offline'}
            </button>

            {!offline && (
              <button
                type="button"
                disabled={downloading}
                onClick={handleUseBundled}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center text-xs text-[var(--app-muted)] underline-offset-2 hover:underline disabled:opacity-50"
              >
                Already on server? Load bundled file
              </button>
            )}
          </div>
        </section>

        <a
          href="/read"
          className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] text-sm font-semibold text-teal-600 transition-colors active:scale-[0.99] dark:text-teal-400"
        >
          Open reader
        </a>
      </div>
    </main>
  )
}
