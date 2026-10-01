'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import QariAvatar from '@/components/qari/QariAvatar'
import { tapFeedback } from '@/lib/haptics'
import { refreshBlockedUsers, unblockUser, useBlockedUsers } from '@/lib/qari-blocks'
import { toast } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'

/** Everyone the signed-in person has blocked in Qari, each with Unblock. */
export default function BlockedAccountsSheet({
  open,
  viewer,
  onClose,
}: {
  open: boolean
  viewer: { id: string; username: string } | null
  onClose: () => void
}) {
  const t = useT()
  const blocked = useBlockedUsers(viewer)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (open && viewer) void refreshBlockedUsers(viewer)
  }, [open, viewer])

  const unblock = async (username: string) => {
    if (!viewer) return
    tapFeedback()
    setBusy(username)
    try {
      await unblockUser(viewer, username)
      toast(tr('Unblocked @{username}.', { username }), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : tr('Could not change that.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <SettingsSheet
      open={open}
      title={t('Blocked accounts')}
      description={t('You don’t see their posts in Qari, and they can’t follow you.')}
      onClose={onClose}
    >
      {blocked.size === 0 ? (
        <p className="py-6 text-center text-[0.875rem] text-[var(--home-muted)]">{t('You haven’t blocked anyone.')}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--home-rule)]">
          {[...blocked].map((username, i) => (
            <div key={username}>
              {i ? <div className="set-row__divider" style={{ marginLeft: 56 }} aria-hidden /> : null}
              <div className="set-row" style={{ paddingBlock: 9 }}>
                <QariAvatar username={username} name={username} size={32} />
                <span className="set-row__label truncate">@{username}</span>
                <button
                  type="button"
                  onClick={() => void unblock(username)}
                  disabled={busy === username}
                  className="ed-focus flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--home-rule-strong)] px-3.5 text-[13px] font-semibold text-[var(--home-heading)] disabled:opacity-60"
                >
                  {busy === username ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t('Unblock')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsSheet>
  )
}
