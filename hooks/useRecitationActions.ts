'use client'

import { useCallback, useState } from 'react'
import { askToSignIn } from '@/lib/account-prompt'
import { tapFeedback } from '@/lib/haptics'
import { tr } from '@/lib/i18n-core'
import { deleteRecitation, reportRecitation, setRecitationPrivacy, type Recitation } from '@/lib/qari'

/**
 * What can be done to one recitation besides playing it — delete, make
 * private, report, share — shared by the list card and the swipe view so both
 * behave the same.
 */
export function useRecitationActions({
  recitation,
  viewerId,
  viewerUsername,
  onRemoved,
  onUpdated,
  onNotice,
}: {
  recitation: Recitation
  viewerId: string | null
  viewerUsername: string | null
  onRemoved?: (id: string) => void
  /** Its visibility changed rather than being deleted — the parent list decides what that means for it. */
  onUpdated?: (id: string, patch: Partial<Recitation>) => void
  onNotice?: (message: string) => void
}) {
  const [shareOpen, setShareOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  // Set only while a toggle is in flight, or if it failed and had to be put back.
  const [optimisticPrivate, setOptimisticPrivate] = useState<boolean | null>(null)

  const isOwner = Boolean(viewerId && viewerUsername && viewerUsername === recitation.userUsername)
  const isPrivate = optimisticPrivate ?? recitation.isPrivate

  const handleDelete = useCallback(async () => {
    if (!viewerId) return
    setRemoving(true)
    try {
      await deleteRecitation(recitation.id, viewerId)
      onRemoved?.(recitation.id)
      onNotice?.(tr('Recitation deleted.'))
    } catch {
      setRemoving(false)
      onNotice?.(tr('Could not delete that recitation.'))
    }
  }, [onNotice, onRemoved, recitation.id, viewerId])

  const handleTogglePrivacy = useCallback(async () => {
    if (!viewerId) return
    const next = !isPrivate
    tapFeedback()
    setOptimisticPrivate(next)
    try {
      await setRecitationPrivacy(recitation.id, viewerId, next)
      onNotice?.(next ? tr('Only you can hear it now.') : tr('Everyone can hear it now.'))
      onUpdated?.(recitation.id, { isPrivate: next })
    } catch {
      setOptimisticPrivate(!next)
      onNotice?.(tr('Could not change that.'))
    }
  }, [isPrivate, onNotice, onUpdated, recitation.id, viewerId])

  const handleReportTap = useCallback(() => {
    if (!viewerId) {
      askToSignIn({ reason: tr('Create a free account to report a recitation.') })
      return
    }
    setReportOpen(true)
  }, [viewerId])

  const handleReportReason = useCallback(
    async (reason: string) => {
      setReportOpen(false)
      if (!viewerId) return
      try {
        await reportRecitation(recitation.id, viewerId, reason)
        onNotice?.(tr('Thank you. It has been sent for review.'))
      } catch {
        onNotice?.(tr('Could not send that report.'))
      }
    },
    [onNotice, recitation.id, viewerId]
  )

  return {
    isOwner,
    isPrivate,
    removing,
    shareOpen,
    setShareOpen,
    reportOpen,
    setReportOpen,
    handleDelete,
    handleTogglePrivacy,
    handleReportTap,
    handleReportReason,
  }
}
