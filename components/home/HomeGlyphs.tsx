'use client'

/* The pictures Home's shortcuts use: drawn, not icons, in the app's own picture style. */

/** The dial's marks: one every 10°, longer every 30°, none where a letter or the Kaaba sits. */
const DIAL_TICKS = Array.from({ length: 36 }, (_, i) => i * 10).filter((deg) => ![0, 30, 120, 210, 300].includes(deg))

/** N, E, S and W, turned with the dial so the Kaaba is at the top. */
const DIAL_LETTERS: Array<[string, number]> = [['N', 30], ['E', 120], ['S', 210], ['W', 300]]

/**
 * The qibla compass: a black dial with pale-blue marks, its letters turned so
 * the Kaaba sits at the top, and the needle (red to the north) pointing at it.
 * It fills its circle; no ground of its own around it.
 */
export function QiblaGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-hidden>
      <circle cx="50" cy="50" r="49" fill="#0b0c0e" />
      <circle cx="50" cy="50" r="48.25" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
      <g stroke="#cfe3ff" strokeLinecap="round">
        {DIAL_TICKS.map((deg) => (
          <line
            key={deg}
            x1="50"
            y1={deg % 30 === 0 ? 6.5 : 8}
            x2="50"
            y2={deg % 30 === 0 ? 13.5 : 12}
            strokeWidth={deg % 30 === 0 ? 2.4 : 1.8}
            transform={`rotate(${deg} 50 50)`}
          />
        ))}
      </g>
      <g fill="#dceaff" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="12.5" textAnchor="middle">
        {DIAL_LETTERS.map(([letter, deg]) => (
          <text key={letter} x="50" y="23" transform={`rotate(${deg} 50 50)`}>
            {letter}
          </text>
        ))}
      </g>
      {/* The Kaaba at the top: a black cube with its gold band. */}
      <g transform="translate(50 15.5)">
        <polygon points="-10,-4 0,-8 10,-4 0,0" fill="#3a3a3c" />
        <polygon points="-10,-4 0,0 0,10 -10,6" fill="#141416" />
        <polygon points="0,0 10,-4 10,6 0,10" fill="#1f1f22" />
        <polygon points="-10,-1.2 0,2.8 0,5 -10,1" fill="#d6a33a" />
        <polygon points="0,2.8 10,-1.2 10,1 0,5" fill="#e8b94c" />
      </g>
      {/* The needle: red half towards the Kaaba, pale half behind. */}
      <polygon points="50,28 54.2,52 45.8,52" fill="#e5322d" />
      <polygon points="50,79 54.2,52 45.8,52" fill="#dceaff" />
      <circle cx="50" cy="52" r="2.2" fill="#0b0c0e" stroke="#dceaff" strokeWidth="1" />
    </svg>
  )
}

/**
 * A small circle of people around an open book — a halaqa, a study circle
 * reading together — drawn in the same gold-and-teal picture style as the
 * compass, instead of a plain book icon.
 */
export function HalaqaGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-hidden>
      <defs>
        <linearGradient id="pqt-halaqa-dot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5cc4ab" />
          <stop offset="1" stopColor="#0d6b63" />
        </linearGradient>
        <linearGradient id="pqt-halaqa-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3dc9b" />
          <stop offset="1" stopColor="#b8893a" />
        </linearGradient>
      </defs>
      {/* People, seated in a ring. */}
      <circle cx="32" cy="7.5" r="5.6" fill="url(#pqt-halaqa-dot)" />
      <circle cx="53.3" cy="19.8" r="5.6" fill="url(#pqt-halaqa-dot)" />
      <circle cx="53.3" cy="44.2" r="5.6" fill="url(#pqt-halaqa-dot)" />
      <circle cx="32" cy="56.5" r="5.6" fill="url(#pqt-halaqa-dot)" />
      <circle cx="10.7" cy="44.2" r="5.6" fill="url(#pqt-halaqa-dot)" />
      <circle cx="10.7" cy="19.8" r="5.6" fill="url(#pqt-halaqa-dot)" />
      {/* An open book at the centre, outlined so it still shows on a light tile. */}
      <path
        d="M30 22.5c-3.2-1.9-7-2.7-11.2-2.4a1.8 1.8 0 0 0-1.6 1.8v17.4c0 1 .8 1.8 1.9 1.8 4-.1 7.5.8 11 2.6V22.5z"
        fill="#f1efe8"
        stroke="rgba(60, 44, 18, 0.32)"
        strokeWidth="0.9"
      />
      <path
        d="M34 22.5c3.2-1.9 7-2.7 11.2-2.4a1.8 1.8 0 0 1 1.6 1.8v17.4c0 1-.8 1.8-1.9 1.8-4-.1-7.5.8-11 2.6V22.5z"
        fill="#f1efe8"
        stroke="rgba(60, 44, 18, 0.32)"
        strokeWidth="0.9"
      />
      <rect x="31.2" y="21.5" width="1.6" height="22.8" rx="0.8" fill="url(#pqt-halaqa-gold)" />
    </svg>
  )
}
