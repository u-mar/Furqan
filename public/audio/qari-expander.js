/* global AudioWorkletProcessor, registerProcessor, sampleRate */
/**
 * A gentle downward expander for Qari recordings.
 *
 * The compressors after it lift a soft recitation up to a published level, and
 * would lift the room's hiss with it. This turns the signal down softly in the
 * pauses between ayat — never to silence, which sounds cut-off and unnatural,
 * just enough that the hiss stays below the voice the way it does in a studio.
 *
 * Plain JavaScript, served as is: an AudioWorklet module cannot be bundled.
 */
class QariExpander extends AudioWorkletProcessor {
  constructor() {
    super()
    this.envelope = 0
    this.gain = 1
    this.hold = 0
    const rate = sampleRate
    // How fast the level detector follows the voice: quick to open, slow to close.
    this.attack = Math.exp(-1 / (0.004 * rate))
    this.release = Math.exp(-1 / (0.12 * rate))
    // The gain moves smoothly so a word never starts with a click.
    this.open = Math.exp(-1 / (0.003 * rate))
    this.close = Math.exp(-1 / (0.25 * rate))
    this.holdSamples = Math.floor(0.18 * rate)
    this.threshold = Math.pow(10, -52 / 20)
    this.ratio = 2
    this.floor = Math.pow(10, -14 / 20)
  }

  process(inputs, outputs) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0) return true

    const frames = input[0].length
    for (let i = 0; i < frames; i += 1) {
      let level = 0
      for (let c = 0; c < input.length; c += 1) level = Math.max(level, Math.abs(input[c][i]))

      const coefficient = level > this.envelope ? this.attack : this.release
      this.envelope = level + coefficient * (this.envelope - level)

      let target = 1
      if (this.envelope >= this.threshold) {
        this.hold = this.holdSamples
      } else if (this.hold > 0) {
        this.hold -= 1
      } else {
        // Below the threshold, every dB quieter becomes `ratio` dB quieter.
        const under = Math.max(this.envelope, 1e-6) / this.threshold
        target = Math.max(this.floor, Math.pow(under, this.ratio - 1))
      }

      const smoothing = target > this.gain ? this.open : this.close
      this.gain = target + smoothing * (this.gain - target)

      for (let c = 0; c < output.length; c += 1) {
        output[c][i] = (input[c] ? input[c][i] : input[0][i]) * this.gain
      }
    }
    return true
  }
}

registerProcessor('qari-expander', QariExpander)
