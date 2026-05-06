import type { WordResult, Op } from '@/types'
import { normalise } from './normalise'

export function diffWords(canonical: string[], hypothesis: string[]): WordResult[] {
  const m = canonical.length
  const n = hypothesis.length

  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = normalise(canonical[i - 1]) === normalise(hypothesis[j - 1]) ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }

  const results: WordResult[] = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (normalise(canonical[i - 1]) === normalise(hypothesis[j - 1]) ? 0 : 1)) {
      const op: Op = normalise(canonical[i - 1]) === normalise(hypothesis[j - 1]) ? 'match' : 'substitution'
      results.unshift({ canonical: canonical[i - 1], hypothesis: hypothesis[j - 1], op })
      i--
      j--
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      results.unshift({ canonical: canonical[i - 1], hypothesis: '', op: 'deletion' })
      i--
    } else {
      results.unshift({ canonical: '', hypothesis: hypothesis[j - 1], op: 'insertion' })
      j--
    }
  }

  return results
}

export function score(results: WordResult[]): number {
  const correct = results.filter(r => r.op === 'match').length
  const total = results.filter(r => r.op !== 'insertion').length
  return total === 0 ? 0 : Math.round((correct / total) * 100)
}
