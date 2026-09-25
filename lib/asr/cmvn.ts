/**
 * Fixed-global CMVN (cepstral mean/variance normalization), applied per mel
 * bin: (mel - mean) / (std + 1e-5). `tlog_*` are the phone-mic stats (what
 * this app's users record with); `clean_*` are for studio audio.
 */

export interface CmvnStats {
  mean: Float32Array
  std: Float32Array
}

interface CmvnJson {
  tlog_mean: number[]
  tlog_std: number[]
  clean_mean: number[]
  clean_std: number[]
}

let cmvnPromise: Promise<{ tlog: CmvnStats; clean: CmvnStats }> | null = null

async function loadCmvn(): Promise<{ tlog: CmvnStats; clean: CmvnStats }> {
  if (!cmvnPromise) {
    cmvnPromise = fetch('/models/asr/streaming_global_cmvn.json').then(async (r) => {
      if (!r.ok) throw new Error(`Failed to load CMVN stats (${r.status})`)
      const json = (await r.json()) as CmvnJson
      return {
        tlog: { mean: new Float32Array(json.tlog_mean), std: new Float32Array(json.tlog_std) },
        clean: { mean: new Float32Array(json.clean_mean), std: new Float32Array(json.clean_std) },
      }
    })
  }
  return cmvnPromise
}

export async function getCmvnStats(kind: 'tlog' | 'clean' = 'tlog'): Promise<CmvnStats> {
  const stats = await loadCmvn()
  return stats[kind]
}

/** Applies CMVN in place to `logMel[mel][frame]` (as produced by `logMelSpectrogram`). */
export function applyCmvn(logMel: Float32Array[], stats: CmvnStats): void {
  for (let m = 0; m < logMel.length; m++) {
    const mean = stats.mean[m]
    const std = stats.std[m]
    const row = logMel[m]
    for (let t = 0; t < row.length; t++) {
      row[t] = (row[t] - mean) / (std + 1e-5)
    }
  }
}
