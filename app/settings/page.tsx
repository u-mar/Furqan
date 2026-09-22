'use client'

import Link from 'next/link'
import {
  ArrowUpDown,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Globe,
  Languages,
  Image as ImageIcon,
  Lock,
  LogOut,
  MessageSquare,
  Trash,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import AccountSheet from '@/components/settings/AccountSheet'
import DeleteAccountSheet from '@/components/settings/DeleteAccountSheet'
import SettingsSheet from '@/components/settings/SettingsSheet'
import QariAvatar from '@/components/qari/QariAvatar'
import Switch from '@/components/qari/Switch'
import { clearSignedInUser, getSignedInUser, type AppUser } from '@/lib/auth'
import {
  applyThemeToDocument,
  getAppSettings,
  setAppSettings,
  type MushafWidthMode,
  type ThemeMode,
} from '@/lib/app-settings'
import {
  DEFAULT_TRANSLATION_EDITION,
  translationLanguageLabel,
  translationsForLanguage,
  type TranslationLanguageId,
} from '@/lib/translations'
import {
  areTranslationsCached,
  downloadOfflineTranslations,
} from '@/lib/offline-translations'
import { addFeedbackMessage } from '@/lib/admin'
import { resolveSettingsReturnHref } from '@/lib/settings-return'
import { tr, APP_LANGUAGES, isRtl, useLanguage, useT, type AppLanguage } from '@/lib/i18n'

type SheetName = 'mushaf' | 'translation' | 'feedback' | 'language'

/* Each dot depicts a theme, so its colour is fixed rather than a token. */
const THEMES: { mode: ThemeMode; label: string; swatch: string }[] = [
  { mode: 'light', label: 'Light', swatch: '#fffdf8' },
  { mode: 'dark', label: 'Dark', swatch: '#161d1a' },
  { mode: 'black', label: 'Black', swatch: '#000000' },
]

const MUSHAF_WIDTHS: { mode: MushafWidthMode; label: string; hint: string; inset: string }[] = [
  { mode: 'full', label: 'Full width', hint: 'Bigger script', inset: '0.5rem' },
  { mode: 'spaced', label: 'Spaced', hint: 'Margins on the sides', inset: '1.15rem' },
]

const btnBase =
  'ed-focus flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-[transform,background-color,opacity] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50'
const btnInk = cn(btnBase, 'ed-ink')

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="home-label mx-1 mb-2 mt-[22px]">{children}</h2>
}

function RowIcon({ icon: Icon, tone }: { icon: LucideIcon; tone?: 'neutral' | 'danger' }) {
  return (
    <span
      className={cn(
        'set-row__icon',
        tone === 'neutral' && 'set-row__icon--neutral',
        tone === 'danger' && 'set-row__icon--danger'
      )}
      aria-hidden
    >
      <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
    </span>
  )
}

function RowChevron() {
  return (
    <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} aria-hidden />
  )
}

function Divider() {
  return <div className="set-row__divider" aria-hidden />
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
        <span className="font-semibold tabular-nums text-[var(--home-heading)]">{percent}%</span>
        {label ? ` · ${label}` : ''}
      </p>
    </div>
  )
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400" role="alert">
      {children}
    </p>
  )
}

export default function SettingsPage() {
  const t = useT()
  const language = useLanguage()
  const [returnHref, setReturnHref] = useState('/')
  const [user, setUser] = useState<AppUser | null>(null)
  const [theme, setTheme] = useState<ThemeMode>('light')
  const [mushafWidth, setMushafWidth] = useState<MushafWidthMode>('spaced')
  const [translationLanguage, setTranslationLanguage] = useState<TranslationLanguageId>('en')
  const [translationEditionId, setTranslationEditionId] = useState<string>(
    DEFAULT_TRANSLATION_EDITION.en
  )
  const [verseWallpapers, setVerseWallpapers] = useState(false)
  const [verticalPages, setVerticalPages] = useState(false)
  const [translationCached, setTranslationCached] = useState<Record<TranslationLanguageId, boolean>>({
    en: false,
    so: false,
  })
  const [downloadingTranslationLang, setDownloadingTranslationLang] =
    useState<TranslationLanguageId | null>(null)
  const [translationProgress, setTranslationProgress] = useState(0)
  const [translationProgressLabel, setTranslationProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [sheet, setSheet] = useState<SheetName | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)
  const returnHrefResolved = useRef(false)

  const refreshProfile = useCallback(() => setUser(getSignedInUser()), [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  const closeSheet = useCallback(() => setSheet(null), [])

  useEffect(() => {
    const s = getAppSettings()
    setTheme(s.theme)
    setMushafWidth(s.mushafWidth)
    setTranslationLanguage(s.translationLanguage)
    setTranslationEditionId(s.translationEditionId)
    setVerseWallpapers(s.verseWallpapersEnabled)
    setVerticalPages(s.verticalPages)
    setTranslationCached({
      en: areTranslationsCached('en'),
      so: areTranslationsCached('so'),
    })
    refreshProfile()
    window.addEventListener('auth-user-changed', refreshProfile)
    return () => {
      window.removeEventListener('auth-user-changed', refreshProfile)
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [refreshProfile])

  useEffect(() => {
    // resolveSettingsReturnHref consumes the saved path (it deletes it from
    // sessionStorage as it reads it), so it must run only once per real visit —
    // React's Strict Mode double-invokes effects in development, and a second
    // call would find it already gone and fall back to "/".
    if (returnHrefResolved.current) return
    returnHrefResolved.current = true
    const params = new URLSearchParams(window.location.search)
    setReturnHref(resolveSettingsReturnHref(params.get('returnTo')))
  }, [])

  function handleLogout() {
    clearSignedInUser()
    refreshProfile()
    showToast(t('Signed out.'))
  }

  function saveTheme(next: ThemeMode) {
    setTheme(next)
    setAppSettings({ theme: next })
    applyThemeToDocument(next)
  }

  function saveLanguage(next: AppLanguage) {
    setAppSettings({ language: next })
    setSheet(null)
  }

  function saveMushafWidth(next: MushafWidthMode) {
    setMushafWidth(next)
    setAppSettings({ mushafWidth: next })
  }

  function saveVerseWallpapers(next: boolean) {
    setVerseWallpapers(next)
    setAppSettings({ verseWallpapersEnabled: next })
  }

  function saveVerticalPages(next: boolean) {
    setVerticalPages(next)
    setAppSettings({ verticalPages: next })
  }

  function saveTranslationLanguage(next: TranslationLanguageId) {
    const nextEdition = DEFAULT_TRANSLATION_EDITION[next]
    setTranslationLanguage(next)
    setTranslationEditionId(nextEdition)
    setAppSettings({ translationLanguage: next, translationEditionId: nextEdition })
  }

  function saveTranslationEdition(next: string) {
    setTranslationEditionId(next)
    setAppSettings({ translationEditionId: next })
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
      setError(err instanceof Error ? err.message : tr('Translation download failed'))
    } finally {
      setDownloadingTranslationLang(null)
    }
  }

  async function handleSendFeedback() {
    if (!feedbackMessage.trim() || sendingFeedback) return
    setSendingFeedback(true)
    try {
      await addFeedbackMessage(feedbackMessage, '')
      setFeedbackMessage('')
      setSheet(null)
      showToast(tr('Feedback sent. JazakAllahu khayran.'))
    } catch {
      showToast(tr('Could not send feedback right now.'))
    } finally {
      setSendingFeedback(false)
    }
  }

  const busy = downloadingTranslationLang !== null

  return (
    <main
      dir={isRtl(language) ? 'rtl' : 'ltr'}
      className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]"
    >
      <div className="mx-auto w-full max-w-lg px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center gap-3">
          <Link href={returnHref} className="home-round ed-focus" aria-label={t('Back')}>
            <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <h1 className="home-serif text-[1.625rem] font-semibold tracking-[-0.02em] text-[var(--home-heading)]">
            {t('Settings')}
          </h1>
        </header>

        {/* Account */}
        {user ? (
          <Link
            href={`/qari/${encodeURIComponent(user.username)}`}
            className="home-card home-press ed-focus mt-[18px] flex items-center gap-3 rounded-2xl px-3.5 py-3"
          >
            <QariAvatar username={user.username} name={user.name} size={48} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-[var(--home-heading)]">
                {user.name}
              </span>
              <span className="mt-px block truncate text-[0.8125rem] text-[var(--home-muted)]">
                @{user.username}
              </span>
            </span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="home-card home-press ed-focus mt-[18px] flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
          >
            <span className="ed-ink flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
              <UserRound className="h-[22px] w-[22px]" strokeWidth={1.9} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-[var(--home-heading)]">{t('Add account')}</span>
              <span className="mt-px block text-[0.8125rem] text-[var(--home-muted)]">
                {t('Sign in to share your recitations')}
              </span>
            </span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
          </button>
        )}

        {/* Appearance */}
        <SectionLabel>{t('Appearance')}</SectionLabel>
        <div className="home-card grid grid-cols-3 gap-1.5 rounded-2xl p-1.5" role="radiogroup" aria-label={t('Appearance')}>
          {THEMES.map(({ mode, label, swatch }) => {
            const selected = theme === mode
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => saveTheme(mode)}
                className={cn(
                  'ed-focus flex h-11 items-center justify-center gap-2 rounded-[11px] text-[0.84375rem] font-semibold transition-colors',
                  selected ? 'ed-ink' : 'text-[var(--home-heading)] hover:bg-[var(--home-track)]'
                )}
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{
                    background: swatch,
                    boxShadow: 'inset 0 0 0 1px color-mix(in srgb, currentColor 32%, transparent)',
                  }}
                  aria-hidden
                />
                {t(label)}
              </button>
            )
          })}
        </div>

        {/* Reading */}
        <SectionLabel>{t('Reading')}</SectionLabel>
        <div className="home-card overflow-hidden rounded-2xl">
          <button type="button" className="set-row" onClick={() => setSheet('mushaf')}>
            <RowIcon icon={BookOpen} />
            <span className="set-row__label">{t('Mushaf page')}</span>
            <span className="set-row__value">
              {t(MUSHAF_WIDTHS.find((w) => w.mode === mushafWidth)?.label ?? 'Full width')}
            </span>
            <RowChevron />
          </button>
          <Divider />
          <label className="set-row cursor-pointer">
            <RowIcon icon={ArrowUpDown} />
            <span className="set-row__label">{t('Vertical page swipes')}</span>
            <Switch checked={verticalPages} onChange={saveVerticalPages} label={t('Vertical page swipes')} />
          </label>
          <Divider />
          <label className="set-row cursor-pointer">
            <RowIcon icon={ImageIcon} />
            <span className="set-row__label">{t('Ayah wallpapers')}</span>
            <Switch checked={verseWallpapers} onChange={saveVerseWallpapers} label={t('Ayah wallpapers')} />
          </label>
          <Divider />
          <button type="button" className="set-row" onClick={() => setSheet('translation')}>
            <RowIcon icon={Globe} />
            <span className="set-row__label">{t('Translation')}</span>
            <span className="set-row__value">{t(translationLanguageLabel(translationLanguage))}</span>
            <RowChevron />
          </button>
        </div>

        {/* Language */}
        <SectionLabel>{t('App language')}</SectionLabel>
        <div className="home-card overflow-hidden rounded-2xl">
          <button type="button" className="set-row" onClick={() => setSheet('language')}>
            <RowIcon icon={Languages} />
            <span className="set-row__label">{t('App language')}</span>
            <span className="set-row__value">{APP_LANGUAGES.find((l) => l.id === language)?.name}</span>
            <RowChevron />
          </button>
        </div>

        {/* Support */}
        <SectionLabel>{t('Support')}</SectionLabel>
        <div className="home-card overflow-hidden rounded-2xl">
          <button type="button" className="set-row" onClick={() => setSheet('feedback')}>
            <RowIcon icon={MessageSquare} />
            <span className="set-row__label">{t('Send feedback')}</span>
            <RowChevron />
          </button>
          <Divider />
          <Link href="/privacy" className="set-row">
            <RowIcon icon={Lock} />
            <span className="set-row__label">{t('Privacy Policy')}</span>
            <RowChevron />
          </Link>
          <Divider />
          <Link href="/terms" className="set-row">
            <RowIcon icon={FileText} />
            <span className="set-row__label">{t('Terms of Service')}</span>
            <RowChevron />
          </Link>
        </div>

        {/* Account actions */}
        {user ? (
          <div className="home-card mt-[22px] overflow-hidden rounded-2xl">
            <button type="button" className="set-row" onClick={handleLogout}>
              <RowIcon icon={LogOut} tone="neutral" />
              <span className="set-row__label">{t('Sign out')}</span>
            </button>
            <Divider />
            <button type="button" className="set-row set-row--danger" onClick={() => setDeleteOpen(true)}>
              <RowIcon icon={Trash} tone="danger" />
              <span className="set-row__label">{t('Delete account')}</span>
            </button>
          </div>
        ) : null}

        <p className="home-serif mt-8 text-center text-sm italic text-[var(--home-muted)]">{t('For Sadaqah Jariyah')}</p>
      </div>

      {/* Mushaf page */}
      <SettingsSheet
        open={sheet === 'mushaf'}
        title={t('Mushaf page')}
        description={t('How the page sits on your screen in Read.')}
        onClose={closeSheet}
      >
        <div className="grid grid-cols-2 gap-2.5">
          {MUSHAF_WIDTHS.map(({ mode, label, hint, inset }) => {
            const selected = mushafWidth === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  saveMushafWidth(mode)
                  setSheet(null)
                }}
                className={cn(
                  'ed-focus flex flex-col gap-2 rounded-2xl border p-2 text-left transition-colors active:scale-[0.98]',
                  selected
                    ? 'border-[var(--home-sage)] bg-[var(--home-sage-soft)]'
                    : 'border-[var(--home-rule)] hover:border-[var(--home-rule-strong)]'
                )}
                aria-pressed={selected}
              >
                <span
                  className="relative block h-20 w-full overflow-hidden rounded-xl bg-[var(--app-bg)]"
                  style={{ boxShadow: 'inset 0 0 0 1px var(--home-rule)' }}
                  aria-hidden
                >
                  {/* Actual script at each width, so the difference is visible
                      rather than implied by grey bars. */}
                  <span
                    className="amiri absolute inset-y-0 flex flex-col items-center justify-center gap-0.5 leading-tight text-[var(--home-heading)]"
                    style={{ left: inset, right: inset, fontSize: mode === 'full' ? '0.66rem' : '0.55rem' }}
                    dir="rtl"
                    lang="ar"
                  >
                    <span>ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ</span>
                    <span>ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>
                    <span className="opacity-70">مَٰلِكِ يَوْمِ ٱلدِّينِ</span>
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2 px-1 pb-0.5">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--home-heading)]">{t(label)}</span>
                    <span className="block text-xs text-[var(--home-muted)]">{t(hint)}</span>
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
      </SettingsSheet>

      {/* Translation */}
      <SettingsSheet
        open={sheet === 'translation'}
        title={t('Translation')}
        description={t('Used in Read translation mode and when you double-tap an ayah.')}
        onClose={closeSheet}
      >
        <p className="mb-2 text-xs font-semibold text-[var(--home-heading)]">{t('Language')}</p>
        <div className="ed-seg grid-cols-2">
          {(['en', 'so'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => saveTranslationLanguage(lang)}
              className="ed-seg__item ed-focus flex min-h-[44px] items-center justify-center text-sm font-semibold"
              aria-pressed={translationLanguage === lang}
            >
              {t(translationLanguageLabel(lang))}
            </button>
          ))}
        </div>

        <p className="mb-2 mt-5 text-xs font-semibold text-[var(--home-heading)]">{t('Translator')}</p>
        <div
          className="divide-y divide-[var(--home-rule)] overflow-hidden rounded-2xl border border-[var(--home-rule)]"
          role="radiogroup"
          aria-label={t('Translator')}
        >
          {translationsForLanguage(translationLanguage).map((option) => {
            const selected = translationEditionId === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => saveTranslationEdition(option.id)}
                className="set-row"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-medium">{option.label}</span>
                  <span className="block text-xs text-[var(--home-muted)]">
                    {option.id === DEFAULT_TRANSLATION_EDITION[translationLanguage]
                      ? t('Also available offline')
                      : t('Online only')}
                  </span>
                </span>
                {selected ? (
                  <Check className="h-[18px] w-[18px] shrink-0 text-[var(--home-sage-deep)]" strokeWidth={2.6} />
                ) : null}
              </button>
            )
          })}
        </div>

        <p className="mt-5 text-xs font-semibold text-[var(--home-heading)]">{t('Offline translations')}</p>
        <p className="mb-3 mt-1 text-xs leading-relaxed text-[var(--home-muted)]">
          {t('Each language downloads separately, 604 pages each. Use Wi‑Fi.')}</p>

        {downloadingTranslationLang ? (
          <div className="mb-3">
            <ProgressBar percent={translationProgress} label={translationProgressLabel} />
          </div>
        ) : null}

        <div className="divide-y divide-[var(--home-rule)] overflow-hidden rounded-2xl border border-[var(--home-rule)]">
          {(['en', 'so'] as const).map((lang) => {
            const label = t(translationLanguageLabel(lang))
            const cached = translationCached[lang]
            return (
              <div key={lang} className="flex items-center justify-between gap-3 px-3.5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      cached
                        ? 'bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]'
                        : 'bg-[var(--home-track)] text-[var(--home-muted)]'
                    )}
                    aria-hidden
                  >
                    {cached ? (
                      <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                    ) : (
                      <Download className="h-4 w-4" strokeWidth={1.9} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--home-heading)]">{label}</p>
                    <p className="text-xs text-[var(--home-muted)]">{cached ? t('Saved offline') : t('Not downloaded')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDownloadTranslation(lang)}
                  aria-label={cached ? t('Re-download {label}', { label }) : t('Download {label}', { label })}
                  className={cn(
                    'ed-focus shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
                    cached
                      ? 'border border-[var(--home-rule-strong)] text-[var(--home-heading)] hover:bg-[var(--home-track)]'
                      : 'ed-ink'
                  )}
                >
                  {cached ? t('Re-download') : t('Download')}
                </button>
              </div>
            )
          })}
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </SettingsSheet>

      {/* Language */}
      <SettingsSheet
        open={sheet === 'language'}
        title={t('App language')}
        description={t('The language of the app’s menus and buttons.')}
        onClose={closeSheet}
      >
        <div
          className="divide-y divide-[var(--home-rule)] overflow-hidden rounded-2xl border border-[var(--home-rule)]"
          role="radiogroup"
          aria-label={t('App language')}
        >
          {APP_LANGUAGES.map(({ id, name, hint }) => {
            const selected = language === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => saveLanguage(id)}
                className="set-row"
                lang={id}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold">{name}</span>
                  {id !== 'en' ? <span className="block text-xs text-[var(--home-muted)]">{hint}</span> : null}
                </span>
                {selected ? (
                  <Check className="h-[18px] w-[18px] shrink-0 text-[var(--home-sage-deep)]" strokeWidth={2.6} />
                ) : null}
              </button>
            )
          })}
        </div>
      </SettingsSheet>

      {/* Feedback */}
      <SettingsSheet
        open={sheet === 'feedback'}
        title={t('Send feedback')}
        description={t('A bug, an idea or a request — it all helps.')}
        onClose={closeSheet}
      >
        <textarea
          value={feedbackMessage}
          onChange={(e) => setFeedbackMessage(e.target.value)}
          rows={5}
          placeholder={t('Write your message…')}
          className="block w-full resize-none rounded-2xl border border-[var(--home-rule-strong)] bg-transparent px-4 py-3.5 text-[0.95rem] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--home-muted)] focus:border-[var(--home-sage)] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void handleSendFeedback()}
          disabled={!feedbackMessage.trim() || sendingFeedback}
          className={cn(btnInk, 'mt-3')}
        >
          {sendingFeedback ? t('Sending…') : t('Send')}
        </button>
      </SettingsSheet>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} onSuccess={refreshProfile} />

      {user ? (
        <DeleteAccountSheet
          open={deleteOpen}
          user={user}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false)
            refreshProfile()
            showToast(tr('Your account has been deleted.'))
          }}
        />
      ) : null}

      {toast ? (
        <div
          className="qari-enter pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4"
          role="status"
        >
          <p className="ed-ink rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg">{toast}</p>
        </div>
      ) : null}
    </main>
  )
}
