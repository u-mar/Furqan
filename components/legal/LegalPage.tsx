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
 * same header, an at-a-glance summary, a contents list to every section, and
 * a link across to the other one. Set small and plain, the way a professional
 * policy reads (the legal-* styles in app/globals.css).
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
  /** The summary at the top — a handful of plain-English bullets. */
  summary: React.ReactNode
  /** Must match an `id` on an `<h2>` in `children`, in reading order. */
  sections: LegalSection[]
  crossLink: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            aria-label="Back"
            className="ed-focus flex h-10 w-10 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </Link>
          <Link
            href={crossLink.href}
            className="ed-focus rounded-full px-3 py-2 text-[13px] font-semibold text-[var(--home-sage-deep)] transition-colors hover:bg-[var(--home-track)] dark:text-[var(--home-sage)]"
          >
            {crossLink.label}
          </Link>
        </div>

        <header className="mt-7">
          <p className="legal-head__brand">{APP_NAME}</p>
          <h1 className="legal-head__title">{title}</h1>
          <p className="legal-head__meta">Last updated {updated}</p>
        </header>

        <section aria-label="Summary" className="legal-summary mt-6">
          <p className="legal-label">Summary</p>
          {summary}
        </section>

        <nav aria-label={`${title} — contents`} className="legal-toc mt-7">
          <p className="legal-label">Contents</p>
          <ol>
            {sections.map((section, i) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>
                  <span className="legal-toc__num">{i + 1}.</span>
                  {/* Numbered here, so a label's own "3. " is not repeated. */}
                  {section.label.replace(/^\d+\.\s*/, '')}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="legal-prose mt-8">{children}</div>

        <p className="mt-10 border-t border-[var(--home-rule)] pt-5 text-[13px] text-[var(--home-muted)]">
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
