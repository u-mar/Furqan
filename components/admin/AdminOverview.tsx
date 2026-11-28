'use client'

import { AlertTriangle, BadgeCheck, ChevronRight, Headphones, MessageSquare } from 'lucide-react'
import type { AdminSection } from '@/components/admin/AdminShell'
import { Card, Empty, Stat, formatNumber, timeAgo } from '@/components/admin/ui'
import type { AdminUserUsage } from '@/lib/admin-user-map'
import { cn } from '@/lib/cn'

export interface AdminOverviewData {
  generatedAt: number
  people: number
  accounts: number
  online: number
  activeToday: number
  activeYesterday: number | null
  active7: number
  active30: number
  newThisWeek: number
  newLastWeek: number
  newPerDay: Array<{ day: string; count: number }>
  qari: { postsThisWeek: number; postsLastWeek: number }
  halaqas: number
  listenQaris: number
  attention: { reports: number; verification: number; surahsToReview: number; feedbackThisWeek: number }
  topScreens: Array<{ screen: string; views: number; share: number }>
  recentlyActive: AdminUserUsage[]
}

function change(now: number, before: number | null | undefined): number | null {
  if (before === null || before === undefined || before === 0) return null
  return (now - before) / before
}

/** New people per day: thirty bars, the day's number on hover. */
function NewPeopleChart({ days }: { days: AdminOverviewData['newPerDay'] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((sum, d) => sum + d.count, 0)
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={`New people per day, last 30 days: ${total} in all`}>
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[3px] bg-[var(--home-sage-deep)] opacity-80 transition-opacity group-hover:opacity-100"
              style={{ height: `${Math.max(d.count ? 4 : 1.5, (d.count / max) * 100)}%` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--home-heading)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--app-bg)] group-hover:block">
              {new Date(`${d.day}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {d.count}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.6875rem] text-[var(--home-muted)]">
        <span>{new Date(`${days[0]?.day}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

export default function AdminOverview({ data, onOpen }: { data: AdminOverviewData | null; onOpen: (section: AdminSection) => void }) {
  if (!data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[6.25rem] animate-pulse rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)]" />
        ))}
      </div>
    )
  }

  const attention: Array<{ section: AdminSection; label: string; count: number; Icon: typeof AlertTriangle; tone: string }> = [
    { section: 'reports', label: 'Reported recitations', count: data.attention.reports, Icon: AlertTriangle, tone: 'text-amber-600 dark:text-amber-400' },
    { section: 'verification', label: 'Verification requests', count: data.attention.verification, Icon: BadgeCheck, tone: 'text-[var(--home-sage-deep)]' },
    { section: 'listen-qaris', label: 'Surahs to review', count: data.attention.surahsToReview, Icon: Headphones, tone: 'text-[var(--home-sage-deep)]' },
    { section: 'feedback', label: 'Feedback this week', count: data.attention.feedbackThisWeek, Icon: MessageSquare, tone: 'text-[var(--home-muted)]' },
  ]
  const waiting = attention.filter((a) => a.count > 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Online now" value={formatNumber(data.online)} hint="active in the last 90 seconds" live />
        <Stat
          label="Active today"
          value={formatNumber(data.activeToday)}
          trend={change(data.activeToday, data.activeYesterday)}
          hint={data.activeYesterday ? 'vs yesterday' : `${formatNumber(data.active7)} this week`}
        />
        <Stat label="New this week" value={formatNumber(data.newThisWeek)} trend={change(data.newThisWeek, data.newLastWeek)} hint="vs last week" />
        <Stat label="Accounts" value={formatNumber(data.accounts)} hint={`of ${formatNumber(data.people)} people`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card
          title="New people"
          description="First opened the app, per day, the last 30 days."
          actions={<span className="text-[0.75rem] text-[var(--home-muted)]">{formatNumber(data.newPerDay.reduce((s, d) => s + d.count, 0))} in 30 days</span>}
        >
          <NewPeopleChart days={data.newPerDay} />
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--home-card-border)] pt-3 sm:grid-cols-4">
            <Mini label="Active this week" value={data.active7} />
            <Mini label="Active this month" value={data.active30} />
            <Mini label="Qari posts this week" value={data.qari.postsThisWeek} trend={change(data.qari.postsThisWeek, data.qari.postsLastWeek)} />
            <Mini label="Halaqas" value={data.halaqas} />
          </div>
        </Card>

        <Card title="Needs your attention" padded={false}>
          {waiting.length ? (
            <ul className="divide-y divide-[var(--home-card-border)]">
              {attention.map(({ section, label, count, Icon, tone }) => (
                <li key={section}>
                  <button type="button" onClick={() => onOpen(section)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--app-surface)]">
                    <Icon className={cn('h-[18px] w-[18px] shrink-0', tone)} strokeWidth={2} />
                    <span className="min-w-0 flex-1 text-[0.84375rem] font-medium text-[var(--home-heading)]">{label}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[0.75rem] font-semibold tabular-nums',
                        count ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-[var(--app-surface)] text-[var(--home-muted)]'
                      )}
                    >
                      {count}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--home-muted)]" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={<BadgeCheck className="h-7 w-7" />} title="All clear">
              No reports, applications or surahs waiting.
            </Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Most used screens" description="Screen views by people active in the last 30 days.">
          {data.topScreens.length ? (
            <ul className="space-y-2.5">
              {data.topScreens.map((s) => (
                <li key={s.screen} className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-[0.8125rem]">
                  <span className="font-medium text-[var(--home-heading)]">{s.screen}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[var(--app-surface)]">
                    <span className="block h-full rounded-full bg-[var(--home-sage-deep)]" style={{ width: `${Math.max(2, s.share * 100)}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-[var(--home-muted)]">{Math.round(s.share * 100)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No screen views yet" />
          )}
        </Card>

        <Card title="Recently active" padded={false} actions={<button type="button" onClick={() => onOpen('users')} className="text-[0.75rem] font-semibold text-[var(--home-sage-deep)]">All users</button>}>
          <ul className="divide-y divide-[var(--home-card-border)]">
            {data.recentlyActive.map((u) => (
              <li key={u.userId} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', u.isOnline ? 'bg-emerald-500' : 'bg-[var(--home-card-border)]')} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.84375rem] font-medium text-[var(--home-heading)]">{u.userName}</span>
                  <span className="block truncate text-[0.71875rem] text-[var(--home-muted)]">
                    {u.userKind === 'registered' ? 'Account' : 'Guest'} · {u.lastPath}
                  </span>
                </span>
                <span className="shrink-0 text-[0.71875rem] text-[var(--home-muted)]">{u.isOnline ? 'now' : timeAgo(u.lastSeenAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Mini({ label, value, trend }: { label: string; value: number; trend?: number | null }) {
  return (
    <div>
      <p className="text-[0.71875rem] text-[var(--home-muted)]">{label}</p>
      <p className="mt-0.5 text-[1.0625rem] font-semibold tabular-nums text-[var(--home-heading)]">
        {formatNumber(value)}
        {trend !== undefined && trend !== null ? (
          <span className={cn('ml-1.5 text-[0.6875rem] font-medium', trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
            {trend >= 0 ? '▲' : '▼'}
            {Math.abs(Math.round(trend * 100))}%
          </span>
        ) : null}
      </p>
    </div>
  )
}
