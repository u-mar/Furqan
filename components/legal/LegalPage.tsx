import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { APP_NAME } from '@/lib/app-brand'

export interface LegalSection {
  id: string
  label: string
}

/**
 * Shared chrome for the legal pages (Privacy Policy, Terms of Service), so
 * they read as one consistent document rather than two one-off pages: the
 * same header, an at-a-glance summary, a jump list to every section, and a
 * link across to the other one.
 */
export default function LegalPage({
  title,
  updated,
  summary,
  sections,
  crossLink,
  children,
}: {
  title: string
  /** e.g. "16 September 2026". */
  updated: string
  /** The "in short" card at the top — a handful of plain-English bullets. */
  summary: React.ReactNode
  /** Must match an `id` on an `<h2>` in `children`, in reading order. */
  sections: LegalSection[]
  crossLink: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto max-w-2xl px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            aria-label="Back"
            className="ed-focus flex h-11 w-11 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
          </Link>
          <Link
            href={crossLink.href}
            className="ed-focus rounded-full px-3.5 py-2 text-[13px] font-semibold text-[var(--home-sage-deep)] transition-colors hover:bg-[var(--home-track)] dark:text-[var(--home-sage)]"
          >
            {crossLink.label}
          </Link>
        </div>

        <p className="ed-label mt-8">{APP_NAME}</p>
        <h1 className="home-serif mt-2 text-[2.25rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[var(--home-muted)]">Last updated {updated}</p>

        <div className="legal-summary mt-6">
          <p className="legal-summary__label">In short</p>
          {summary}
        </div>

        <nav aria-label={`${title} — sections`} className="legal-toc mt-6">
          <ol>
            {sections.map((section, i) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>
                  <span className="legal-toc__num">{i + 1}</span>
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="privacy-prose mt-8">{children}</div>

        <p className="mt-10 border-t border-[var(--home-rule)] pt-6 text-sm text-[var(--home-muted)]">
          Read the{' '}
          <Link href={crossLink.href} className="font-semibold text-[var(--home-sage-deep)] dark:text-[var(--home-sage)]">
            {crossLink.label}
          </Link>{' '}
          too, or go back to <Link href="/">{APP_NAME}</Link>.
        </p>
      </div>
    </main>
  )
}
