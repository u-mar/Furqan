'use client'

import { HifdhHeader, HifdhModeCard, HifdhScreen } from '@/components/hifdh/HifdhScreen'
import { useT } from '@/lib/i18n'

export default function HifdhPage() {
  const t = useT()
  return (
    <HifdhScreen>
      <HifdhHeader title={t('Hifdh Test')} backHref="/" sub={t('Two ways to test what you\'ve memorised')} />

      <div className="mt-[22px] flex flex-col gap-3">
        <HifdhModeCard
          href="/hifdh/sabaq"
          image="/icons/noto/studio-microphone.svg"
          title={t('Sabaq')}
          description={t('The sheikh reads an ayah, then it\'s your turn — back and forth, checked as you go')}
        />
        <HifdhModeCard
          href="/hifdh/random"
          image="/icons/noto/open-book.svg"
          title={t('Surprise ayah')}
          description={t('Pick a surah or juz — see one ayah, then recite the next one from memory')}
        />
      </div>
    </HifdhScreen>
  )
}
