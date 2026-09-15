'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Check, Link2, Send, Share2, X } from 'lucide-react'
import { ErrorCard, HalaqaScreen, Skeleton, Toast, copyText, useToast } from '@/components/halaqa/HalaqaScreen'
import { tapFeedback } from '@/lib/haptics'
import { getHalaqa, inviteLink, inviteMessage, whatsAppLink, type HalaqaDetail } from '@/lib/halaqa'

export default function InvitePage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<HalaqaDetail | null>(null)
  const [error, setError] = useState('')
  const { toast, showToast } = useToast()

  const load = useCallback(async () => {
    try {
      setDetail(await getHalaqa(id))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this halaqa.')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const halaqa = detail?.halaqa
  const message = halaqa ? inviteMessage(halaqa.name, halaqa.code) : ''

  const copyLink = async () => {
    if (!halaqa) return
    tapFeedback()
    showToast((await copyText(inviteLink(halaqa.code))) ? 'Link copied.' : 'Could not copy the link.')
  }

  const shareElsewhere = async () => {
    if (!halaqa) return
    if (navigator.share) {
      try {
        await navigator.share({ title: halaqa.name, text: message })
      } catch {
        // Closed the share sheet.
      }
      return
    }
    showToast((await copyText(message)) ? 'Invite copied — paste it anywhere.' : 'Could not copy the invite.')
  }

  return (
    <HalaqaScreen>
      <div className="flex justify-end">
        <Link href={`/halaqa/${id}`} className="home-round ed-focus" aria-label="Close">
          <X className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </Link>
      </div>

      {error && !detail ? <ErrorCard message={error} onRetry={() => void load()} /> : null}
      {!detail && !error ? <Skeleton className="mt-7 h-[320px] rounded-2xl" /> : null}

      {halaqa ? (
        <>
          <div className="mt-7 flex flex-col items-center px-3 text-center">
            <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
              <Check className="h-[34px] w-[34px]" strokeWidth={2.4} />
            </span>
            <h1 className="home-serif mt-5 text-[1.5625rem] font-semibold tracking-[-0.02em] text-[var(--home-heading)]">
              {halaqa.name} is ready
            </h1>
            <p className="mt-2 max-w-[290px] text-[0.90625rem] leading-relaxed text-[var(--home-muted)] [text-wrap:pretty]">
              Now invite your family and friends. They only need their name to join.
            </p>
          </div>

          <h2 className="home-label mx-1 mb-2 mt-[38px]">Invite link</h2>
          <div className="home-card overflow-hidden rounded-2xl">
            <button type="button" onClick={() => void copyLink()} className="set-row">
              <span className="set-row__icon" aria-hidden>
                <Link2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="set-row__label truncate">{inviteLink(halaqa.code).replace(/^https?:\/\//, '')}</span>
              <span className="shrink-0 text-sm font-semibold text-[var(--home-sage-deep)]">Copy</span>
            </button>
          </div>

          <div className="mt-[22px] flex flex-col gap-2.5">
            <a
              href={whatsAppLink(message)}
              target="_blank"
              rel="noopener noreferrer"
              className="ed-ink ed-focus flex h-12 items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold transition-transform active:scale-[0.98]"
            >
              <Send className="h-[17px] w-[17px]" strokeWidth={2.1} />
              Share on WhatsApp
            </a>
            <button
              type="button"
              onClick={() => void shareElsewhere()}
              className="ed-focus flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-[0.90625rem] font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
            >
              <Share2 className="h-[17px] w-[17px]" strokeWidth={2} />
              Share another way
            </button>
          </div>
          <Link
            href={`/halaqa/${id}`}
            className="ed-focus mx-auto mt-4 block w-fit rounded-md px-2 py-1 text-sm font-semibold text-[var(--home-sage-deep)]"
          >
            Go to {halaqa.name}
          </Link>
        </>
      ) : null}

      <Toast message={toast} />
    </HalaqaScreen>
  )
}
