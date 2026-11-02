'use client'

import { useEffect, useRef, useState } from 'react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { useT } from '@/lib/i18n'

/** As long as a title may be (app/api/qari/route.ts keeps 80 characters). */
const TITLE_MAX = 80

/**
 * The reciter renaming their own recitation: what it is called on the feed,
 * on their page and when it is shared. `onSave` says whether it was kept.
 */
export default function EditTitleSheet({
  open,
  title,
  onClose,
  onSave,
}: {
  open: boolean
  title: string
  onClose: () => void
  onSave: (title: string) => Promise<boolean>
}) {
  const t = useT()
  const [value, setValue] = useState(title)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Opens on the title as it is now, ready to type.
  useEffect(() => {
    if (!open) return
    setValue(title)
    setSaving(false)
    const timer = window.setTimeout(() => inputRef.current?.select(), 80)
    return () => window.clearTimeout(timer)
  }, [open, title])

  const next = value.trim()

  const save = async () => {
    if (!next || saving) return
    if (next === title) {
      onClose()
      return
    }
    setSaving(true)
    const kept = await onSave(next)
    setSaving(false)
    if (kept) onClose()
  }

  return (
    <SettingsSheet open={open} title={t('Edit title')} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={TITLE_MAX}
          dir="auto"
          enterKeyHint="done"
          aria-label={t('Title')}
          className="ed-focus h-11 w-full rounded-xl border border-[var(--home-rule-strong)] bg-[var(--app-surface)] px-3 text-sm font-medium text-[var(--home-heading)]"
        />
        <p className="mt-1.5 text-end text-xs tabular-nums text-[var(--home-muted)]">
          {value.length}/{TITLE_MAX}
        </p>
        <button
          type="submit"
          disabled={!next || saving}
          className="ed-ink ed-focus mt-3 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? t('Saving…') : t('Save')}
        </button>
      </form>
    </SettingsSheet>
  )
}
