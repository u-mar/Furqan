'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, Inbox, Megaphone, Send } from 'lucide-react'
import AdminShell, { type AdminBadges, type AdminSection } from '@/components/admin/AdminShell'
import AdminOverview, { type AdminOverviewData } from '@/components/admin/AdminOverview'
import AdminReportsPanel from '@/components/admin/AdminReportsPanel'
import AdminRecitationsPanel from '@/components/admin/AdminRecitationsPanel'
import AdminUploadersPanel from '@/components/admin/AdminUploadersPanel'
import AdminVerificationPanel from '@/components/admin/AdminVerificationPanel'
import AdminUsersPanel from '@/components/admin/AdminUsersPanel'
import AdminListenQarisPanel from '@/components/admin/AdminListenQarisPanel'
import { Card, Empty, Pill, button, confirmAction, field, timeAgo } from '@/components/admin/ui'
import {
  listAdminData,
  sendPopupToUser,
  setDailyVerseConfig,
  type AdminPopupMessage,
  type AdminReport,
  type FeedbackMessage,
  type UserUsage,
} from '@/lib/admin'

const REFRESH_MS = 30000

/**
 * The admin page: an overview of how Naba is doing and what needs attention, and a section for
 * each thing the admin looks after. Everything refreshes every 30 seconds, and at once on Refresh.
 */
export default function AdminDashboard() {
  const [section, setSection] = useState<AdminSection>('overview')
  // A search result opens its section with the search already typed in.
  const [handoff, setHandoff] = useState<{ section: AdminSection; query: string } | null>(null)
  const [overview, setOverview] = useState<AdminOverviewData | null>(null)
  const [feedback, setFeedback] = useState<FeedbackMessage[]>([])
  const [users, setUsers] = useState<UserUsage[]>([])
  const [reports, setReports] = useState<AdminReport[]>([])
  const [popups, setPopups] = useState<AdminPopupMessage[]>([])
  const [dailyVerse, setDailyVerse] = useState({ verseKey: '2:152', surahName: 'Al-Baqarah' })
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const [store, over] = await Promise.all([
        listAdminData(),
        fetch('/api/admin/overview', { credentials: 'include', cache: 'no-store' })
          .then((r) => (r.ok ? (r.json() as Promise<AdminOverviewData>) : null))
          .catch(() => null),
      ])
      setDailyVerse({ verseKey: store.dailyVerse.verseKey, surahName: store.dailyVerse.surahName })
      setFeedback(store.feedback)
      setUsers(store.users)
      setReports(store.reports)
      setPopups(store.popups)
      if (over) setOverview(over)
      setUpdatedAt(Date.now())
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const onChanged = () => void load()
    window.addEventListener('admin-store-changed', onChanged)
    const poll = window.setInterval(() => void load(), REFRESH_MS)
    return () => {
      window.removeEventListener('admin-store-changed', onChanged)
      window.clearInterval(poll)
    }
  }, [load])

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const badges = useMemo<AdminBadges>(
    () => ({
      reports: new Set(reports.map((r) => r.recitationId)).size,
      verification: overview?.attention.verification,
      'listen-qaris': overview?.attention.surahsToReview,
    }),
    [reports, overview]
  )

  const go = (next: AdminSection) => {
    setSection(next)
    setHandoff(null)
    window.scrollTo({ top: 0 })
  }

  return (
    <AdminShell
      section={section}
      onSectionChange={go}
      badges={badges}
      updatedAt={updatedAt}
      refreshing={refreshing}
      onRefresh={() => void load()}
      onSearchOpen={(next, query) => {
        setSection(next)
        setHandoff({ section: next, query })
      }}
      notice={notice}
    >
      {section === 'overview' ? <AdminOverview data={overview} onOpen={go} /> : null}
      {section === 'users' ? <AdminUsersPanel users={users} initialQuery={handoff?.section === 'users' ? handoff.query : ''} /> : null}
      {section === 'reports' ? <AdminReportsPanel reports={reports} /> : null}
      {section === 'feedback' ? <FeedbackSection feedback={feedback} /> : null}
      {section === 'recitations' ? (
        <AdminRecitationsPanel initialQuery={handoff?.section === 'recitations' ? handoff.query : ''} onChanged={() => void load()} />
      ) : null}
      {section === 'verification' ? <AdminVerificationPanel /> : null}
      {section === 'uploaders' ? <AdminUploadersPanel /> : null}
      {section === 'listen-qaris' ? <AdminListenQarisPanel /> : null}
      {section === 'daily-verse' ? (
        <DailyVerseSection
          initial={dailyVerse}
          onSaved={(next) => {
            setDailyVerse(next)
            flash('Daily verse updated.')
          }}
        />
      ) : null}
      {section === 'popups' ? (
        <AnnouncementsSection
          users={users}
          popups={popups}
          onSent={() => {
            flash('Announcement sent.')
            void load()
          }}
        />
      ) : null}
    </AdminShell>
  )
}

function FeedbackSection({ feedback }: { feedback: FeedbackMessage[] }) {
  const [query, setQuery] = useState('')
  const shown = feedback.filter((f) => {
    const q = query.trim().toLowerCase()
    return !q || f.message.toLowerCase().includes(q) || f.userName.toLowerCase().includes(q) || (f.contact ?? '').toLowerCase().includes(q)
  })
  return (
    <Card
      title={`Inbox · ${feedback.length}`}
      description="The newest first. Reply by the contact they left, when they left one."
      actions={<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search feedback" className={`${field} w-56 py-1.5`} aria-label="Search feedback" />}
      padded={false}
    >
      {shown.length ? (
        <ul className="divide-y divide-[var(--home-card-border)]">
          {shown.map((item) => (
            <li key={item.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.84375rem] font-semibold text-[var(--home-heading)]">{item.userName}</span>
                {item.contact ? <Pill tone="accent">{item.contact}</Pill> : null}
                <span className="ml-auto text-[0.75rem] text-[var(--home-muted)]" title={new Date(item.createdAt).toLocaleString()}>
                  {timeAgo(item.createdAt)}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-[0.875rem] leading-relaxed text-[var(--app-text)]">{item.message}</p>
            </li>
          ))}
        </ul>
      ) : (
        <Empty icon={<Inbox className="h-7 w-7" />} title={feedback.length ? 'Nothing matches' : 'No feedback yet'} />
      )}
    </Card>
  )
}

function DailyVerseSection({ initial, onSaved }: { initial: { verseKey: string; surahName: string }; onSaved: (v: { verseKey: string; surahName: string }) => void }) {
  const [verseKey, setVerseKey] = useState(initial.verseKey)
  const [surahName, setSurahName] = useState(initial.surahName)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setVerseKey(initial.verseKey)
    setSurahName(initial.surahName)
  }, [initial.verseKey, initial.surahName])

  const valid = /^\d{1,3}:\d{1,3}$/.test(verseKey.trim())
  useEffect(() => {
    if (!valid) {
      setPreview(null)
      return
    }
    const controller = new AbortController()
    fetch(`/api/ayah?type=verse&verseKey=${encodeURIComponent(verseKey.trim())}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: { text_uthmani?: string; words?: Array<{ text_uthmani?: string; char_type_name?: string }> } | null) => {
        const text = v?.text_uthmani || (v?.words ?? []).filter((w) => w.char_type_name === 'word').map((w) => w.text_uthmani).join(' ')
        setPreview(text || null)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [verseKey, valid])

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      onSaved(await setDailyVerseConfig(verseKey.trim(), surahName.trim()))
    } catch {
      setError('Could not save. Check the verse key.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card title="Ayah of the day" description="Shown on everyone’s Home screen.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-medium text-[var(--home-muted)]">Verse key</span>
            <input value={verseKey} onChange={(e) => setVerseKey(e.target.value)} placeholder="2:152" className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-medium text-[var(--home-muted)]">Surah name</span>
            <input value={surahName} onChange={(e) => setSurahName(e.target.value)} placeholder="Al-Baqarah" className={field} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className={button.primary} disabled={busy || !valid} onClick={() => void save()}>
            <BookOpen className="h-4 w-4" /> {busy ? 'Saving…' : 'Save'}
          </button>
          {!valid ? <span className="text-[0.78125rem] text-[var(--home-muted)]">Write it as surah:ayah, e.g. 2:152</span> : null}
          {error ? <span className="text-[0.78125rem] text-red-600 dark:text-red-400">{error}</span> : null}
        </div>
      </Card>
      <Card title="Preview">
        {preview ? (
          <>
            <p className="arabic-text text-right text-[1.5rem] leading-[2] text-[var(--home-heading)]" dir="rtl" lang="ar">
              {preview}
            </p>
            <p className="mt-2 text-[0.8125rem] text-[var(--home-muted)]">
              {surahName} · {verseKey}
            </p>
          </>
        ) : (
          <Empty title="No ayah to show">Type a verse key to see it here.</Empty>
        )}
      </Card>
    </div>
  )
}

function AnnouncementsSection({ users, popups, onSent }: { users: UserUsage[]; popups: AdminPopupMessage[]; onSent: () => void }) {
  const [target, setTarget] = useState<'all' | string>('all')
  const [title, setTitle] = useState('Message from Naba')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    if (!body.trim()) return
    const who = target === 'all' ? 'everyone' : users.find((u) => u.userId === target)?.userName ?? 'this person'
    if (!confirmAction(`Send “${title.trim() || 'this message'}” to ${who}? It pops up the next time they open the app.`)) return
    setBusy(true)
    setError('')
    try {
      await sendPopupToUser({ title, body, targetUserId: target })
      setBody('')
      onSent()
    } catch {
      setError('Could not send it. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const nameOf = (id: string | null | undefined) => (!id || id === 'all' ? 'Everyone' : users.find((u) => u.userId === id)?.userName ?? 'One person')

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card title="New announcement" description="A message that pops up in the app, once, for each person it is sent to.">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-medium text-[var(--home-muted)]">Send to</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={field}>
              <option value="all">Everyone</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.userName} · {u.userKind === 'registered' ? 'account' : 'guest'}
                  {u.isOnline ? ' · online' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-medium text-[var(--home-muted)]">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-medium text-[var(--home-muted)]">Message</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={field} placeholder="Write the message…" />
          </label>
          <div className="flex items-center gap-3">
            <button type="button" className={button.primary} disabled={busy || !body.trim()} onClick={() => void send()}>
              <Send className="h-4 w-4" /> {busy ? 'Sending…' : 'Send'}
            </button>
            {error ? <span className="text-[0.78125rem] text-red-600 dark:text-red-400">{error}</span> : null}
          </div>
        </div>
      </Card>
      <Card title="Sent" padded={false}>
        {popups.length ? (
          <ul className="divide-y divide-[var(--home-card-border)]">
            {popups.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[0.84375rem] font-semibold text-[var(--home-heading)]">{p.title}</span>
                  <span className="shrink-0 text-[0.75rem] text-[var(--home-muted)]">{timeAgo(p.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[0.8125rem] text-[var(--app-text)]">{p.body}</p>
                <p className="mt-1.5 flex gap-1.5">
                  <Pill tone="accent">{nameOf(p.targetUserId)}</Pill>
                  <Pill>{(p.dismissedBy ?? []).length} seen</Pill>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={<Megaphone className="h-7 w-7" />} title="Nothing sent yet" />
        )}
      </Card>
    </div>
  )
}
