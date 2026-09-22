'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Ban, Check, Lock, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import { dismissReport, removeReportedRecitation, type AdminReport } from '@/lib/admin'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

interface Group {
  recitationId: string
  title: string
  ownerName: string
  ownerUsername: string
  isPrivate: boolean
  createdAt: number
  reports: AdminReport[]
}

/** Every report against the same recording, grouped, so five reports on one clip is one row to act on, not five. */
function groupByRecitation(reports: AdminReport[]): Group[] {
  const byId = new Map<string, Group>()
  for (const report of reports) {
    const existing = byId.get(report.recitationId)
    if (existing) {
      existing.reports.push(report)
      continue
    }
    byId.set(report.recitationId, {
      recitationId: report.recitationId,
      title: report.recitationTitle,
      ownerName: report.recitationOwnerName,
      ownerUsername: report.recitationOwnerUsername,
      isPrivate: report.recitationIsPrivate,
      createdAt: report.recitationCreatedAt,
      reports: [report],
    })
  }
  return [...byId.values()].sort(
    (a, b) => b.reports.length - a.reports.length || Math.max(...b.reports.map((r) => r.createdAt)) - Math.max(...a.reports.map((r) => r.createdAt))
  )
}

export default function AdminReportsPanel({ reports }: { reports: AdminReport[] }) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const groups = useMemo(() => groupByRecitation(reports), [reports])

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  const handleRemove = async (recitationId: string) => {
    if (confirmingId !== recitationId) {
      setConfirmingId(recitationId)
      return
    }
    setConfirmingId(null)
    setBusyId(recitationId)
    try {
      await removeReportedRecitation(recitationId)
      flash('Recitation removed.')
    } catch {
      flash('Could not remove that recitation.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDismiss = async (reportId: string) => {
    setBusyId(reportId)
    try {
      await dismissReport(reportId)
    } catch {
      flash('Could not dismiss that report.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] shadow-[var(--home-card-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--home-card-border)] px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--home-heading)]">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Reported recitations
        </h2>
        <p className="text-xs text-[var(--home-muted)]">
          {groups.length} recording{groups.length === 1 ? '' : 's'} · {reports.length} report{reports.length === 1 ? '' : 's'}
        </p>
      </div>

      {notice ? (
        <p className="mx-5 mt-4 rounded-xl bg-[var(--home-sage-soft)] px-3 py-2 text-sm text-[var(--home-sage-deep)]">{notice}</p>
      ) : null}

      <div className="max-h-[min(70vh,40rem)] divide-y divide-[var(--home-card-border)] overflow-y-auto">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <ShieldCheck className="h-7 w-7 text-[var(--home-sage-deep)]" />
            <p className="text-sm font-medium text-[var(--home-heading)]">Nothing reported</p>
            <p className="text-xs text-[var(--home-muted)]">Reports filed from Qari's "…" menu will show up here.</p>
          </div>
        ) : (
          groups.map((group) => {
            const removing = busyId === group.recitationId
            return (
              <article key={group.recitationId} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {group.isPrivate ? <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--home-muted)]" /> : null}
                      <p className="truncate text-sm font-semibold text-[var(--home-heading)]">{group.title || 'Untitled recitation'}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--home-muted)]">
                      by {group.ownerName} (@{group.ownerUsername}) · recorded {formatTime(group.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {group.reports.length} report{group.reports.length === 1 ? '' : 's'}
                  </span>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {group.reports.map((report) => (
                    <li
                      key={report.id}
                      className="flex items-start justify-between gap-3 rounded-xl bg-[var(--app-surface)] px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="text-[var(--app-text)]">{report.reason || 'No reason given.'}</p>
                        <p className="mt-0.5 text-[var(--home-muted)]">
                          {report.reporterId.slice(0, 12)}… · {formatTime(report.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDismiss(report.id)}
                        disabled={busyId === report.id}
                        className="ed-focus flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-medium text-[var(--home-muted)] transition-colors hover:bg-[var(--home-card-bg)] hover:text-[var(--home-heading)] disabled:opacity-40"
                      >
                        <Check className="h-3 w-3" />
                        Dismiss
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleRemove(group.recitationId)}
                    disabled={removing}
                    className={cn(
                      'ed-focus flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
                      confirmingId === group.recitationId
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 dark:text-rose-400'
                    )}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    {removing ? 'Removing…' : confirmingId === group.recitationId ? 'Tap again to remove' : 'Remove recitation'}
                  </button>
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
