'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronDown, Download, CheckCircle2, Sun, Moon, Circle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import AccountSheet from '@/components/settings/AccountSheet'
import { clearSignedInUser, getSignedInUser } from '@/lib/auth'
import {
  applyThemeToDocument,
  getAppSettings,
  setAppSettings,
  type MushafWidthMode,
  type ThemeMode,
} from '@/lib/app-settings'
import {
  DEFAULT_TRANSLATION_EDITION,
  getTranslationOption,
  translationLanguageLabel,
  translationsForLanguage,
  type TranslationLanguageId,
} from '@/lib/translations'
import {
  downloadOfflineQuran,
  hydrateOfflineFromDisk,
  isOfflineReady,
} from '@/lib/local-quran-store'
import {
  areTranslationsCached,
  downloadOfflineTranslations,
} from '@/lib/offline-translations'
import { bootstrapOfflineReader } from '@/lib/offline-bootstrap'
import { addFeedbackMessage } from '@/lib/admin'
import { resolveSettingsReturnHref } from '@/lib/settings-return'

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
        'flex min-h-[56px] w-full flex-col justify-center rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[0.99]',
        selected
          ? 'border-[var(--home-sage-deep)] bg-[var(--home-sage-soft)] shadow-sm'
          : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)] shadow-[var(--home-card-shadow)]'
      )}
    >
      <p className="font-semibold text-[var(--home-heading)]">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-[var(--home-muted)]">{description}</p>
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
      className="flex min-h-[56px] w-full items-center justify-between gap-4 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3.5 text-left shadow-[var(--home-card-shadow)] transition-all active:scale-[0.99]"
    >
      <div className="min-w-0">
        <p className="font-semibold text-[var(--home-heading)]">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--home-muted)]">{description}</p>
      </div>
      <span
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          enabled ? 'bg-[var(--home-sage-deep)]' : 'bg-[var(--home-track)]'
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="home-serif mb-3 text-lg font-semibold text-[var(--home-heading)]">{children}</h2>
  )
}

export default function SettingsPage() {
  const [returnHref, setReturnHref] = useState('/')
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [mushafWidth, setMushafWidth] = useState<MushafWidthMode>('full')
  const [translationLanguage, setTranslationLanguage] = useState<TranslationLanguageId>('en')
  const [translationEditionId, setTranslationEditionId] = useState<string>(
    DEFAULT_TRANSLATION_EDITION.en
  )
  const [translatorPickerOpen, setTranslatorPickerOpen] = useState(false)
  const [offline, setOffline] = useState(false)
  const [translationCached, setTranslationCached] = useState<Record<TranslationLanguageId, boolean>>({
    en: false,
    so: false,
  })
  const [downloading, setDownloading] = useState(false)
  const [downloadingTranslationLang, setDownloadingTranslationLang] =
    useState<TranslationLanguageId | null>(null)
  const [translationProgress, setTranslationProgress] = useState(0)
  const [translationProgressLabel, setTranslationProgressLabel] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackNotice, setFeedbackNotice] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const [signedInName, setSignedInName] = useState('')
  const [signedInUsername, setSignedInUsername] = useState('')

  function refreshProfile() {
    const signedIn = getSignedInUser()
    setSignedInName(signedIn?.name ?? '')
    setSignedInUsername(signedIn?.username ?? '')
  }

  useEffect(() => {
    const s = getAppSettings()
    setTheme(s.theme)
    setMushafWidth(s.mushafWidth)
    setTranslationLanguage(s.translationLanguage)
    setTranslationEditionId(s.translationEditionId)
    setOffline(s.offlineDownloaded || isOfflineReady())
    setTranslationCached({
      en: areTranslationsCached('en'),
      so: areTranslationsCached('so'),
    })
    refreshProfile()
    const onAuthChanged = () => refreshProfile()
    window.addEventListener('auth-user-changed', onAuthChanged)
    const onOfflineReady = () => {
      setOffline(isOfflineReady() || getAppSettings().offlineDownloaded)
    }
    window.addEventListener('offline-bootstrap-complete', onOfflineReady)
    return () => {
      window.removeEventListener('auth-user-changed', onAuthChanged)
      window.removeEventListener('offline-bootstrap-complete', onOfflineReady)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setReturnHref(resolveSettingsReturnHref(params.get('returnTo')))
  }, [])

  function handleLogout() {
    clearSignedInUser()
    refreshProfile()
  }

  function saveTheme(next: ThemeMode) {
    setTheme(next)
    setAppSettings({ theme: next })
    applyThemeToDocument(next)
  }

  function saveTranslationLanguage(next: TranslationLanguageId) {
    const nextEdition = DEFAULT_TRANSLATION_EDITION[next]
    setTranslationLanguage(next)
    setTranslationEditionId(nextEdition)
    setAppSettings({ translationLanguage: next, translationEditionId: nextEdition })
    setTranslatorPickerOpen(false)
  }

  function saveTranslationEdition(next: string) {
    setTranslationEditionId(next)
    setAppSettings({ translationEditionId: next })
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

  async function handleDownloadTranslation(lang: TranslationLanguageId) {
    setDownloadingTranslationLang(lang)
    setError(null)
    setTranslationProgress(0)
    setTranslationProgressLabel('')
    try {
      await downloadOfflineTranslations(lang, (p) => {
        setTranslationProgress(p.percent)
        setTranslationProgressLabel(p.label)
      })
      setTranslationCached((prev) => ({ ...prev, [lang]: true }))
      setAppSettings({ translationsDownloaded: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation download failed')
    } finally {
      setDownloadingTranslationLang(null)
    }
  }

  async function handleRetryOfflineBootstrap() {
    setDownloading(true)
    setError(null)
    setProgress(0)
    setProgressLabel('Preparing offline reader…')
    try {
      const ok = await bootstrapOfflineReader()
      if (!ok) throw new Error('Offline setup did not complete')
      setOffline(true)
      setProgress(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Offline setup failed')
    } finally {
      setDownloading(false)
      setProgressLabel('')
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

  async function handleSendFeedback() {
    if (!feedbackMessage.trim()) return
    try {
      await addFeedbackMessage(feedbackMessage, '')
      setFeedbackMessage('')
      setFeedbackNotice('Feedback sent. JazakAllahu khayran.')
      window.setTimeout(() => setFeedbackNotice(''), 2200)
    } catch {
      setFeedbackNotice('Could not send feedback right now.')
      window.setTimeout(() => setFeedbackNotice(''), 2200)
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="pointer-events-none absolute inset-0 bg-[var(--home-glow)]" aria-hidden />
      <div className="relative mx-auto w-full max-w-lg px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <section className="reveal mb-8">
          <div
            className="gold-sheen relative overflow-hidden rounded-[1.9rem] px-5 pb-5 pt-4 text-white shadow-[0_26px_60px_-20px_rgba(58,42,128,0.85)] ring-1 ring-white/10"
            style={{ background: 'var(--home-sage-gradient)' }}
          >
            <div
              className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[#e2ab53]/25 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-[#6a4bd0]/40 blur-3xl"
              aria-hidden
            />
            <div className="relative flex items-center gap-3">
              <Link
                href={returnHref}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95"
                aria-label="Back to home"
              >
                <ChevronLeft className="h-6 w-6" strokeWidth={1.9} />
              </Link>
              <h1 className="home-serif text-[1.9rem] font-semibold leading-tight text-white drop-shadow-sm">
                Settings
              </h1>
            </div>

            <div className="relative mt-5 flex items-center justify-between gap-3 rounded-2xl bg-white/12 px-4 py-3.5 backdrop-blur-sm">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f4d59b] to-[#e2ab53] text-lg font-bold text-[#2a2258] shadow-[0_8px_20px_-8px_rgba(226,171,83,0.85)]">
                  {(signedInName || 'A').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="home-serif truncate text-lg font-semibold leading-tight text-white">
                    {signedInName || 'Anonymous'}
                  </p>
                  <p className="truncate text-xs text-white/70">
                    {signedInUsername ? `@${signedInUsername}` : 'Not signed in'}
                  </p>
                </div>
              </div>
              {signedInName ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="shrink-0 rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                >
                  Sign out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAccountOpen(true)}
                  className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[var(--home-sage-dark)] transition-transform active:scale-95"
                >
                  Add account
                </button>
              )}
            </div>
          </div>
        </section>

        <AccountSheet
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          onSuccess={refreshProfile}
        />

        <section className="mb-8">
          <SectionTitle>Appearance</SectionTitle>
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-1.5 shadow-[var(--home-card-shadow)]">
            {(
              [
                { mode: 'light' as ThemeMode, Icon: Sun, label: 'Light' },
                { mode: 'dark' as ThemeMode, Icon: Moon, label: 'Dark' },
                { mode: 'black' as ThemeMode, Icon: Circle, label: 'Black' },
              ] as const
            ).map(({ mode, Icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => saveTheme(mode)}
                className={cn(
                  'flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]',
                  theme === mode
                    ? 'bg-[var(--home-sage-deep)] text-white shadow-sm'
                    : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
                )}
                aria-pressed={theme === mode}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--home-muted)]">
            <strong className="text-[var(--home-heading)]">Light</strong> gives a clean white page,{' '}
            <strong className="text-[var(--home-heading)]">Dark</strong> a soft night page, and{' '}
            <strong className="text-[var(--home-heading)]">Black</strong> a true black page — easiest
            on the eyes at night and kinder to OLED battery.
          </p>
        </section>

        <section className="mb-8">
          <SectionTitle>Mushaf page</SectionTitle>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-1.5 shadow-[var(--home-card-shadow)]">
            {(
              [
                { mode: 'full' as MushafWidthMode, label: 'Full width', hint: 'Bigger script' },
                { mode: 'spaced' as MushafWidthMode, label: 'Spaced', hint: 'Margins on the sides' },
              ] as const
            ).map(({ mode, label, hint }) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setMushafWidth(mode)
                  setAppSettings({ mushafWidth: mode })
                }}
                className={cn(
                  'flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]',
                  mushafWidth === mode
                    ? 'bg-[var(--home-sage-deep)] text-white shadow-sm'
                    : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
                )}
                aria-pressed={mushafWidth === mode}
              >
                {label}
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    mushafWidth === mode ? 'text-white/70' : 'text-[var(--home-muted)]'
                  )}
                >
                  {hint}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--home-muted)]">
            <strong className="text-[var(--home-heading)]">Full width</strong> runs the lines to the
            edges so the script is larger. <strong className="text-[var(--home-heading)]">Spaced</strong>{' '}
            keeps margins on the sides, which makes it smaller.
          </p>
        </section>

        <section className="mb-8">
          <SectionTitle>Translation</SectionTitle>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--home-muted)]">
            Language
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-1.5 shadow-[var(--home-card-shadow)]">
            {(['en', 'so'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => saveTranslationLanguage(lang)}
                className={cn(
                  'flex min-h-[48px] items-center justify-center rounded-xl text-sm font-semibold transition-all active:scale-[0.98]',
                  translationLanguage === lang
                    ? 'bg-[var(--home-sage-deep)] text-white shadow-sm'
                    : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
                )}
                aria-pressed={translationLanguage === lang}
              >
                {translationLanguageLabel(lang)}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--home-muted)]">
            Translator
          </p>
          <button
            type="button"
            onClick={() => setTranslatorPickerOpen((v) => !v)}
            className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3.5 text-left shadow-[var(--home-card-shadow)] transition-all active:scale-[0.99]"
            aria-expanded={translatorPickerOpen}
          >
            <span>
              <p className="font-semibold text-[var(--home-heading)]">
                {getTranslationOption(translationEditionId).label}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--home-muted)]">
                {translationsForLanguage(translationLanguage).length === 1
                  ? `Only one ${translationLanguageLabel(translationLanguage)} translation is available`
                  : 'Tap to change translator'}
              </p>
            </span>
            <ChevronDown
              className={cn(
                'h-5 w-5 shrink-0 text-[var(--home-muted)] transition-transform',
                translatorPickerOpen && 'rotate-180'
              )}
            />
          </button>
          {translatorPickerOpen && (
            <div className="mt-2 space-y-2">
              {translationsForLanguage(translationLanguage).map((option) => (
                <SettingsRow
                  key={option.id}
                  title={option.label}
                  description={
                    option.id === DEFAULT_TRANSLATION_EDITION[translationLanguage]
                      ? 'Also available offline'
                      : 'Online only'
                  }
                  selected={translationEditionId === option.id}
                  onClick={() => {
                    saveTranslationEdition(option.id)
                    setTranslatorPickerOpen(false)
                  }}
                />
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-[var(--home-muted)]">
            Used in Read translation mode and when you long-press an ayah.
          </p>

          <p className="mt-3 text-xs text-[var(--home-muted)]">
            Download each language separately for offline use (604 pages each). Use Wi‑Fi.
          </p>

          {downloadingTranslationLang && (
            <div className="mt-4">
              <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-[var(--home-track)]">
                <div
                  className="h-full bg-[var(--home-sage-deep)] transition-all duration-300"
                  style={{ width: `${translationProgress}%` }}
                />
              </div>
              <p className="text-center text-xs font-medium text-[var(--home-muted)]">
                {translationProgress}%
                {translationProgressLabel ? ` · ${translationProgressLabel}` : ''}
              </p>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {(['en', 'so'] as const).map((lang) => {
              const label = translationLanguageLabel(lang)
              const defaultEditionLabel = getTranslationOption(DEFAULT_TRANSLATION_EDITION[lang]).label
              return (
                <div
                  key={lang}
                  className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]"
                >
                  {translationCached[lang] ? (
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--home-sage-deep)]">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {label} saved offline
                    </div>
                  ) : (
                    <p className="mb-3 text-sm text-[var(--home-muted)]">
                      {defaultEditionLabel} ({label}) — not downloaded yet
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={downloadingTranslationLang !== null || downloading}
                    onClick={() => void handleDownloadTranslation(lang)}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--home-sage-deep)] bg-[var(--home-sage-soft)] text-sm font-bold text-[var(--home-sage-deep)] transition-opacity disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {translationCached[lang] ? `Re-download ${label}` : `Download ${label}`}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mb-8">
          <SectionTitle>Offline reader</SectionTitle>
          <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
            {offline ? (
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--home-sage-deep)]">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                Quran saved — reader works offline
              </div>
            ) : (
              <p className="mb-4 text-sm leading-relaxed text-[var(--home-muted)]">
                Install the app to your home screen and the Quran text plus mushaf fonts download
                automatically. Open the installed app on Wi‑Fi and wait a minute if you are offline
                here in the browser.
              </p>
            )}

            {downloading && (
              <div className="mb-4">
                <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-[var(--home-track)]">
                  <div
                    className="h-full bg-[var(--home-sage-deep)] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-xs font-medium text-[var(--home-muted)]">
                  {progress}%{progressLabel ? ` · ${progressLabel}` : ''}
                </p>
              </div>
            )}

            {error && (
              <p className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            {!offline && (
              <button
                type="button"
                disabled={downloading || downloadingTranslationLang !== null}
                onClick={() => void handleRetryOfflineBootstrap()}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--home-sage-deep)] text-sm font-bold text-white transition-opacity disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Set up offline reader now
              </button>
            )}

            <button
              type="button"
              disabled={downloading || downloadingTranslationLang !== null}
              onClick={handleDownload}
              className={cn(
                'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50',
                offline
                  ? 'mt-3 border border-[var(--home-card-border)] text-[var(--home-muted)]'
                  : 'mt-3 border border-[var(--home-sage-deep)] text-[var(--home-sage-deep)]'
              )}
            >
              {offline ? 'Re-download Quran data' : 'Download manually (browser)'}
            </button>

            {!offline && (
              <button
                type="button"
                disabled={downloading || downloadingTranslationLang !== null}
                onClick={handleUseBundled}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center text-xs font-medium text-[var(--home-muted)] underline-offset-2 hover:underline disabled:opacity-50"
              >
                Load bundled file from server
              </button>
            )}
          </div>
        </section>

        <section className="mb-8">
          <SectionTitle>Feedback</SectionTitle>
          <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              rows={4}
              placeholder="Share a bug, idea, or request..."
              className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--home-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/20"
            />
            {feedbackNotice ? (
              <p className="mt-2 text-xs font-medium text-[var(--home-sage-deep)]">{feedbackNotice}</p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleSendFeedback()}
              disabled={!feedbackMessage.trim()}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--home-sage-deep)] text-sm font-semibold text-white disabled:opacity-40"
            >
              Send feedback
            </button>
          </div>
        </section>

        <Link
          href="/read"
          className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] text-sm font-bold text-[var(--home-sage-deep)] shadow-[var(--home-card-shadow)] transition-transform active:scale-[0.99]"
        >
          Open reader
        </Link>

        <div className="mt-8 pb-2 text-center">
          <p className="home-serif mt-2 text-sm leading-relaxed text-[var(--home-muted)]">
            For Sadaqah Jariyah
          </p>
        </div>
      </div>
    </main>
  )
}
