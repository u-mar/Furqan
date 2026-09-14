/** Shimmering stand-ins shaped like recitation rows, so a list never loads as a blank. */
export default function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div aria-hidden className="space-y-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5" style={{ opacity: 1 - i * 0.14 }}>
          <span className="qari-skeleton h-11 w-11 shrink-0 rounded-full" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="qari-skeleton block h-3.5 w-3/5 rounded-full" />
            <span className="qari-skeleton block h-3 w-2/5 rounded-full" />
          </span>
          <span className="qari-skeleton h-[38px] w-[38px] shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}
