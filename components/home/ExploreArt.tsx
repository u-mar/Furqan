/**
 * Small scenes for the Explore cards on Home. Each is drawn in three tones
 * (--art-1 the strong one, --art-2 the soft one, --art-3 the highlight) that the
 * card's colour set defines in globals.css, so they sit right in light and dark.
 */

interface ArtProps {
  className?: string
}

const base = { viewBox: '0 0 120 110', fill: 'none', 'aria-hidden': true } as const

/** An open mushaf lit from above, a ribbon hanging from the spine. */
export function ReadArt({ className }: ArtProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="82" cy="34" r="26" fill="var(--art-3)" opacity="0.35" />
      <path d="M60 30c-9-6-21-8-34-6a4 4 0 0 0-3.400 4v50c0 2.400 2 4.200 4.400 4 11-.8 22 1.200 33 6.500V30z" fill="var(--art-2)" />
      <path d="M60 30c9-6 21-8 34-6a4 4 0 0 1 3.400 4v50c0 2.400-2 4.200-4.400 4-11-.8-22 1.200-33 6.500V30z" fill="var(--art-1)" />
      <path d="M60 30c9-6 21-8 34-6a4 4 0 0 1 3.400 4v50c0 2.400-2 4.200-4.400 4-11-.8-22 1.200-33 6.500V30z" fill="#fff" opacity="0.16" />
      <g stroke="var(--art-1)" strokeWidth="2.400" strokeLinecap="round" opacity="0.55">
        <path d="M30 40c8-1 15 0 23 3M30 50c8-1 15 0 23 3M30 60c8-1 15 0 23 3" />
      </g>
      <g stroke="#fff" strokeWidth="2.400" strokeLinecap="round" opacity="0.75">
        <path d="M67 43c8-3 15-4 23-3M67 53c8-3 15-4 23-3M67 63c8-3 15-4 23-3" />
      </g>
      <path d="M60 30v58" stroke="var(--art-1)" strokeWidth="2.400" strokeLinecap="round" />
      <path d="M50 88v14l5-4 5 4V88z" fill="var(--art-3)" />
      <path d="M96 12l1.700 4.300 4.300 1.700-4.300 1.700L96 24l-1.700-4.300L90 18l4.300-1.700L96 12z" fill="var(--art-3)" />
      <circle cx="20" cy="18" r="2.200" fill="var(--art-3)" opacity="0.8" />
    </svg>
  )
}

/** A mosque at dusk: dome, two minarets, crescent and stars. */
export function PrayerArt({ className }: ArtProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="80" cy="42" r="30" fill="var(--art-3)" opacity="0.32" />
      <path d="M86 16a11 11 0 1 0 8 19 9 9 0 0 1-8-19z" fill="var(--art-3)" />
      <rect x="18" y="46" width="9" height="52" rx="2" fill="var(--art-2)" />
      <path d="M22.500 30l5 14h-10l5-14z" fill="var(--art-1)" />
      <rect x="93" y="46" width="9" height="52" rx="2" fill="var(--art-2)" />
      <path d="M97.500 30l5 14h-10l5-14z" fill="var(--art-1)" />
      <path d="M60 38c-13 8-22 17-22 30v30h44V68c0-13-9-22-22-30z" fill="var(--art-1)" />
      <path d="M60 38c-13 8-22 17-22 30v30h22V38z" fill="#fff" opacity="0.14" />
      <rect x="59" y="26" width="2" height="12" rx="1" fill="var(--art-1)" />
      <circle cx="60" cy="24" r="3.200" fill="var(--art-3)" />
      <path d="M52 98V82a8 8 0 0 1 16 0v16H52z" fill="var(--art-3)" />
      <rect x="10" y="97" width="100" height="6" rx="3" fill="var(--art-2)" />
      <circle cx="30" cy="16" r="1.800" fill="var(--art-3)" />
      <circle cx="46" cy="10" r="1.300" fill="var(--art-3)" opacity="0.8" />
    </svg>
  )
}

/** A studio microphone with the level of the voice rising beside it. */
export function QariArt({ className }: ArtProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="62" cy="48" r="34" fill="var(--art-3)" opacity="0.3" />
      <g stroke="var(--art-2)" strokeWidth="5" strokeLinecap="round">
        <path d="M14 46v14M24 38v30M34 44v18" />
        <path d="M90 44v18M100 38v30M110 46v14" />
      </g>
      <rect x="48" y="14" width="28" height="52" rx="14" fill="var(--art-1)" />
      <rect x="48" y="14" width="14" height="52" rx="7" fill="#fff" opacity="0.16" />
      <g stroke="#fff" strokeWidth="2.200" strokeLinecap="round" opacity="0.6">
        <path d="M54 30h16M54 38h16M54 46h16" />
      </g>
      <path d="M38 52a24 24 0 0 0 48 0" stroke="var(--art-1)" strokeWidth="5" strokeLinecap="round" />
      <path d="M62 76v14" stroke="var(--art-1)" strokeWidth="5" strokeLinecap="round" />
      <rect x="46" y="90" width="32" height="8" rx="4" fill="var(--art-3)" />
      <path d="M100 14l1.600 4 4 1.600-4 1.600-1.600 4-1.600-4-4-1.600 4-1.600 1.600-4z" fill="var(--art-3)" />
    </svg>
  )
}

/** Headphones over a rising wave of sound. */
export function ListenArt({ className }: ArtProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="60" cy="52" r="34" fill="var(--art-3)" opacity="0.3" />
      <path d="M22 62V54a38 38 0 0 1 76 0v8" stroke="var(--art-1)" strokeWidth="7" strokeLinecap="round" />
      <rect x="14" y="58" width="20" height="36" rx="10" fill="var(--art-1)" />
      <rect x="86" y="58" width="20" height="36" rx="10" fill="var(--art-1)" />
      <rect x="18" y="66" width="8" height="20" rx="4" fill="#fff" opacity="0.3" />
      <rect x="94" y="66" width="8" height="20" rx="4" fill="#fff" opacity="0.3" />
      <g stroke="var(--art-2)" strokeWidth="5" strokeLinecap="round">
        <path d="M44 60v22M52 50v42M60 56v30M68 46v50M76 58v26" />
      </g>
      <circle cx="98" cy="18" r="2.400" fill="var(--art-3)" />
      <path d="M22 20l1.500 3.500 3.500 1.500-3.500 1.500L22 30l-1.500-3.500L17 25l3.500-1.500L22 20z" fill="var(--art-3)" />
    </svg>
  )
}
