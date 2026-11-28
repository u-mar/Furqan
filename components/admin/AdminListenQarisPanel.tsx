'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AlertTriangle, BadgeCheck, Check, ChevronLeft, Loader2, Play, Plus, Trash2, Upload, X } from 'lucide-react'
import AvatarCropper from '@/components/qari/AvatarCropper'
import { cn } from '@/lib/cn'
import type { AdminListenReciter, AdminListenSurah } from '@/lib/listen-qaris-server'
import { countryName, LISTEN_COUNTRIES, reportFlags, type ListenSurahReport } from '@/lib/listen-qaris'
import { getChapters } from '@/lib/quran'
import { QIRAAT } from '@/lib/reciters'
import type { Chapter } from '@/types'

/**
 * Listen qaris: the verified reciters whose own whole-surah recordings play in Listen. The admin adds
 * a qari and their picture, uploads their surahs (many at once, each matched to its surah by the
 * number in its file name), reads each surah's check, listens where it points, and approves; then
 * shows the qari in Listen.
 */

const STYLES = ['Murattal', 'Mujawwad', "Mu'allim"]
const BUSY = new Set(['uploading', 'checking'])

const card = 'rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]'
const input =
  'w-full min-w-0 rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/30'
const primary = 'rounded-xl bg-[var(--home-sage-deep)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'
const secondary =
  'rounded-xl border border-[var(--home-card-border)] px-3 py-2 text-xs font-semibold text-[var(--home-heading)] disabled:opacity-50'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', cache: 'no-store', ...init })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

const json = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/** The surah number in a file name: "067.mp3", "67 Al-Mulk.m4a", "surah_067". */
function surahFromName(name: string): number | null {
  const m = name.replace(/\.[a-z0-9]+$/i, '').match(/(?:^|\D)(\d{1,3})(?=\D|$)/)
  const n = m ? Number(m[1]) : NaN
  return n >= 1 && n <= 114 ? n : null
}

function minutes(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

interface QueuedFile {
  key: string
  file: File
  surah: number | null
  progress: number | null
  error?: string
}

/** Sends one file to the speech service with the permission the server gave; resolves when it has it. */
function sendFile(
  upload: { url: string; job: string; surah: number; putUrl: string; token: string },
  file: File,
  onProgress: (share: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('job', upload.job)
    form.append('surah', String(upload.surah))
    form.append('putUrl', upload.putUrl)
    form.append('token', upload.token)
    form.append('audio', file, file.name)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', upload.url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else {
        let detail = `The check refused the file (${xhr.status}).`
        try {
          detail = (JSON.parse(xhr.responseText) as { detail?: string }).detail || detail
        } catch {
          // Not JSON: the status says enough.
        }
        reject(new Error(detail))
      }
    }
    xhr.onerror = () => reject(new Error('The upload did not get through. Check the connection.'))
    xhr.send(form)
  })
}

export default function AdminListenQarisPanel() {
  const [reciters, setReciters] = useState<AdminListenReciter[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [chapters, setChapters] = useState<Chapter[]>([])

  const load = useCallback(async () => {
    try {
      const data = await api<{ reciters: AdminListenReciter[] }>('/api/admin/listen-qaris')
      setReciters(data.reciters)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the qaris.')
    }
  }, [])

  useEffect(() => {
    void load()
    void getChapters().then(setChapters).catch(() => {})
  }, [load])

  const replace = useCallback((next: AdminListenReciter) => {
    setReciters((list) => (list ?? []).map((r) => (r.id === next.id ? next : r)))
  }, [])

  const replaceSurah = useCallback((reciterId: string, next: AdminListenSurah | null, removeId?: string) => {
    setReciters((list) =>
      (list ?? []).map((r) => {
        if (r.id !== reciterId) return r
        const others = r.surahs.filter((s) => s.id !== (next?.id ?? removeId))
        const surahs = next ? [...others, next] : others
        // An approval replaces an older approved upload of the same surah.
        const kept = next?.status === 'approved' ? surahs.filter((s) => s.id === next.id || s.surah !== next.surah || s.status !== 'approved') : surahs
        return { ...r, surahs: kept.sort((a, b) => a.surah - b.surah || b.createdAt.localeCompare(a.createdAt)) }
      })
    )
  }, [])

  // Checks still running are asked about every few seconds.
  const running = useMemo(
    () => (reciters ?? []).flatMap((r) => r.surahs.filter((s) => BUSY.has(s.status)).map((s) => ({ reciterId: r.id, id: s.id }))),
    [reciters]
  )
  const runningKey = running.map((s) => s.id).join(',')
  useEffect(() => {
    if (!running.length) return
    const timer = window.setInterval(() => {
      for (const s of running) {
        void api<AdminListenSurah>(`/api/admin/listen-qaris/surahs/${s.id}`)
          .then((next) => replaceSurah(s.reciterId, next))
          .catch(() => {})
      }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [runningKey, replaceSurah])

  const open = reciters?.find((r) => r.id === openId) ?? null

  return (
    <div className="space-y-4">
      {error ? (
        <p className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </p>
      ) : null}

      {open ? (
        <QariDetail
          reciter={open}
          chapters={chapters}
          onBack={() => setOpenId(null)}
          onChange={replace}
          onSurah={(next, removeId) => replaceSurah(open.id, next, removeId)}
          onDeleted={() => {
            setReciters((list) => (list ?? []).filter((r) => r.id !== open.id))
            setOpenId(null)
          }}
          onError={setError}
        />
      ) : (
        <>
          <section className={card}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--home-heading)]">Listen qaris</h2>
              <button type="button" className={cn(primary, 'flex items-center gap-1.5 py-2 text-xs')} onClick={() => setAdding((v) => !v)}>
                {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {adding ? 'Cancel' : 'Add qari'}
              </button>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-[var(--home-muted)]">
              Verified reciters whose full surahs play in Listen, under Local reciters. Add the qari, their picture and their
              surahs. Every surah is checked; approve the ones that are right, then show the qari in Listen.
            </p>
            {adding ? (
              <QariForm
                submitLabel="Add qari"
                onSubmit={async (fields) => {
                  const created = await api<AdminListenReciter>('/api/admin/listen-qaris', json(fields))
                  setReciters((list) => [created, ...(list ?? [])])
                  setAdding(false)
                  setOpenId(created.id)
                }}
              />
            ) : null}
          </section>

          <section className={card}>
            {reciters === null ? (
              <p className="py-4 text-center text-sm text-[var(--home-muted)]">Loading…</p>
            ) : reciters.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--home-muted)]">No qaris yet. Add the first one above.</p>
            ) : (
              <ul className="divide-y divide-[var(--home-card-border)]">
                {reciters.map((r) => {
                  const approved = new Set(r.surahs.filter((s) => s.status === 'approved').map((s) => s.surah)).size
                  const waiting = r.surahs.filter((s) => s.status === 'checked').length
                  const busy = r.surahs.filter((s) => BUSY.has(s.status)).length
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => setOpenId(r.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                        <Portrait reciter={r} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1">
                            <span className="truncate text-sm font-medium text-[var(--home-heading)]">{r.name}</span>
                            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--home-sage)]" strokeWidth={2.2} aria-hidden />
                          </span>
                          <span className="block truncate text-xs text-[var(--home-muted)]">
                            {[r.city, countryName(r.country)].filter(Boolean).join(', ')} · {approved} surah{approved === 1 ? '' : 's'}
                            {waiting ? ` · ${waiting} to review` : ''}
                            {busy ? ` · ${busy} checking` : ''}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            r.published ? 'bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]' : 'bg-[var(--app-surface)] text-[var(--home-muted)]'
                          )}
                        >
                          {r.published ? 'In Listen' : 'Hidden'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Portrait({ reciter, size }: { reciter: Pick<AdminListenReciter, 'name' | 'photoUrl'>; size: number }) {
  const initials = reciter.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return reciter.photoUrl ? (
    <img src={reciter.photoUrl} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-sm font-semibold text-[var(--home-sage-deep)]"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  )
}

interface Fields {
  name: string
  nameAr: string
  country: string
  city: string
  qiraat: string
  style: string
  username: string
}

function QariForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<Fields>
  submitLabel: string
  onSubmit: (fields: Fields) => Promise<void>
}) {
  const [fields, setFields] = useState<Fields>({
    name: '',
    nameAr: '',
    country: 'SO',
    city: '',
    qiraat: 'hafs',
    style: 'Murattal',
    username: '',
    ...initial,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof Fields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!fields.name.trim()) {
      setError('Enter a name.')
      return
    }
    if (!/^[A-Za-z]{2}$/.test(fields.country.trim())) {
      setError('Choose a country.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSubmit({ ...fields, country: fields.country.trim().toUpperCase() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      <Field label="Name">
        <input className={input} value={fields.name} onChange={set('name')} placeholder="Abdullahi Yusuf" />
      </Field>
      <Field label="Name in Arabic (optional)">
        <input className={input} value={fields.nameAr} onChange={set('nameAr')} dir="rtl" placeholder="عبد الله يوسف" />
      </Field>
      <Field label="Country">
        <input className={input} value={fields.country} onChange={set('country')} list="listen-countries" maxLength={2} placeholder="SO" />
        <datalist id="listen-countries">
          {LISTEN_COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {countryName(c)}
            </option>
          ))}
        </datalist>
        <span className="mt-1 block text-[11px] text-[var(--home-muted)]">{/^[A-Za-z]{2}$/.test(fields.country) ? countryName(fields.country) : 'Two-letter code'}</span>
      </Field>
      <Field label="City (optional)">
        <input className={input} value={fields.city} onChange={set('city')} placeholder="Mogadishu" />
      </Field>
      <Field label="Narration">
        <select className={input} value={fields.qiraat} onChange={set('qiraat')}>
          {QIRAAT.map((q) => (
            <option key={q.id} value={q.id}>
              {q.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Style">
        <select className={input} value={fields.style} onChange={set('style')}>
          {STYLES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="Qari account (optional)">
        <input
          className={input}
          value={fields.username}
          onChange={set('username')}
          placeholder="@username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>
      <div className="flex items-end gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className={primary}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        {error ? <p className="pb-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--home-muted)]">{label}</span>
      {children}
    </label>
  )
}

function QariDetail({
  reciter,
  chapters,
  onBack,
  onChange,
  onSurah,
  onDeleted,
  onError,
}: {
  reciter: AdminListenReciter
  chapters: Chapter[]
  onBack: () => void
  onChange: (next: AdminListenReciter) => void
  onSurah: (next: AdminListenSurah | null, removeId?: string) => void
  onDeleted: () => void
  onError: (message: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [picked, setPicked] = useState<File | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [sending, setSending] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const filesInput = useRef<HTMLInputElement>(null)

  const chapterName = (n: number) => {
    const c = chapters.find((ch) => ch.id === n)
    return c?.englishName || c?.name_simple || c?.name || `Surah ${n}`
  }
  const approvedCount = new Set(reciter.surahs.filter((s) => s.status === 'approved').map((s) => s.surah)).size

  const uploadPhoto = async (picture: Blob) => {
    setPicked(null)
    setPhotoBusy(true)
    try {
      const form = new FormData()
      form.append('photo', new File([picture], 'photo.jpg', { type: 'image/jpeg' }))
      onChange(await api<AdminListenReciter>(`/api/admin/listen-qaris/${reciter.id}/photo`, { method: 'POST', body: form }))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save the picture.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const setPublished = async (published: boolean) => {
    try {
      onChange(await api<AdminListenReciter>(`/api/admin/listen-qaris/${reciter.id}`, json({ published }, 'PATCH')))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not change that.')
    }
  }

  const removeQari = async () => {
    if (!window.confirm(`Delete ${reciter.name}, all ${reciter.surahs.length} uploads and their files? This cannot be undone.`)) return
    try {
      await api(`/api/admin/listen-qaris/${reciter.id}`, { method: 'DELETE' })
      onDeleted()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    const added = [...files].map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, surah: surahFromName(file.name), progress: null }))
    setQueue((q) => [...q, ...added].sort((a, b) => (a.surah ?? 999) - (b.surah ?? 999)))
  }

  const sendAll = async () => {
    const ready = queue.filter((q) => q.surah && q.progress === null)
    if (!ready.length) return
    setSending(true)
    for (const item of ready) {
      const update = (patch: Partial<QueuedFile>) => setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, ...patch } : x)))
      update({ progress: 0, error: undefined })
      let started: { surah: AdminListenSurah; upload: Parameters<typeof sendFile>[0] } | null = null
      try {
        started = await api(`/api/admin/listen-qaris/${reciter.id}/surahs`, json({ surah: item.surah, fileName: item.file.name }))
        onSurah(started!.surah)
        await sendFile(started!.upload, item.file, (share) => update({ progress: share }))
        setQueue((q) => q.filter((x) => x.key !== item.key))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'The upload failed.'
        update({ progress: null, error: message })
        if (started) {
          void api<AdminListenSurah>(`/api/admin/listen-qaris/surahs/${started.surah.id}`, json({ action: 'failed', error: message }))
            .then((next) => onSurah(next))
            .catch(() => {})
        }
      }
    }
    setSending(false)
  }

  return (
    <>
      <section className={card}>
        <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-xs font-semibold text-[var(--home-sage-deep)]">
          <ChevronLeft className="h-4 w-4" /> All Listen qaris
        </button>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => photoInput.current?.click()}
            className="relative shrink-0"
            aria-label="Change the picture"
            disabled={photoBusy}
          >
            <Portrait reciter={reciter} size={72} />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-[var(--home-sage-deep)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {photoBusy ? '…' : reciter.photoUrl ? 'Change' : 'Add'}
            </span>
          </button>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              setPicked(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-base font-semibold text-[var(--home-heading)]">
              {reciter.name}
              <BadgeCheck className="h-4 w-4 text-[var(--home-sage)]" strokeWidth={2.2} aria-hidden />
            </p>
            <p className="text-xs text-[var(--home-muted)]">
              {[reciter.nameAr, [reciter.city, countryName(reciter.country)].filter(Boolean).join(', '), QIRAAT.find((q) => q.id === reciter.qiraat)?.short, reciter.style]
                .filter(Boolean)
                .join(' · ')}
              {reciter.username ? ` · @${reciter.username}` : ''}
            </p>
            <p className="mt-0.5 text-xs text-[var(--home-muted)]">
              Listen id <code>{reciter.listenId}</code> · {approvedCount} approved surah{approvedCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondary} onClick={() => setEditing((v) => !v)}>
              {editing ? 'Close' : 'Edit details'}
            </button>
            <button
              type="button"
              className={reciter.published ? secondary : cn(primary, 'py-2 text-xs')}
              onClick={() => void setPublished(!reciter.published)}
              disabled={!reciter.published && approvedCount === 0}
              title={!reciter.published && approvedCount === 0 ? 'Approve a surah first' : undefined}
            >
              {reciter.published ? 'Hide from Listen' : 'Show in Listen'}
            </button>
            <button type="button" className={cn(secondary, 'text-red-600 dark:text-red-400')} onClick={() => void removeQari()} aria-label="Delete qari">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {editing ? (
          <div className="mt-4 border-t border-[var(--home-card-border)] pt-4">
            <QariForm
              submitLabel="Save"
              initial={{
                name: reciter.name,
                nameAr: reciter.nameAr ?? '',
                country: reciter.country,
                city: reciter.city ?? '',
                qiraat: reciter.qiraat,
                style: reciter.style,
                username: reciter.username ?? '',
              }}
              onSubmit={async (fields) => {
                onChange(await api<AdminListenReciter>(`/api/admin/listen-qaris/${reciter.id}`, json(fields, 'PATCH')))
                setEditing(false)
              }}
            />
          </div>
        ) : null}
      </section>

      <section className={card}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--home-heading)]">Upload surahs</h2>
          <button type="button" className={cn(secondary, 'flex items-center gap-1.5')} onClick={() => filesInput.current?.click()}>
            <Upload className="h-4 w-4" /> Choose files
          </button>
          <input
            ref={filesInput}
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.ogg,.opus,.aac,.flac"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
        <p className="mb-3 text-xs leading-relaxed text-[var(--home-muted)]">
          MP3, M4A or WAV, up to 400 MB each. Files named by number (001.mp3 … 114.mp3, or “67 Al-Mulk.mp3”) are matched
          to their surah. Each file is trimmed, evened to Listen&apos;s loudness and checked; a two-hour surah takes a few
          minutes.
        </p>
        {queue.length ? (
          <>
            <ul className="divide-y divide-[var(--home-card-border)]">
              {queue.map((item) => (
                <li key={item.key} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--home-heading)]">
                    {item.file.name}
                    <span className="ml-1.5 text-xs text-[var(--home-muted)]">{(item.file.size / 1048576).toFixed(1)} MB</span>
                  </span>
                  <select
                    className={cn(input, 'w-48 py-1.5')}
                    value={item.surah ?? ''}
                    disabled={item.progress !== null}
                    onChange={(e) =>
                      setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, surah: Number(e.target.value) || null } : x)))
                    }
                  >
                    <option value="">Which surah?</option>
                    {Array.from({ length: 114 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}. {chapterName(n)}
                      </option>
                    ))}
                  </select>
                  {item.progress !== null ? (
                    <span className="w-16 text-right text-xs tabular-nums text-[var(--home-muted)]">{Math.round(item.progress * 100)}%</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setQueue((q) => q.filter((x) => x.key !== item.key))}
                      aria-label={`Remove ${item.file.name}`}
                      className="flex h-8 w-8 items-center justify-center text-[var(--home-muted)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {item.error ? <p className="w-full text-xs text-red-600 dark:text-red-400">{item.error}</p> : null}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-3">
              <button type="button" className={primary} disabled={sending || !queue.some((q) => q.surah && q.progress === null)} onClick={() => void sendAll()}>
                {sending ? 'Uploading…' : `Upload ${queue.filter((q) => q.surah && q.progress === null).length} file(s)`}
              </button>
              {queue.some((q) => !q.surah) ? <p className="text-xs text-[var(--home-muted)]">Choose the surah for each file without a number.</p> : null}
            </div>
          </>
        ) : null}
      </section>

      <section className={card}>
        <h2 className="mb-3 text-sm font-semibold text-[var(--home-heading)]">Surahs · {reciter.surahs.length}</h2>
        {reciter.surahs.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--home-muted)]">Nothing uploaded yet.</p>
        ) : (
          <ul className="space-y-3">
            {reciter.surahs.map((s) => (
              <SurahRow key={s.id} surah={s} name={chapterName(s.surah)} onChange={onSurah} onError={onError} />
            ))}
          </ul>
        )}
      </section>

      <AvatarCropper file={picked} onCancel={() => setPicked(null)} onDone={(picture) => void uploadPhoto(picture)} />
    </>
  )
}

const STATUS: Record<string, { label: string; tone: 'busy' | 'warn' | 'good' | 'bad' | 'muted' }> = {
  uploading: { label: 'Uploading', tone: 'busy' },
  checking: { label: 'Checking', tone: 'busy' },
  checked: { label: 'To review', tone: 'warn' },
  approved: { label: 'Approved', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'bad' },
  failed: { label: 'Failed', tone: 'bad' },
}

function SurahRow({
  surah,
  name,
  onChange,
  onError,
}: {
  surah: AdminListenSurah
  name: string
  onChange: (next: AdminListenSurah | null, removeId?: string) => void
  onError: (message: string) => void
}) {
  const [open, setOpen] = useState(surah.status === 'checked')
  const [busy, setBusy] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const status = STATUS[surah.status] ?? { label: surah.status, tone: 'muted' as const }
  const flags = surah.report ? reportFlags(surah.report) : 0

  const act = async (action: 'approve' | 'reject') => {
    setBusy(true)
    try {
      onChange(await api<AdminListenSurah>(`/api/admin/listen-qaris/surahs/${surah.id}`, json({ action })))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not change that.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Delete this upload of ${name} and its file? This cannot be undone.`)) return
    setBusy(true)
    try {
      await api(`/api/admin/listen-qaris/surahs/${surah.id}`, { method: 'DELETE' })
      onChange(null, surah.id)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not delete.')
      setBusy(false)
    }
  }

  /** Plays the saved file from just before an ayah the check pointed to. */
  const listenAt = (ayah: number | null, seconds?: number) => {
    const el = audio.current
    if (!el) return
    const at = seconds ?? (ayah !== null ? (surah.timings?.[`${surah.surah}:${ayah}`]?.[0] ?? 0) / 1000 : 0)
    el.currentTime = Math.max(0, at - 1)
    void el.play().catch(() => {})
  }

  const hasFile = surah.status === 'checked' || surah.status === 'approved' || surah.status === 'rejected'

  return (
    <li className="rounded-xl border border-[var(--home-card-border)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-8 text-xs tabular-nums text-[var(--home-muted)]">{surah.surah}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--home-heading)]">{name}</span>
          <span className="block truncate text-xs text-[var(--home-muted)]">
            {surah.fileName ?? ''}
            {surah.report ? ` · ${minutes(surah.report.durationSec)}` : ''}
            {BUSY.has(surah.status) && surah.step ? ` · ${surah.step}` : ''}
          </span>
        </span>
        {flags && surah.status === 'checked' ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">{flags} to check</span>
        ) : null}
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            status.tone === 'busy' && 'bg-[var(--app-surface)] text-[var(--home-muted)]',
            status.tone === 'warn' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
            status.tone === 'good' && 'bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]',
            status.tone === 'bad' && 'bg-red-500/10 text-red-600 dark:text-red-400',
            status.tone === 'muted' && 'bg-[var(--app-surface)] text-[var(--home-muted)]'
          )}
        >
          {status.tone === 'busy' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {status.label}
        </span>
        {surah.report ? (
          <button type="button" className={secondary} onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide report' : 'Report'}
          </button>
        ) : null}
      </div>

      {surah.error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{surah.error}</p> : null}

      {open && surah.report ? <ReportView report={surah.report} onListen={listenAt} /> : null}

      {hasFile && open ? <audio ref={audio} src={surah.audioUrl} controls preload="none" className="mt-3 w-full" /> : null}

      {!BUSY.has(surah.status) ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" className={cn(secondary, 'text-red-600 dark:text-red-400')} disabled={busy} onClick={() => void remove()}>
            Delete
          </button>
          {surah.status === 'checked' || surah.status === 'approved' ? (
            <button type="button" className={secondary} disabled={busy} onClick={() => void act('reject')}>
              Reject
            </button>
          ) : null}
          {surah.status === 'checked' || surah.status === 'rejected' ? (
            <button type="button" className={cn(primary, 'py-2 text-xs')} disabled={busy} onClick={() => void act('approve')}>
              Approve
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function ReportView({ report, onListen }: { report: ListenSurahReport; onListen: (ayah: number | null, seconds?: number) => void }) {
  const a = report.ayahs
  const ayahList = (list: number[]) => (
    <span className="flex flex-wrap justify-end gap-1">
      {list.slice(0, 12).map((n) => (
        <button key={n} type="button" onClick={() => onListen(n)} className="flex items-center gap-0.5 rounded-md bg-[var(--app-surface)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--home-heading)]">
          <Play className="h-2.5 w-2.5" /> {n}
        </button>
      ))}
      {list.length > 12 ? <span className="text-[11px] text-[var(--home-muted)]">+{list.length - 12} more</span> : null}
    </span>
  )
  return (
    <div className="mt-3 space-y-3 text-sm">
      <ReportGroup title="Ayahs">
        <Line ok={!a.otherSurah} label="Right surah" detail={a.otherSurah ? `Sounds like surah ${a.otherSurah.surah} (${a.otherSurah.ayahs} ayahs)` : 'Matches'} />
        <Line ok={a.missing.length === 0} label="All ayahs present" detail={a.missing.length ? `Missing: ${a.missing.slice(0, 20).join(', ')}${a.missing.length > 20 ? '…' : ''}` : `${a.found} of ${a.expected}`} />
        <Line ok={a.outOfOrder.length === 0} label="In order" detail={a.outOfOrder.length ? ayahList(a.outOfOrder) : 'Yes'} />
        <Line ok={a.repeated.length === 0} label="Repeated ayahs" detail={a.repeated.length ? ayahList(a.repeated) : 'None'} note="Can be normal in mujawwad" />
        <Line ok={a.unclear.length === 0} label="Hard to hear" detail={a.unclear.length ? ayahList(a.unclear) : 'None'} />
        <Line
          ok={!report.startsAbruptly && !report.endsAbruptly}
          label="Start and end"
          detail={
            report.startsAbruptly || report.endsAbruptly
              ? [report.startsAbruptly ? 'Starts mid-sound' : null, report.endsAbruptly ? 'Ends mid-sound (cut off?)' : null].filter(Boolean).join(' · ')
              : 'Not cut off'
          }
        />
      </ReportGroup>
      <ReportGroup title="Sound">
        <Line ok label="Loudness" detail={`${report.loudness.inputLufs.toFixed(1)} LUFS → evened to ${report.loudness.outputLufs}`} />
        <Line ok={!report.clipping.clipped} label="Distortion" detail={report.clipping.clipped ? `Clipping (${report.clipping.peakCount} samples at full scale)` : 'No clipping'} />
        <Line
          ok={report.noise === 'quiet'}
          label="Background noise"
          detail={`${report.noise === 'quiet' ? 'Quiet' : report.noise === 'some' ? 'Some' : 'Noisy'} (voice ${report.speechToNoiseDb.toFixed(0)} dB above it)`}
        />
        <Line
          ok={report.longSilences.length === 0}
          label="Long silences"
          detail={
            report.longSilences.length ? (
              <span className="flex flex-wrap justify-end gap-1">
                {report.longSilences.slice(0, 8).map((g) => (
                  <button key={g.atSeconds} type="button" onClick={() => onListen(null, g.atSeconds)} className="rounded-md bg-[var(--app-surface)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--home-heading)]">
                    {minutes(g.atSeconds)} · {g.seconds}s
                  </button>
                ))}
              </span>
            ) : (
              `None · ${report.trimmed.start.toFixed(1)}s and ${report.trimmed.end.toFixed(1)}s trimmed from the ends`
            )
          }
        />
      </ReportGroup>
      <p className="text-[11px] leading-relaxed text-[var(--home-muted)]">
        Not checked by the machine: tajweed, music, echo, and whether the voice is theirs. Listen before approving.
      </p>
    </div>
  )
}

function ReportGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-[var(--home-heading)]">{title}</p>
      <div className="divide-y divide-[var(--home-card-border)]">{children}</div>
    </div>
  )
}

function Line({ ok, label, detail, note }: { ok: boolean; label: string; detail: ReactNode; note?: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {ok ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--home-sage-deep)]" strokeWidth={2.4} />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2.2} />
      )}
      <span className="min-w-0 flex-1">
        <span className="text-[var(--home-heading)]">{label}</span>
        {note && !ok ? <span className="block text-[11px] text-[var(--home-muted)]">{note}</span> : null}
      </span>
      <span className="max-w-[60%] text-right text-xs text-[var(--home-muted)]">{detail}</span>
    </div>
  )
}
