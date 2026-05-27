'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Megaphone, MessageSquare, Shield, Users } from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import {
  getDailyVerseConfig,
  listAdminData,
  sendPopupToUser,
  setDailyVerseConfig,
  type FeedbackMessage,
  type UserUsage,
} from '@/lib/admin'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

export default function AdminPage() {
  const [verseKey, setVerseKey] = useState('2:152')
  const [surahName, setSurahName] = useState('Al-Baqarah')
  const [feedback, setFeedback] = useState<FeedbackMessage[]>([])
  const [users, setUsers] = useState<UserUsage[]>([])
  const [popupTitle, setPopupTitle] = useState('Message from admin')
  const [popupBody, setPopupBody] = useState('')
  const [targetUserId, setTargetUserId] = useState<'all' | string>('all')
  const [saveNotice, setSaveNotice] = useState('')

  useEffect(() => {
    const load = async () => {
      const data = await listAdminData()
      setVerseKey(data.dailyVerse.verseKey)
      setSurahName(data.dailyVerse.surahName)
      setFeedback(data.feedback)
      setUsers(data.users.slice().sort((a, b) => b.lastSeenAt - a.lastSeenAt))
    }
    void load()
    const onChanged = () => void load()
    window.addEventListener('admin-store-changed', onChanged)
    return () => window.removeEventListener('admin-store-changed', onChanged)
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
    <HomeScreen className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-center justify-between gap-3 border-b border-[var(--home-card-border)] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--home-sage-deep)] hover:bg-[var(--home-sage-soft)]"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="home-serif text-2xl font-semibold text-[var(--home-heading)]">Admin Dashboard</h1>
            <p className="text-xs text-[var(--home-muted)]">Hidden route: open `/admin` directly in browser.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--home-sage-soft)] px-3 py-1 text-xs font-semibold text-[var(--home-sage-deep)]">
          <Shield className="h-3.5 w-3.5" />
          Admin
        </span>
      </header>

      {saveNotice ? (
        <p className="mb-4 rounded-xl bg-[var(--home-sage-soft)] px-3 py-2 text-sm text-[var(--home-sage-deep)]">
          {saveNotice}
        </p>
      ) : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4">
          <p className="text-xs text-[var(--home-muted)]">Tracked users</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--home-heading)]">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4">
          <p className="text-xs text-[var(--home-muted)]">Total app visits</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--home-heading)]">{totalVisits}</p>
        </div>
        <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4">
          <p className="text-xs text-[var(--home-muted)]">Feedback messages</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--home-heading)]">{feedback.length}</p>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--home-heading)]">
          <Megaphone className="h-4 w-4 text-[var(--home-sage-deep)]" />
          Daily Verse Control
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[var(--home-muted)]">Verse key (e.g. 2:152)</span>
            <input
              value={verseKey}
              onChange={(e) => setVerseKey(e.target.value)}
              className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/30"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[var(--home-muted)]">Surah label</span>
            <input
              value={surahName}
              onChange={(e) => setSurahName(e.target.value)}
              className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/30"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void handleSaveDailyVerse()}
          className="mt-3 rounded-xl bg-[var(--home-sage-deep)] px-4 py-2 text-sm font-semibold text-white"
        >
          Save daily verse
        </button>
      </section>

      <section className="mb-6 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--home-heading)]">
          <MessageSquare className="h-4 w-4 text-[var(--home-sage-deep)]" />
          Feedback Inbox
        </h2>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {feedback.length === 0 ? (
            <p className="text-sm text-[var(--home-muted)]">No feedback yet.</p>
          ) : (
            feedback.map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--home-card-border)] p-3">
                <p className="text-sm text-[var(--app-text)]">{item.message}</p>
                <p className="mt-2 text-xs text-[var(--home-muted)]">
                  {item.userName} ({item.userId.slice(-6)}){item.contact ? ` · ${item.contact}` : ''} ·{' '}
                  {formatTime(item.createdAt)}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--home-heading)]">
          <Users className="h-4 w-4 text-[var(--home-sage-deep)]" />
          Users & Usage
        </h2>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {users.length === 0 ? (
            <p className="text-sm text-[var(--home-muted)]">No users tracked yet.</p>
          ) : (
            users.map((user) => (
              <div key={user.userId} className="rounded-xl border border-[var(--home-card-border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--home-heading)]">{user.userName}</p>
                  <p className="text-xs text-[var(--home-muted)]">{user.totalVisits} visits</p>
                </div>
                <p className="mt-1 text-xs text-[var(--home-muted)]">
                  Last seen: {formatTime(user.lastSeenAt)} · Last path: {user.lastPath}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--home-heading)]">Send In-App Popup</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs text-[var(--home-muted)]">Target user</span>
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
            >
              <option value="all">All users</option>
              {users.map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.userName} ({user.userId.slice(-6)})
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
          <span className="mb-1 block text-xs text-[var(--home-muted)]">Message body</span>
          <textarea
            value={popupBody}
            onChange={(e) => setPopupBody(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
            placeholder="Write a message to show inside the app..."
          />
        </label>
        <button
          type="button"
          onClick={() => void handleSendPopup()}
          disabled={!popupBody.trim()}
          className="mt-3 rounded-xl bg-[var(--home-sage-deep)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Send popup
        </button>
      </section>
    </HomeScreen>
  )
}
