'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ImitateAccessGuard from '@/components/imitate/ImitateAccessGuard'
import ImitateSession from '@/components/imitate/ImitateSession'
import { useAppSettings } from '@/hooks/useAppSettings'
import { getChapters, getVersesByChapter } from '@/lib/quran'
import { getVerseArabicText } from '@/lib/quran-display'

export default function ImitateAyahPage() {
  const params = useParams()
  const settings = useAppSettings()
  const surah = Number(params.surah)
  const ayah = Number(params.ayah)
  const [arabicText, setArabicText] = useState('')
  const [surahName, setSurahName] = useState('')

  useEffect(() => {
    if (!surah || !ayah) return
    Promise.all([getChapters(), getVersesByChapter(surah)])
      .then(([chapters, verses]) => {
        const chapter = chapters.find((c) => c.id === surah)
        setSurahName(chapter?.englishName ?? `Surah ${surah}`)
        const verse = verses.find((v) => v.verse_number === ayah || v.verse_key === `${surah}:${ayah}`)
        setArabicText(verse ? getVerseArabicText(verse, { omitEndMark: true }) : '')
      })
      .catch(() => {
        setSurahName(`Surah ${surah}`)
        setArabicText('')
      })
  }, [surah, ayah])

  if (!surah || !ayah) {
    return null
  }

  return (
    <ImitateAccessGuard>
      <ImitateSession
        surah={surah}
        ayah={ayah}
        reciterId={settings.reciterId}
        arabicText={arabicText}
        surahName={surahName}
      />
    </ImitateAccessGuard>
  )
}
