'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronRight, Download, FileUp, FlaskConical, Trash2 } from 'lucide-react'
import {
  QARI_ASR_MODEL_URL,
  downloadQariAsrModel,
  isQariAsrModelReady,
  onQariAsrModelChange,
  removeQariAsrModel,
  saveQariAsrModelFile,
} from '@/lib/asr/offline-model-cache'
import { releaseOfflineSession } from '@/lib/asr/offline-recognizer'
import { cn } from '@/lib/cn'
import { tr, useT } from '@/lib/i18n'

/**
 * Settings → Qari: the speech model that marks which ayat a recitation holds,
 * on the phone. Saved from a download, or from a file chosen on the phone.
 */
export default function QariModelSection() {
  const t = useT()
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState<'download' | 'file' | null>(null)
  const [percent, setPercent] = useState(0)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setReady(isQariAsrModelReady())
    return onQariAsrModelChange(() => setReady(isQariAsrModelReady()))
  }, [])

  const download = async () => {
    setBusy('download')
    setError(null)
    setPercent(0)
    try {
      releaseOfflineSession()
      await downloadQariAsrModel((p) => {
        setPercent(p.percent)
        setLabel(p.label)
      })
    } catch (err) {
      setError(`${err instanceof Error ? err.message : tr('Download failed')} (${QARI_ASR_MODEL_URL})`)
    } finally {
      setBusy(null)
    }
  }

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    setBusy('file')
    setError(null)
    try {
      releaseOfflineSession()
      await saveQariAsrModelFile(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Could not save that file.'))
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = async () => {
    releaseOfflineSession()
    await removeQariAsrModel()
  }

  return (
    <>
      <h2 className="home-label mx-1 mb-2 mt-[22px]">{t('Qari')}</h2>
      <div className="home-card overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between gap-3 px-3.5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                ready ? 'bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]' : 'bg-[var(--home-track)] text-[var(--home-muted)]'
              )}
              aria-hidden
            >
              {ready ? <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> : <Download className="h-4 w-4" strokeWidth={1.9} />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--home-heading)]">{t('Mark ayat automatically')}</p>
              <p className="text-xs text-[var(--home-muted)]">
                {ready ? t('Saved on this phone') : t('Needs a one-time download')}
              </p>
            </div>
          </div>
          {ready ? (
            <button
              type="button"
              onClick={() => void remove()}
              aria-label={t('Remove')}
              className="ed-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] hover:text-rose-500"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.9} />
            </button>
          ) : null}
        </div>

        {!ready ? (
          <div className="flex gap-2 px-3.5 pb-3">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void download()}
              className="ed-ink ed-focus flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-[13px] font-semibold disabled:opacity-50"
            >
              <Download className="h-4 w-4" strokeWidth={2} />
              {t('Download')}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => fileRef.current?.click()}
              className="ed-focus flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-[13px] font-semibold text-[var(--home-heading)] disabled:opacity-50"
            >
              <FileUp className="h-4 w-4" strokeWidth={2} />
              {t('Choose file')}
            </button>
            <input ref={fileRef} type="file" accept=".onnx" className="hidden" onChange={(e) => void chooseFile(e.target.files?.[0])} />
          </div>
        ) : null}

        {busy === 'download' ? (
          <div className="px-3.5 pb-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--home-track)]">
              <div className="h-full rounded-full bg-[var(--home-sage)] transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-center text-xs text-[var(--home-muted)]">
              <span className="font-semibold tabular-nums text-[var(--home-heading)]">{percent}%</span>
              {label ? ` · ${label}` : ''}
            </p>
          </div>
        ) : null}
        {busy === 'file' ? <p className="px-3.5 pb-3 text-center text-xs text-[var(--home-muted)]">{t('Saving…')}</p> : null}

        <div className="set-row__divider" style={{ marginLeft: 14 }} />
        <Link href="/qari/asr-test" className="set-row">
          <span className="set-row__icon">
            <FlaskConical className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="set-row__label">{t('Test recognition')}</span>
          <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
        </Link>
      </div>
      <p className="mx-1 mt-2 text-xs leading-relaxed text-[var(--home-muted)]">
        {t('Listens to your recitation on your phone and marks each ayah, so it can be shown as you recite it. Nothing is sent anywhere.')}
      </p>
      {error ? (
        <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </>
  )
}
