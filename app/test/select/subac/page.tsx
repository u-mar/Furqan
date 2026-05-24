'use client'

import { useState } from 'react'
import TestScopeSetup, { scopeSearchParams, type ScopeConfig } from '@/components/test/TestScopeSetup'

function buildSubacHref(config: ScopeConfig, participants: number) {
  const params = scopeSearchParams(config)
  params.set('mode', 'subac')
  params.set('participants', String(participants))
  return `/test?${params.toString()}`
}

export default function TestSubacSetupPage() {
  const [participants, setParticipants] = useState(3)

  return (
    <TestScopeSetup
      title="Subac"
      subtitle="Group reading — each person gets their own ayah"
      backHref="/test/select"
      startLabel="Start group session"
      buildHref={(config) => buildSubacHref(config, participants)}
      canStart={() => participants >= 2}
      extra={
        <div className="mb-5 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4">
          <label htmlFor="participants" className="mb-2 block text-sm font-medium text-[var(--app-text)]">
            People in the group
          </label>
          <p className="mb-3 text-xs text-[var(--app-muted)]">
            Ayahs in your selection are shared one per person, in order.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setParticipants((n) => Math.max(2, n - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--home-card-border)] text-lg font-medium text-[var(--app-text)]"
              aria-label="Fewer people"
            >
              −
            </button>
            <span
              id="participants"
              className="min-w-[3rem] text-center text-2xl font-semibold text-teal-600 dark:text-teal-400"
            >
              {participants}
            </span>
            <button
              type="button"
              onClick={() => setParticipants((n) => Math.min(30, n + 1))}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--home-card-border)] text-lg font-medium text-[var(--app-text)]"
              aria-label="More people"
            >
              +
            </button>
          </div>
        </div>
      }
    />
  )
}
