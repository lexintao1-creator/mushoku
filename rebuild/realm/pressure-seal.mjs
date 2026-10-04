export const SEAL_TONE_SECONDS = 1.08;

const smooth = value => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };

// Gather into a low resonance, unfold its body, then settle with a short lock.
export function sealTone(sampleRate, index) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isInteger(index) || index < 0 || index > 2)
    throw new RangeError('Invalid seal tone');
  const out = new Float32Array(Math.round(sampleRate * SEAL_TONE_SECONDS));
  const frequency = [140, 160, 180][index], gain = [.078, .087, .096][index];
  let seed = 1709 + index * 977, low = 0, floor = 0, soft = 0, softer = 0;
  const bodyFilter = 1 - Math.exp(-2 * Math.PI * 260 / sampleRate);
  const floorFilter = 1 - Math.exp(-2 * Math.PI * 70 / sampleRate);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate, end = Math.max(0, 1 - t / SEAL_TONE_SECONDS);
    const phase = 2 * Math.PI * (frequency * t - (5 + index * 5) * .11 * (1 - Math.exp(-t / .11)));
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const random = (seed >>> 0) / 2147483648 - 1;
    low += (random - low) * bodyFilter;
    floor += (random - floor) * floorFilter;
    soft += (low - floor - soft) * bodyFilter;
    softer += (soft - softer) * bodyFilter;
    const tremor = softer * 2;
    const gather = .50 * smooth(t / .18) * (1 - smooth((t - .22) / .12));
    const unfold = smooth((t - .22) / .035) * Math.exp(-4.6 * Math.max(0, t - .30));
    const lock = .95 * smooth((t - .62) / .010) * Math.exp(-24 * Math.max(0, t - .63));
    const resonance = Math.sin(phase) + .32 * Math.sin(2 * Math.PI *
      (frequency * 1.92 * t + 9 * .16 * (1 - Math.exp(-t / .16))))
      + .14 * Math.sin(2 * Math.PI * (390 + index * 15) * t);
    const settled = Math.sin(phase) + .18 * Math.sin(phase * 2);
    const ripple = 1 + .12 * Math.sin(2 * Math.PI * (7 + index) * t) * Math.exp(-4 * t);
    const pressure = gather * (.45 * Math.sin(phase) + tremor)
      + unfold * (resonance * ripple + tremor * .6) + lock * settled;
    out[i] = gain * end * pressure;
  }
  out[out.length - 1] = 0;
  return out;
}
