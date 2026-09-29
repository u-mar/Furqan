'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { setAppSettings } from '@/lib/app-settings'
import {
  DEFAULT_TRANSLATION_EDITION,
  type TranslationLanguageId,
  translationLanguageLabel,
} from '@/lib/translations'
import { useT } from '@/lib/i18n'

const LANGUAGES: TranslationLanguageId[] = ['en', 'so']

interface TranslationLanguagePickerProps {
  language: TranslationLanguageId
  className?: string
}

export default function TranslationLanguagePicker({
  language,
  className,
}: TranslationLanguagePickerProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mushaf-dock-select"
        aria-label={`${t('Translation language')}: ${t(translationLanguageLabel(language))}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="mushaf-dock-select__caption">{t('Translation')}</span>
        <span className="mushaf-dock-select__value">
          <span className="truncate">{t(translationLanguageLabel(language))}</span>
          <ChevronDown className="mushaf-dock-select__chevron h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
      </button>
      {open && (
        <ul
          className="mushaf-dock-menu absolute bottom-full right-2 z-50 mb-2 w-48 overflow-hidden rounded-2xl py-1.5"
          role="listbox"
          aria-label={t('Translation language')}
        >
          {LANGUAGES.map((lang) => (
            <li key={lang}>
              <button
                type="button"
                role="option"
                aria-selected={lang === language}
                onClick={() => {
                  setAppSettings({
                    translationLanguage: lang,
                    translationEditionId: DEFAULT_TRANSLATION_EDITION[lang],
                  })
                  setOpen(false)
                }}
                className="mushaf-dock-menu__item"
              >
                {t(translationLanguageLabel(lang))}
                {lang === language ? <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
