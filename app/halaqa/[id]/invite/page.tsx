'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Check, Link2, Send, Share2, X } from 'lucide-react'
import {
  ActionButton,
  CopyLabel,
  ErrorCard,
  HalaqaScreen,
  Rise,
  Skeleton,
  copyText,
  useFlash,
} from '@/components/halaqa/HalaqaScreen'
import { errorFeedback, tapFeedback } from '@/lib/haptics'
import { getHalaqa, inviteLink, inviteMessage, whatsAppLink, type HalaqaDetail } from '@/lib/halaqa'
import { errorMessage, toastError, toastSuccess } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'

export default function InvitePage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<HalaqaDetail | null>(null)
  const [error, setError] = useState('')
  const [copied, flashCopied] = useFlash()

  const load = useCallback(async () => {
    try {
      setDetail(await getHalaqa(id))
      setError('')
    } catch (err) {
      setError(errorMessage(err, tr('Could not load this halaqa.')))
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const halaqa = detail?.halaqa
  const message = halaqa ? inviteMessage(halaqa.name, halaqa.code) : ''

  const copyLink = async () => {
    if (!halaqa) return
    if (await copyText(inviteLink(halaqa.code))) {
      tapFeedback()
      flashCopied()
    } else {
      errorFeedback()
      toastError(tr('Could not copy the link.'))
    }
  }

  const shareElsewhere = async () => {
    if (!halaqa) return
    tapFeedback()
    if (navigator.share) {
      try {
        await navigator.share({ title: halaqa.name, text: message })
      } catch {
        // Closed the share sheet.
      }
      return
    }
    if (await copyText(message)) toastSuccess(tr('Invite copied. Paste it anywhere.'))
    else toastError(tr('Could not copy the invite.'))
  }

  return (
    <HalaqaScreen>
      <div className="flex justify-end">
        <Link href={`/halaqa/${id}`} className="home-round ed-focus" aria-label={t('Close')}>
          <X className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </Link>
      </div>

      {error && !detail ? <ErrorCard message={error} onRetry={load} /> : null}
      {!detail && !error ? <Skeleton className="mt-7 h-[320px] rounded-2xl" /> : null}

      {halaqa ? (
        <>
          <div className="mt-7 flex flex-col items-center px-3 text-center">
            <span className="fx-pop-in fx-ring flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
              <Check className="fx-draw h-[34px] w-[34px]" strokeWidth={2.4} />
            </span>
            <h1
              className="home-serif fx-rise mt-5 text-[1.5625rem] font-semibold tracking-[-0.02em] text-[var(--home-heading)]"
              style={{ ['--i' as string]: 3 }}
            >
              {halaqa.name} {t('is ready')}</h1>
            <p
              className="fx-rise mt-2 max-w-[290px] text-[0.90625rem] leading-relaxed text-[var(--home-muted)] [text-wrap:pretty]"
              style={{ ['--i' as string]: 4 }}
            >
              {t('Now invite your family and friends. They only need their name to join.')}</p>
          </div>

          <Rise order={5}>
            <h2 className="home-label mx-1 mb-2 mt-[38px]">{t('Invite link')}</h2>
            <div className="home-card overflow-hidden rounded-2xl">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="set-row"
                aria-label={copied ? t('Invite link copied') : t('Copy invite link')}
              >
                <span className="set-row__icon" aria-hidden>
                  <Link2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
                </span>
                <span className="set-row__label truncate">{inviteLink(halaqa.code).replace(/^https?:\/\//, '')}</span>
                <CopyLabel copied={copied} />
              </button>
            </div>
          </Rise>

          <Rise order={6} className="mt-[22px] flex flex-col gap-2.5">
            <a
              href={whatsAppLink(message)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => tapFeedback()}
              className="ed-ink ed-focus fx-press flex h-12 items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold"
            >
              <Send className="h-[17px] w-[17px]" strokeWidth={2.1} />
              {t('Share on WhatsApp')}</a>
            <ActionButton kind="outline" icon={Share2} onClick={() => void shareElsewhere()}>
              {t('Share another way')}</ActionButton>
          </Rise>
          <Link
            href={`/halaqa/${id}`}
            className="ed-focus fx-rise mx-auto mt-4 block w-fit rounded-md px-2 py-1 text-sm font-semibold text-[var(--home-sage-deep)]"
            style={{ ['--i' as string]: 7 }}
          >
            {t('Go to')} {halaqa.name}
          </Link>
        </>
      ) : null}
    </HalaqaScreen>
  )
}
