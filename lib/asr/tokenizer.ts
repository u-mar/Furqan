/**
 * Decode-only SentencePiece for Muno459/fastconformer-quran-streaming's BPE
 * vocab. We only ever need id -> text (never encoding), and decode turns out
 * to be "concatenate pieces, turn ▁ into a space" plus two small fix-ups —
 * so this ships the pre-extracted vocab as plain JSON instead of a WASM
 * SentencePiece runtime.
 *
 * Verified against the real `sp.decode()` on 5,000 random id sequences:
 * matches exactly except when id 0 (`<unk>`) is the very first token, which
 * doesn't happen in practice (a trained model transcribing real speech does
 * not open with an unknown-token guess) — see UNK_PIECE below.
 */

const WORD_BOUNDARY = '▁' // '▁'
const UNK_PIECE = '<unk>'
const UNK_DISPLAY = ' ⁇ ' // ' ⁇ ', with padding spaces, matching sp.decode()

let vocabPromise: Promise<string[]> | null = null

async function loadVocab(): Promise<string[]> {
  if (!vocabPromise) {
    vocabPromise = fetch('/models/asr/tokenizer-vocab.json').then((r) => {
      if (!r.ok) throw new Error(`Failed to load tokenizer vocab (${r.status})`)
      return r.json() as Promise<string[]>
    })
  }
  return vocabPromise
}

/** Blank id for CTC decoding — outside the 1024-entry vocab (see model.q8.onnx's
 *  `logprobs` output, which has 1025 classes: 0-1023 are vocab, 1024 is blank). */
export const CTC_BLANK_ID = 1024

export interface QuranTokenizer {
  decode(ids: number[]): string
}

export async function loadQuranTokenizer(): Promise<QuranTokenizer> {
  const pieces = await loadVocab()
  return {
    decode(ids: number[]): string {
      let text = ''
      for (const id of ids) {
        const piece = pieces[id]
        text += piece === UNK_PIECE ? UNK_DISPLAY : (piece ?? '')
      }
      text = text.replace(new RegExp(WORD_BOUNDARY, 'g'), ' ')
      if (text.startsWith(' ')) text = text.slice(1)
      return text
    },
  }
}

/** CTC greedy decode: argmax per frame, collapse repeats, drop blank. */
export function ctcGreedyDecode(logprobsPerFrame: Float32Array[] | Float32Array, vocabSize: number): number[] {
  const ids: number[] = []
  let prev = -1
  const frames =
    logprobsPerFrame instanceof Float32Array
      ? chunk(logprobsPerFrame, vocabSize)
      : logprobsPerFrame
  for (const frame of frames) {
    let best = 0
    let bestVal = frame[0]
    for (let i = 1; i < frame.length; i++) {
      if (frame[i] > bestVal) {
        bestVal = frame[i]
        best = i
      }
    }
    if (best !== prev && best !== CTC_BLANK_ID) ids.push(best)
    prev = best
  }
  return ids
}

function* chunk(flat: Float32Array, size: number): Generator<Float32Array> {
  for (let i = 0; i < flat.length; i += size) yield flat.subarray(i, i + size)
}
