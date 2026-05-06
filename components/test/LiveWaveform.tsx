'use client'

export default function LiveWaveform() {
  return (
    <div
      className="flex h-10 items-end justify-center gap-1"
      aria-hidden="true"
    >
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          className="hifdh-wave-bar w-1 rounded-full bg-teal-600/70 origin-bottom"
          style={{ animationDelay: `${i * 0.08}s` }}
        />
      ))}
      <span className="sr-only">Audio level visualization</span>
    </div>
  )
}
