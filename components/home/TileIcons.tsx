/** Solid glyph icons for the home grid, plus the small ornaments used as
 *  typographic dividers across the Home and Settings surfaces. */

/** An open mushaf, seen from above, its two leaves lifting from the spine. */
export function IconRead({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="currentColor" aria-hidden>
      <path
        d="M23 13.4C18.3 10.8 12.8 9.6 6.6 9.9A2.6 2.6 0 0 0 4 12.5v22.3c0 1.5 1.2 2.7 2.7 2.6 5.7-.2 10.9.9 16.3 3.5V13.4z"
        opacity="0.3"
      />
      <path
        d="M25 13.4c4.7-2.6 10.2-3.8 16.4-3.5A2.6 2.6 0 0 1 44 12.5v22.3c0 1.5-1.2 2.7-2.7 2.6-5.7-.2-10.9.9-16.3 3.5V13.4z"
        opacity="0.3"
      />
      <rect x="8.5" y="16.5" width="11" height="2.1" rx="1.05" />
      <rect x="8.5" y="21.6" width="11" height="2.1" rx="1.05" />
      <rect x="8.5" y="26.7" width="8" height="2.1" rx="1.05" />
      <rect x="28.5" y="16.5" width="11" height="2.1" rx="1.05" />
      <rect x="28.5" y="21.6" width="11" height="2.1" rx="1.05" />
      <rect x="31.5" y="26.7" width="8" height="2.1" rx="1.05" />
      <rect x="23" y="12.6" width="2" height="27.5" rx="1" />
    </svg>
  )
}

/** A mosque: a dome with its crescent, and a minaret beside it. */
export function IconPrayer({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="currentColor" aria-hidden>
      <path d="M14 42V27.5C14 21 18.6 16.4 24 13c5.4 3.4 10 8 10 14.5V42H14z" opacity="0.35" />
      <path d="M24 5.2a3.4 3.4 0 0 1 2.4 5.8 2.7 2.7 0 1 0 0-4.6 3.4 3.4 0 0 0-2.4-1.2z" />
      <rect x="22.9" y="11.5" width="2.2" height="4" rx="1" />
      <path d="M24 17.6c-4.4 2.9-8 6.4-8 11.2V42h16V28.8c0-4.8-3.6-8.3-8-11.2z" />
      <rect x="6" y="20" width="5" height="22" rx="1.2" opacity="0.7" />
      <path d="M8.5 11.5l3 5.8h-6l3-5.8z" opacity="0.7" />
      <rect x="37" y="20" width="5" height="22" rx="1.2" opacity="0.7" />
      <path d="M39.5 11.5l3 5.8h-6l3-5.8z" opacity="0.7" />
      <rect x="21" y="34" width="6" height="8" rx="3" fill="var(--home-card-bg, #fff)" />
    </svg>
  )
}

/** A halaqa seen from above: six people sitting around an open mushaf. */
export function IconHalaqa({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="currentColor" aria-hidden>
      <circle cx="24" cy="5.5" r="4.2" />
      <circle cx="40" cy="14.8" r="4.2" />
      <circle cx="40" cy="33.2" r="4.2" />
      <circle cx="24" cy="42.5" r="4.2" />
      <circle cx="8" cy="33.2" r="4.2" />
      <circle cx="8" cy="14.8" r="4.2" />
      <path
        d="M22.8 16.8c-2.6-1.5-5.6-2.2-9-2a1.4 1.4 0 0 0-1.3 1.4v14.2c0 .8.7 1.4 1.5 1.4 3.2-.1 6 .6 8.8 2.1V16.8z"
        opacity="0.4"
      />
      <path
        d="M25.2 16.8c2.6-1.5 5.6-2.2 9-2a1.4 1.4 0 0 1 1.3 1.4v14.2c0 .8-.7 1.4-1.5 1.4-3.2-.1-6 .6-8.8 2.1V16.8z"
        opacity="0.4"
      />
      <rect x="22.9" y="16.2" width="2.2" height="18.4" rx="1.1" />
    </svg>
  )
}

export function IconMemorize({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="currentColor" aria-hidden>
      <rect x="10" y="8" width="22" height="28" rx="2" opacity="0.5" />
      <rect x="14" y="12" width="22" height="28" rx="2" opacity="0.75" />
      <rect x="18" y="16" width="22" height="28" rx="2" />
    </svg>
  )
}

/** Headphones — someone else's voice, carrying the recitation. */
export function IconListen({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="currentColor" aria-hidden>
      <path d="M24 6C14.1 6 6 14.1 6 24v4.5h4.4V24c0-7.5 6.1-13.6 13.6-13.6S37.6 16.5 37.6 24v4.5H42V24c0-9.9-8.1-18-18-18z" />
      <rect x="4" y="26.5" width="9" height="15.5" rx="4.5" />
      <rect x="35" y="26.5" width="9" height="15.5" rx="4.5" />
      <rect x="6.6" y="29.6" width="3.8" height="9.3" rx="1.9" opacity="0.35" />
      <rect x="37.6" y="29.6" width="3.8" height="9.3" rx="1.9" opacity="0.35" />
    </svg>
  )
}

/** A microphone between two level bars — your own voice, recorded. */
export function IconQari({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="currentColor" aria-hidden>
      <rect x="5" y="17.5" width="3.2" height="11" rx="1.6" opacity="0.32" />
      <rect x="9.8" y="20.5" width="3.2" height="5" rx="1.6" opacity="0.32" />
      <rect x="39.8" y="17.5" width="3.2" height="11" rx="1.6" opacity="0.32" />
      <rect x="35" y="20.5" width="3.2" height="5" rx="1.6" opacity="0.32" />
      <rect x="19.4" y="5" width="9.2" height="19.5" rx="4.6" />
      <path d="M15 20.8v3a9 9 0 0 0 18 0v-3h-3.5v3a5.5 5.5 0 1 1-11 0v-3H15z" />
      <rect x="22.3" y="33" width="3.4" height="6.4" rx="1.7" />
      <rect x="16.8" y="38.6" width="14.4" height="3.4" rx="1.7" />
    </svg>
  )
}

export function IconQuranStand({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" className={className} fill="currentColor" aria-hidden>
      <path d="M28 8c-6 0-11 4-11 9v3h3v-3c0-3 3.6-5 8-5s8 2 8 5v22h-6v6h-4v-6h-6V17c0-5-5-9-11-9z" opacity="0.15" />
      <path d="M12 38h32l-4 8H16l-4-8zm2-28h8l-2 24H14L14 10zm20 0h8l2 24h-6L32 10zM26 12h4v20h-4V12z" />
    </svg>
  )
}

/** Eight-point star (rub el hizb) used as a typographic divider. */
export function IconOrnament({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M23 12l-6.75 1.76 3.53 6.02-6.02-3.53L12 23l-1.76-6.75-6.02 3.53 3.53-6.02L1 12l6.75-1.76-3.53-6.02 6.02 3.53L12 1l1.76 6.75 6.02-3.53-3.53 6.02z" />
    </svg>
  )
}

/** Crescent for the Hijri dateline. */
export function IconCrescent({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M15.5 2a9.5 9.5 0 1 0 6.5 16.4A7.5 7.5 0 0 1 13 6.6 9.5 9.5 0 0 1 15.5 2z" />
    </svg>
  )
}
