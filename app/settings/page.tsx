'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Circle,
  Download,
  Moon,
  Sun,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import AccountSheet from '@/components/settings/AccountSheet'
import { IconOrnament } from '@/components/home/TileIcons'
import { APP_NAME } from '@/lib/app-brand'
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

/* ---------- Shared button recipes ---------- */
const btnBase =
  'ed-focus flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-[transform,background-color,color,opacity] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50'
const btnInk = cn(btnBase, 'ed-ink hover:opacity-90')
const btnQuiet = cn(
  btnBase,
  'border border-[var(--home-rule-strong)] text-[var(--home-heading)] hover:bg-[var(--home-track)]'
)
const btnAccent = cn(
  btnBase,
  'border border-[var(--home-sage)] text-[var(--home-sage-deep)] hover:bg-[var(--home-sage-soft)]'
)

/* Fixed preview colours: each swatch depicts a theme, so it must not follow
   the current one. */
const themeOptions = [
  {
    mode: 'light' as ThemeMode,
    Icon: Sun,
    label: 'Light',
    bg: '#f4f1e8',
    ink: '#1c1a16',
    line: 'rgba(28, 26, 22, 0.32)',
    edge: 'rgba(28, 26, 22, 0.14)',
  },
  {
    mode: 'dark' as ThemeMode,
    Icon: Moon,
    label: 'Dark',
    bg: '#0f1513',
    ink: '#ece7dc',
    line: 'rgba(236, 231, 220, 0.34)',
    edge: 'rgba(236, 231, 220, 0.16)',
  },
  {
    mode: 'black' as ThemeMode,
    Icon: Circle,
    label: 'Black',
    bg: '#000000',
    ink: '#f6f6f6',
    line: 'rgba(246, 246, 246, 0.34)',
    edge: 'rgba(246, 246, 246, 0.18)',
  },
] as const

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
        'ed-focus flex min-h-[56px] w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 text-left transition-colors active:scale-[0.99]',
        selected
          ? 'border-[var(--home-sage)] bg-[var(--home-sage-soft)]'
          : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)] hover:border-[var(--home-rule-strong)]'
      )}
      aria-pressed={selected}
    >
      <span className="min-w-0">
        <p className="font-semibold text-[var(--home-heading)]">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--home-muted)]">{description}</p>
      </span>
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          selected
            ? 'border-[var(--home-sage-deep)] bg-[var(--home-sage-deep)] text-white'
            : 'border-[var(--home-rule-strong)]'
        )}
        aria-hidden
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
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
      className="ed-card ed-focus flex min-h-[56px] w-full items-center justify-between gap-4 rounded-2xl px-4 py-3.5 text-left transition-colors active:scale-[0.99]"
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
    <div className="mb-3 flex items-center gap-3">
      <h2 className="ed-label">{children}</h2>
      <span className="ed-rule flex-1" />
    </div>
  )
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold text-[var(--home-heading)]">{children}</p>
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--home-track)]">
        <div
          className="h-full rounded-full bg-[var(--home-sage)] transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-center text-xs text-[var(--home-muted)]">
        <span className="ed-num font-semibold text-[var(--home-heading)]">{percent}%</span>
        {label ? ` · ${label}` : ''}
      </p>
    </div>
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

  const initial = (signedInName || 'A').charAt(0).toUpperCase()

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[var(--app-bg)] text-[var(--app-text)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] bg-[var(--home-glow)]"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-lg px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
        {/* Masthead */}
        <header className="reveal mb-9">
          <div className="flex items-center gap-4">
            <Link
              href={returnHref}
              className="ed-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors hover:bg-[var(--home-ink)] hover:text-[var(--home-ink-fg)] active:scale-95"
              aria-label="Back to home"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
            </Link>
            <div className="min-w-0">
              <p className="ed-label">{APP_NAME}</p>
              <h1 className="home-serif mt-1 text-[2.25rem] font-medium leading-none tracking-[-0.025em] text-[var(--home-heading)]">
                Settings
              </h1>
            </div>
          </div>

          <div className="ed-card mt-7 flex items-center justify-between gap-3 rounded-[1.25rem] p-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="ed-ink home-serif flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-medium">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="home-serif truncate text-[1.1rem] font-medium leading-tight text-[var(--home-heading)]">
                  {signedInName || 'Anonymous'}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--home-muted)]">
                  {signedInUsername ? `@${signedInUsername}` : 'Not signed in'}
                </p>
              </div>
            </div>
            {signedInName ? (
              <button
                type="button"
                onClick={handleLogout}
                className="ed-focus shrink-0 rounded-full border border-[var(--home-rule-strong)] px-3.5 py-2 text-xs font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAccountOpen(true)}
                className="ed-ink ed-focus shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-transform active:scale-95"
              >
                Add account
              </button>
            )}
          </div>
        </header>

        <AccountSheet
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          onSuccess={refreshProfile}
        />

        {/* Appearance */}
        <section className="mb-9">
          <SectionTitle>Appearance</SectionTitle>
          <div className="grid grid-cols-3 gap-2.5">
            {themeOptions.map(({ mode, Icon, label, bg, ink, line, edge }) => {
              const selected = theme === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => saveTheme(mode)}
                  className={cn(
                    'ed-focus flex flex-col gap-2 rounded-2xl border p-2 text-left transition-colors active:scale-[0.98]',
                    selected
                      ? 'border-[var(--home-sage)] bg-[var(--home-sage-soft)]'
                      : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)] hover:border-[var(--home-rule-strong)]'
                  )}
                  aria-pressed={selected}
                >
                  <span
                    className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl"
                    style={{ background: bg, boxShadow: `inset 0 0 0 1px ${edge}` }}
                    aria-hidden
                  >
                    <span
                      className="absolute left-3 top-3 h-[3px] w-[45%] rounded-full"
                      style={{ background: ink }}
                    />
                    <span
                      className="absolute left-3 right-3 top-[1.3rem] h-[2px] rounded-full"
                      style={{ background: line }}
                    />
                    <span
                      className="absolute left-3 top-[1.8rem] h-[2px] w-[70%] rounded-full"
                      style={{ background: line }}
                    />
                    {selected ? (
                      <span className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--home-sage-deep)] text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center justify-between px-1 pb-0.5">
                    <span className="text-xs font-semibold text-[var(--home-heading)]">{label}</span>
                    <Icon className="h-3.5 w-3.5 text-[var(--home-muted)]" strokeWidth={1.75} />
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--home-muted)]">
            <strong className="font-semibold text-[var(--home-heading)]">Light</strong> is a paper
            page, <strong className="font-semibold text-[var(--home-heading)]">Dark</strong> a soft
            night page, and{' '}
            <strong className="font-semibold text-[var(--home-heading)]">Black</strong> true black —
            easiest on the eyes at night and kinder to OLED battery.
          </p>
        </section>

        {/* Mushaf page */}
        <section className="mb-9">
          <SectionTitle>Mushaf page</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                { mode: 'full' as MushafWidthMode, label: 'Full width', hint: 'Bigger script', inset: '0.5rem' },
                { mode: 'spaced' as MushafWidthMode, label: 'Spaced', hint: 'Margins on the sides', inset: '1.15rem' },
              ] as const
            ).map(({ mode, label, hint, inset }) => {
              const selected = mushafWidth === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setMushafWidth(mode)
                    setAppSettings({ mushafWidth: mode })
                  }}
                  className={cn(
                    'ed-focus flex flex-col gap-2 rounded-2xl border p-2 text-left transition-colors active:scale-[0.98]',
                    selected
                      ? 'border-[var(--home-sage)] bg-[var(--home-sage-soft)]'
                      : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)] hover:border-[var(--home-rule-strong)]'
                  )}
                  aria-pressed={selected}
                >
                  <span
                    className="relative block h-16 w-full overflow-hidden rounded-xl bg-[var(--app-bg)]"
                    style={{ boxShadow: 'inset 0 0 0 1px var(--home-rule)' }}
                    aria-hidden
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className="absolute h-[2px] rounded-full bg-[var(--home-rule-strong)]"
                        style={{
                          left: inset,
                          right: inset,
                          top: `${0.75 + i * 0.75}rem`,
                          opacity: i === 3 ? 0.55 : 1,
                        }}
                      />
                    ))}
                  </span>
                  <span className="flex items-center justify-between gap-2 px-1 pb-0.5">
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-[var(--home-heading)]">{label}</span>
                      <span className="block text-[0.68rem] text-[var(--home-muted)]">{hint}</span>
                    </span>
                    {selected ? (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--home-sage-deep)] text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--home-muted)]">
            <strong className="font-semibold text-[var(--home-heading)]">Full width</strong> runs
            the lines to the edges so the script is larger.{' '}
            <strong className="font-semibold text-[var(--home-heading)]">Spaced</strong> keeps
            margins on the sides, which makes it smaller.
          </p>
        </section>

        {/* Translation */}
        <section className="mb-9">
          <SectionTitle>Translation</SectionTitle>
          <SubLabel>Language</SubLabel>
          <div className="ed-seg grid-cols-2">
            {(['en', 'so'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => saveTranslationLanguage(lang)}
                className="ed-seg__item ed-focus flex min-h-[44px] items-center justify-center text-sm font-semibold"
                aria-pressed={translationLanguage === lang}
              >
                {translationLanguageLabel(lang)}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <SubLabel>Translator</SubLabel>
          </div>
          <button
            type="button"
            onClick={() => setTranslatorPickerOpen((v) => !v)}
            className={cn(
              'ed-card ed-focus flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-[border-radius,border-color] active:scale-[0.99]',
              translatorPickerOpen ? 'rounded-t-2xl rounded-b-none' : 'rounded-2xl'
            )}
            aria-expanded={translatorPickerOpen}
          >
            <span className="min-w-0">
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
                'h-4 w-4 shrink-0 text-[var(--home-muted)] transition-transform',
                translatorPickerOpen && 'rotate-180'
              )}
              strokeWidth={2}
            />
          </button>
          {translatorPickerOpen && (
            <div className="space-y-2 rounded-b-2xl border border-t-0 border-[var(--home-card-border)] bg-[var(--home-location-bg)] p-2">
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
          <p className="mt-3 text-xs leading-relaxed text-[var(--home-muted)]">
            Used in Read translation mode and when you long-press an ayah.
          </p>

          <div className="mt-6">
            <SubLabel>Offline translations</SubLabel>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-[var(--home-muted)]">
            Download each language separately for offline use (604 pages each). Use Wi‑Fi.
          </p>

          {downloadingTranslationLang && (
            <div className="mb-3">
              <ProgressBar percent={translationProgress} label={translationProgressLabel} />
            </div>
          )}

          <div className="ed-card divide-y divide-[var(--home-rule)] rounded-2xl">
            {(['en', 'so'] as const).map((lang) => {
              const label = translationLanguageLabel(lang)
              const defaultEditionLabel = getTranslationOption(DEFAULT_TRANSLATION_EDITION[lang]).label
              const cached = translationCached[lang]
              return (
                <div key={lang} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        cached
                          ? 'bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]'
                          : 'border border-[var(--home-rule-strong)] text-[var(--home-muted)]'
                      )}
                      aria-hidden
                    >
                      {cached ? (
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                      ) : (
                        <Download className="h-4 w-4" strokeWidth={1.75} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--home-heading)]">{label}</p>
                      <p className="text-xs leading-snug text-[var(--home-muted)]">
                        {cached ? 'Saved offline' : `${defaultEditionLabel} — not downloaded`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={downloadingTranslationLang !== null || downloading}
                    onClick={() => void handleDownloadTranslation(lang)}
                    aria-label={cached ? `Re-download ${label}` : `Download ${label}`}
                    className={cn(
                      'ed-focus shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
                      cached
                        ? 'border border-[var(--home-rule-strong)] text-[var(--home-heading)] hover:bg-[var(--home-track)]'
                        : 'ed-ink hover:opacity-90'
                    )}
                  >
                    {cached ? 'Re-download' : 'Download'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* Offline reader */}
        <section className="mb-9">
          <SectionTitle>Offline reader</SectionTitle>
          <div className="ed-card rounded-2xl p-4">
            {offline ? (
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--home-heading)]">Quran saved</p>
                  <p className="text-xs text-[var(--home-muted)]">The reader works offline.</p>
                </div>
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
                <ProgressBar percent={progress} label={progressLabel} />
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
                className={btnInk}
              >
                <Download className="h-4 w-4" strokeWidth={2} />
                Set up offline reader now
              </button>
            )}

            <button
              type="button"
              disabled={downloading || downloadingTranslationLang !== null}
              onClick={handleDownload}
              className={cn('mt-3', offline ? btnQuiet : btnAccent)}
            >
              {offline ? 'Re-download Quran data' : 'Download manually (browser)'}
            </button>

            {!offline && (
              <button
                type="button"
                disabled={downloading || downloadingTranslationLang !== null}
                onClick={handleUseBundled}
                className="ed-focus mt-3 flex min-h-[44px] w-full items-center justify-center rounded-full text-xs font-medium text-[var(--home-muted)] underline-offset-4 hover:underline disabled:opacity-50"
              >
                Load bundled file from server
              </button>
            )}
          </div>
        </section>

        {/* Feedback */}
        <section className="mb-9">
          <SectionTitle>Feedback</SectionTitle>
          <div className="ed-card overflow-hidden rounded-2xl">
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              rows={4}
              placeholder="Share a bug, idea, or request…"
              className="block w-full resize-none bg-transparent px-4 py-3.5 text-sm leading-relaxed text-[var(--app-text)] placeholder:text-[var(--home-muted)] focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3 border-t border-[var(--home-rule)] px-3 py-2.5">
              <p
                className={cn(
                  'min-w-0 truncate text-xs font-medium text-[var(--home-sage-deep)] transition-opacity',
                  feedbackNotice ? 'opacity-100' : 'opacity-0'
                )}
                aria-live="polite"
              >
                {feedbackNotice || ' '}
              </p>
              <button
                type="button"
                onClick={() => void handleSendFeedback()}
                disabled={!feedbackMessage.trim()}
                className="ed-ink ed-focus flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-4 pr-3 text-xs font-semibold transition-opacity disabled:opacity-40"
              >
                Send
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        </section>

        <Link
          href="/read"
          className="ed-card ed-focus group flex min-h-[56px] items-center justify-between rounded-2xl px-4 transition-[border-color] hover:border-[var(--home-sage)] active:scale-[0.99]"
        >
          <span className="home-serif text-[1.05rem] font-medium text-[var(--home-heading)]">
            Open the reader
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors group-hover:bg-[var(--home-ink)] group-hover:text-[var(--home-ink-fg)]">
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </span>
        </Link>

        <footer className="mt-10 flex flex-col items-center gap-3 pb-2 text-center">
          <div className="flex w-full items-center gap-3">
            <span className="ed-rule flex-1" />
            <IconOrnament className="h-3 w-3 text-[var(--home-sage)]" />
            <span className="ed-rule flex-1" />
          </div>
          <p className="home-serif text-sm italic text-[var(--home-muted)]">For Sadaqah Jariyah</p>
        </footer>
      </div>
    </main>
  )
}
