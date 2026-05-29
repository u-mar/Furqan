'use client'

import { useEffect, useMemo, useState } from 'react'
import { Megaphone, MessageSquare } from 'lucide-react'
import AdminShell, { type AdminSection } from '@/components/admin/AdminShell'
import AdminUsersPanel from '@/components/admin/AdminUsersPanel'
import {
  listAdminData,
  sendPopupToUser,
  setDailyVerseConfig,
  type AdminStats,
  type FeedbackMessage,
  type UserUsage,
} from '@/lib/admin'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

export default function AdminDashboard() {
  const [section, setSection] = useState<AdminSection>('overview')
  const [verseKey, setVerseKey] = useState('2:152')
  const [surahName, setSurahName] = useState('Al-Baqarah')
  const [feedback, setFeedback] = useState<FeedbackMessage[]>([])
  const [users, setUsers] = useState<UserUsage[]>([])
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    registered: 0,
    guests: 0,
    onlineNow: 0,
  })
  const [popupTitle, setPopupTitle] = useState('Message from admin')
  const [popupBody, setPopupBody] = useState('')
  const [targetUserId, setTargetUserId] = useState<'all' | string>('all')
  const [saveNotice, setSaveNotice] = useState('')

  const load = async () => {
    const data = await listAdminData()
    setVerseKey(data.dailyVerse.verseKey)
    setSurahName(data.dailyVerse.surahName)
    setFeedback(data.feedback)
    setUsers(data.users.slice().sort((a, b) => b.lastSeenAt - a.lastSeenAt))
    if (data.stats) {
      setStats(data.stats)
    } else {
      setStats({
        totalUsers: data.users.length,
        registered: data.users.filter((u) => u.userKind === 'registered').length,
        guests: data.users.filter((u) => u.userKind === 'guest').length,
        onlineNow: data.users.filter((u) => u.isOnline).length,
      })
    }
  }

  useEffect(() => {
    void load()
    const onChanged = () => void load()
    window.addEventListener('admin-store-changed', onChanged)
    const poll = window.setInterval(() => void load(), 20000)
    return () => {
      window.removeEventListener('admin-store-changed', onChanged)
      window.clearInterval(poll)
    }
  }, [])

  const totalVisits = useMemo(
    () => users.reduce((sum, user) => sum + user.totalVisits, 0),
    [users]
  )

  const handleSaveDailyVerse = async () => {
    try {
      const next = await setDailyVerseConfig(verseKey, surahName)
      setVerseKey(next.verseKey)
      setSurahName(next.surahName)
      setSaveNotice('Daily verse updated.')
      window.setTimeout(() => setSaveNotice(''), 2200)
    } catch {
      setSaveNotice('Could not update daily verse.')
      window.setTimeout(() => setSaveNotice(''), 2200)
    }
  }

  const handleSendPopup = async () => {
    if (!popupBody.trim()) return
    try {
      await sendPopupToUser({ title: popupTitle, body: popupBody, targetUserId })
      setPopupBody('')
      setSaveNotice('Popup message sent.')
      window.setTimeout(() => setSaveNotice(''), 2200)
    } catch {
      setSaveNotice('Could not send popup message.')
      window.setTimeout(() => setSaveNotice(''), 2200)
    }
  }

  return (
    <AdminShell section={section} onSectionChange={setSection} saveNotice={saveNotice}>
      {section === 'overview' && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total users" value={stats.totalUsers} />
            <StatCard label="Registered" value={stats.registered} accent="teal" />
            <StatCard label="Guests" value={stats.guests} />
            <StatCard label="Online now" value={stats.onlineNow} accent="emerald" live />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Total sessions" value={totalVisits} />
            <StatCard label="Feedback" value={feedback.length} />
          </div>
        </section>
      )}

      {section === 'daily-verse' && (
        <section className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-5 shadow-[var(--home-card-shadow)]">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--home-heading)]">
            <Megaphone className="h-4 w-4 text-[var(--home-sage-deep)]" />
            Daily verse
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[var(--home-muted)]">Verse key</span>
              <input
                value={verseKey}
                onChange={(e) => setVerseKey(e.target.value)}
                className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[var(--home-muted)]">Surah label</span>
              <input
                value={surahName}
                onChange={(e) => setSurahName(e.target.value)}
                className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveDailyVerse()}
            className="mt-4 rounded-xl bg-[var(--home-sage-deep)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Save daily verse
          </button>
        </section>
      )}

      {section === 'feedback' && (
        <section className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-5 shadow-[var(--home-card-shadow)]">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--home-heading)]">
            <MessageSquare className="h-4 w-4 text-[var(--home-sage-deep)]" />
            Feedback inbox
          </h2>
          <div className="max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto">
            {feedback.length === 0 ? (
              <p className="text-sm text-[var(--home-muted)]">No feedback yet.</p>
            ) : (
              feedback.map((item) => (
                <article key={item.id} className="rounded-xl border border-[var(--home-card-border)] p-3">
                  <p className="text-sm text-[var(--app-text)]">{item.message}</p>
                  <p className="mt-2 text-xs text-[var(--home-muted)]">
                    {item.userName} · {item.userId.slice(0, 12)}… · {formatTime(item.createdAt)}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {section === 'users' && <AdminUsersPanel users={users} />}

      {section === 'popups' && (
        <section className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-5 shadow-[var(--home-card-shadow)]">
          <h2 className="mb-4 text-sm font-semibold text-[var(--home-heading)]">In-app popup</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs text-[var(--home-muted)]">Target</span>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
              >
                <option value="all">All users</option>
                {users.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.userName} ({user.userKind}) · {user.isOnline ? 'online' : 'offline'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--home-muted)]">Title</span>
              <input
                value={popupTitle}
                onChange={(e) => setPopupTitle(e.target.value)}
                className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs text-[var(--home-muted)]">Message</span>
            <textarea
              value={popupBody}
              onChange={(e) => setPopupBody(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleSendPopup()}
            disabled={!popupBody.trim()}
            className="mt-4 rounded-xl bg-[var(--home-sage-deep)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Send popup
          </button>
        </section>
      )}
    </AdminShell>
  )
}

function StatCard({
  label,
  value,
  accent,
  live,
}: {
  label: string
  value: number
  accent?: 'teal' | 'emerald'
  live?: boolean
}) {
  return (
    <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
      <p className="text-xs text-[var(--home-muted)]">{label}</p>
      <p
        className={`mt-1 flex items-center gap-2 text-2xl font-semibold ${
          accent === 'teal'
            ? 'text-teal-700 dark:text-teal-300'
            : accent === 'emerald'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-[var(--home-heading)]'
        }`}
      >
        {live ? <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden /> : null}
        {value}
      </p>
    </div>
  )
}
