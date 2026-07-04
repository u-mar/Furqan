export interface DtwPair {
  refIdx: number
  userIdx: number
}

export function dtwAlign(a: number[], b: number[]): DtwPair[] {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return []

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity))
  dp[0][0] = 0

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(a[i - 1] - b[j - 1])
      dp[i][j] = cost + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }

  const path: DtwPair[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    path.push({ refIdx: i - 1, userIdx: j - 1 })
    const choices = [
      { di: 1, dj: 0, v: dp[i - 1][j] },
      { di: 0, dj: 1, v: dp[i][j - 1] },
      { di: 1, dj: 1, v: dp[i - 1][j - 1] },
    ]
    const best = choices.reduce((x, y) => (x.v <= y.v ? x : y))
    i -= best.di
    j -= best.dj
  }

  return path.reverse()
}

export function pearsonCorrelation(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  const meanA = a.reduce((s, v) => s + v, 0) / a.length
  const meanB = b.reduce((s, v) => s + v, 0) / b.length
  let num = 0
  let denA = 0
  let denB = 0
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  const den = Math.sqrt(denA * denB)
  if (den === 0) return 0
  return num / den
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB)
  if (mag === 0) return 0
  return dot / mag
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
