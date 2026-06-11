/** Convert an AudioBuffer to a mono 16-bit PCM WAV Blob at the given sample rate (default 16kHz). */
export function audioBufferToWav(buffer: AudioBuffer, targetRate = 16000): Blob {
  const numCh = buffer.numberOfChannels
  const srcRate = buffer.sampleRate
  const srcLen = buffer.length

  // Downmix to mono
  const mono = new Float32Array(srcLen)
  for (let ch = 0; ch < numCh; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < srcLen; i++) mono[i] += data[i] / numCh
  }

  // Linear resample to targetRate
  let samples: Float32Array
  if (srcRate === targetRate) {
    samples = mono
  } else {
    const ratio = srcRate / targetRate
    const newLen = Math.max(1, Math.round(srcLen / ratio))
    samples = new Float32Array(newLen)
    for (let i = 0; i < newLen; i++) {
      const idx = i * ratio
      const i0 = Math.floor(idx)
      const i1 = Math.min(i0 + 1, srcLen - 1)
      const frac = idx - i0
      samples[i] = mono[i0] * (1 - frac) + mono[i1] * frac
    }
  }

  const dataLen = samples.length * 2
  const ab = new ArrayBuffer(44 + dataLen)
  const view = new DataView(ab)
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  writeStr(0, "RIFF")
  view.setUint32(4, 36 + dataLen, true)
  writeStr(8, "WAVE")
  writeStr(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, targetRate, true)
  view.setUint32(28, targetRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, "data")
  view.setUint32(40, dataLen, true)
  let off = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    off += 2
  }
  return new Blob([ab], { type: "audio/wav" })
}
