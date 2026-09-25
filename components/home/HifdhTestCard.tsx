'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n'

/** Entry point to Hifdh Test: sabaq with the sheikh, or a surprise-ayah recall
 *  check. A real photo behind the title — the same library the ayah/recitation
 *  share cards draw from — rather than an icon standing in for one. */
export default function HifdhTestCard() {
  const t = useT()
  return (
    <section aria-label={t('Hifdh Test')}>
      <h2 className="home-label mb-[9px]">{t('Hifdh Test')}</h2>

      <Link href="/hifdh" className="home-press ed-focus group relative block overflow-hidden rounded-2xl">
        <div className="relative h-[6.5rem] w-full">
          <img
            src="/share-bg/quran-ornate.jpg"
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-active:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />
          <div className="absolute inset-y-0 left-4 flex flex-col justify-center">
            <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm">
              <Sparkles className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <span className="home-serif block text-[1.03125rem] font-semibold leading-snug text-white">
              {t('Test your memorisation')}
            </span>
            <span className="mt-0.5 block text-[0.78125rem] text-white/80">
              {t('Sabaq with the sheikh, or a surprise ayah')}
            </span>
          </div>
        </div>
      </Link>
    </section>
  )
}
