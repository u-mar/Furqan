'use client'

import TestScopeSetup, { scopeSearchParams, type ScopeConfig } from '@/components/test/TestScopeSetup'

function buildRandomHref(config: ScopeConfig) {
  const params = scopeSearchParams(config)
  params.set('mode', 'random')
  return `/test?${params.toString()}`
}

export default function TestRandomSetupPage() {
  return (
    <TestScopeSetup
      title="Randomize"
      subtitle="Pick surah, juz, or ayah range — tests will be random within it"
      backHref="/test/select"
      startLabel="Start random test"
      buildHref={buildRandomHref}
    />
  )
}
