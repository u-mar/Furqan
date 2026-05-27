'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, Download, CheckCircle2, Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import AccountSheet from '@/components/settings/AccountSheet'
import { clearSignedInUser, getSignedInUser } from '@/lib/auth'
import {
  applyThemeToDocument,
  getAppSettings,
  setAppSettings,
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
import { addFeedbackMessage } from '@/lib/admin'

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
          enabled ? 'bg-[var(--home-sage-deep)]' : 'bg-[#ddd5c8] dark:bg-stone-600'
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
  const searchParams = useSearchParams()
  const returnToParam = searchParams.get('returnTo')
  const returnHref = returnToParam && returnToParam.startsWith('/') ? returnToParam : '/'
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [verticalPages, setVerticalPages] = useState(false)
  const [translationLanguage, setTranslationLanguage] = useState<TranslationLanguageId>('en')
  const [offline, setOffline] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [contact, setContact] = useState('')
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
    setVerticalPages(s.verticalPages)
    setTranslationLanguage(s.translationLanguage)
    setOffline(s.offlineDownloaded || isOfflineReady())
    if (s.mushafStyle === 'indopak') {
      setAppSettings({ mushafStyle: 'uthmani' })
    }
    refreshProfile()
    const onAuthChanged = () => refreshProfile()
    window.addEventListener('auth-user-changed', onAuthChanged)
    return () => window.removeEventListener('auth-user-changed', onAuthChanged)
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

  async function handleSendFeedback() {
    if (!feedbackMessage.trim()) return
    try {
      await addFeedbackMessage(feedbackMessage, contact)
      setFeedbackMessage('')
      setContact('')
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
        <header className="mb-8 flex items-center gap-3">
          <Link
            href={returnHref}
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-[var(--home-heading)] transition-colors hover:bg-black/5 active:scale-95 dark:hover:bg-white/10"
            aria-label="Back to home"
          >
            <ChevronLeft className="h-7 w-7" strokeWidth={1.75} />
          </Link>
          <h1 className="home-serif text-[2rem] font-semibold leading-tight text-[var(--home-heading)]">
            Settings
          </h1>
        </header>

        <section className="mb-8">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-4 shadow-[var(--home-card-shadow)]">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--home-muted)]">
                Profile
              </p>
              <p className="home-serif mt-0.5 truncate text-xl font-semibold text-[var(--home-heading)]">
                {signedInName || 'Anonymous'}
              </p>
              {signedInUsername ? (
                <p className="mt-0.5 truncate text-xs text-[var(--home-muted)]">@{signedInUsername}</p>
              ) : null}
            </div>
            {signedInName ? (
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-semibold text-[var(--home-heading)]"
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAccountOpen(true)}
                className="shrink-0 rounded-xl bg-[var(--home-sage-deep)] px-3 py-2 text-sm font-semibold text-white"
              >
                Add account
              </button>
            )}
          </div>
        </section>

        <AccountSheet
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          onSuccess={refreshProfile}
        />

        <section className="mb-8">
          <SectionTitle>Appearance</SectionTitle>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-1.5 shadow-[var(--home-card-shadow)]">
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
                    ? 'bg-[var(--home-sage-deep)] text-white shadow-sm'
                    : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--home-muted)]">
            Light mode uses the warm cream and sage palette from the home screen.
          </p>
        </section>

        <section className="mb-8">
          <SectionTitle>Translation</SectionTitle>
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
          <p className="mt-2 text-xs text-[var(--home-muted)]">
            Used in Read translation mode and when you long-press an ayah.
          </p>
        </section>

        <section className="mb-8">
          <SectionTitle>Reader</SectionTitle>
          <SettingsToggle
            title="Vertical pages"
            description="Swipe up and down to turn pages. Off uses left and right swipes."
            enabled={verticalPages}
            onToggle={() => saveVerticalPages(!verticalPages)}
          />
        </section>

        <section className="mb-8">
          <SectionTitle>Offline</SectionTitle>
          <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
            {offline ? (
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--home-sage-deep)]">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                Quran saved — reader works offline
              </div>
            ) : (
              <p className="mb-4 text-sm leading-relaxed text-[var(--home-muted)]">
                Download Quran text and page data once for offline reading.
              </p>
            )}

            {downloading && (
              <div className="mb-4">
                <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-[#e8e0d4] dark:bg-stone-700">
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

            <button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--home-sage-deep)] text-sm font-bold text-white shadow-md shadow-[rgba(93,122,72,0.25)] transition-opacity disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {offline ? 'Re-download Quran' : 'Download for offline'}
            </button>

            {!offline && (
              <button
                type="button"
                disabled={downloading}
                onClick={handleUseBundled}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center text-xs font-medium text-[var(--home-muted)] underline-offset-2 hover:underline disabled:opacity-50"
              >
                Already on server? Load bundled file
              </button>
            )}
          </div>
        </section>

        <section className="mb-8">
          <SectionTitle>Feedback</SectionTitle>
          <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
            <p className="text-xs text-[var(--home-muted)]">
              User: {signedInName || 'Anonymous'}
            </p>
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              rows={4}
              placeholder="Share a bug, idea, or request..."
              className="mt-3 w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--home-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/20"
            />
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Optional contact (email/phone)"
              className="mt-2 w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--home-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/20"
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

        <p className="home-serif mt-8 pb-2 text-center text-sm leading-relaxed text-[var(--home-muted)]">
          No Ads this app is for ṣadaqah jāriyah for my parents.
        </p>
      </div>
    </main>
  )
}
