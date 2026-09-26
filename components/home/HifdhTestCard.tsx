'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n'

/** Entry point to Hifdh Test: sabaq with the sheikh, or a surprise-ayah
 *  recall check — the same noto icon-image style Prayer and Qibla use
 *  above, not a photo or a plain lucide icon standing in for one. */
export default function HifdhTestCard() {
  const t = useT()
  return (
    <section aria-label={t('Hifdh Test')}>
      <h2 className="home-label mb-[9px]">{t('Hifdh Test')}</h2>

      <Link
        href="/hifdh"
        className="home-card home-press ed-focus flex items-center gap-3 rounded-2xl px-3.5 py-3"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--home-sage-soft)]">
          <img src="/icons/noto/open-book.svg" alt="" className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="home-serif block truncate text-[1.03125rem] font-semibold leading-snug text-[var(--home-heading)]">
            {t('Test your memorisation')}
          </span>
          <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">
            {t('Sabaq with the sheikh, or a surprise ayah')}
          </span>
        </span>
        <span className="ed-ink flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full">
          <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
        </span>
      </Link>
    </section>
  )
}
