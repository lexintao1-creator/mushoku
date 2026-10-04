export const SEAL_TONE_SECONDS = 1.08;

// A restrained pressure impact and low body resonance, with no bell partials.
export function sealTone(sampleRate, index) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isInteger(index) || index < 0 || index > 2)
    throw new RangeError('Invalid seal tone');
  const out = new Float32Array(Math.round(sampleRate * SEAL_TONE_SECONDS));
  const frequency = [80, 92, 105][index], gain = [.092, .103, .115][index];
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate, end = Math.max(0, 1 - t / SEAL_TONE_SECONDS);
    const attack = Math.min(1, t / .012);
    const phase = 2 * Math.PI * (frequency * t + 20 * .045 * (1 - Math.exp(-t / .045)));
    const body = Math.sin(phase) + .28 * Math.sin(2 * Math.PI * frequency * 1.92 * t)
      + .12 * Math.sin(2 * Math.PI * (230 + index * 10) * t);
    const impact = .22 * Math.sin(2 * Math.PI * (118 + index * 4) * t) * Math.exp(-22 * t);
    out[i] = gain * attack * end * end * Math.exp(-2.1 * t) * (body + impact);
  }
  out[out.length - 1] = 0;
  return out;
}
