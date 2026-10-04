export const WIND_PHASES = Object.freeze(['onset', 'wind-rise', 'tension', 'absolute-field', 'climax']);
export const WIND_FADE_SECONDS = .04;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => value * value * (3 - 2 * value);
const gates = [0, 6, 9, 10.8, 12];
const levels = [.012, .045, .10, .16, .23];

export function windStage(seconds) {
  let index = 0;
  while (index < 4 && seconds >= gates[index + 1]) index++;
  const mix = index === 4 ? 0 : smooth(clamp((seconds - gates[index]) / (gates[index + 1] - gates[index]), 0, 1));
  return { phase: WIND_PHASES[index], density: index === 0 ? 0 : levels[index] + ((levels[index + 1] ?? levels[index]) - levels[index]) * mix,
    pressure: clamp(seconds / 12, 0, 1) };
}

// Stateful white/pink noise and filters: no PCM asset, buffer loop or hold reset.
export class PressureWindDSP {
  constructor(sampleRate, { seed = 713, seconds = 0 } = {}) {
    this.sampleRate = sampleRate;
    this.seed = seed >>> 0 || 713;
    this.seconds = seconds;
    this.frames = 0;
    this.pink = [0, 0, 0]; this.rumble = 0; this.air = [0, 0]; this.airLow = [0, 0];
    this.howlX = [0, 0]; this.howlX2 = [0, 0]; this.howlY = [0, 0]; this.howlY2 = [0, 0];
    this.dc = [0, 0]; this.last = [0, 0];
    this.rotation = 0; this.drift = 0; this.driftTarget = 0; this.driftFrames = 0;
    this.fade = -1; this.ended = false;
    this.pinkAlpha = [25, 180, 1100].map(hz => 1 - Math.exp(-2 * Math.PI * hz / sampleRate));
    this.rumbleAlpha = 1 - Math.exp(-2 * Math.PI * 85 / sampleRate);
    this.driftAlpha = 1 - Math.exp(-1 / (.45 * sampleRate));
    this.dcPole = Math.exp(-2 * Math.PI * 12 / sampleRate);
  }
  random() {
    let seed = this.seed;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    this.seed = seed >>> 0;
    return this.seed / 2147483648 - 1;
  }
  setProgress(progress) { if (Number.isFinite(progress) && !this.ended && this.fade < 0) this.seconds = clamp(progress, 0, 1) * 12; }
  stop(immediate = false) {
    if (immediate) { this.ended = true; this.fade = 0; }
    else if (this.fade < 0) this.fade = Math.round(this.sampleRate * WIND_FADE_SECONDS);
  }
  render(left, right) {
    const stage = windStage(this.seconds), pressure = stage.pressure;
    const airAlpha = 1 - Math.exp(-2 * Math.PI * (1000 + pressure * 1700) / this.sampleRate);
    const lowAlpha = 1 - Math.exp(-2 * Math.PI * 280 / this.sampleRate);
    const omega = 2 * Math.PI * (380 + pressure * 340 + this.drift * 25) / this.sampleRate;
    const alpha = Math.sin(omega) / (2 * 2.8), denominator = 1 + alpha;
    const b0 = alpha / denominator, a1 = -2 * Math.cos(omega) / denominator, a2 = (1 - alpha) / denominator;
    for (let i = 0; i < left.length; i++) {
      if (this.ended) { left[i] = 0; right[i] = 0; continue; }
      if (--this.driftFrames <= 0) {
        this.driftTarget = this.random();
        this.driftFrames = Math.round(this.sampleRate * (.19 + (this.random() + 1) * .37));
      }
      this.drift += (this.driftTarget - this.drift) * this.driftAlpha;
      const noise = this.random();
      for (let band = 0; band < 3; band++) this.pink[band] += (noise - this.pink[band]) * this.pinkAlpha[band];
      const pink = this.pink[0] * 4 + this.pink[1] * 2 + this.pink[2];
      this.rumble += (pink - this.rumble) * this.rumbleAlpha;
      this.rotation += 2 * Math.PI * (.55 + pressure * 2.8 + this.drift * .21) / this.sampleRate;
      if (this.rotation > Math.PI * 2) this.rotation -= Math.PI * 2;
      const pulseDepth = stage.phase === 'climax' ? .025 : .06 + pressure * .07;
      const pulse = 1 + Math.sin(this.rotation) * pulseDepth + this.drift * .025;
      const attack = Math.min(1, this.frames / (this.sampleRate * .07)) * smooth(clamp((this.seconds - 6) / .15, 0, 1));
      const fade = this.fade < 0 ? 1 : this.fade / Math.round(this.sampleRate * WIND_FADE_SECONDS);
      for (let channel = 0; channel < 2; channel++) {
        const white = this.random();
        this.air[channel] += (white - this.air[channel]) * airAlpha;
        this.airLow[channel] += (white - this.airLow[channel]) * lowAlpha;
        const wide = this.air[channel] - this.airLow[channel];
        const howl = b0 * (white - this.howlX2[channel]) - a1 * this.howlY[channel] - a2 * this.howlY2[channel];
        this.howlX2[channel] = this.howlX[channel]; this.howlX[channel] = white;
        this.howlY2[channel] = this.howlY[channel]; this.howlY[channel] = howl;
        const pan = 1 + Math.sin(this.rotation + channel * Math.PI) * (stage.phase === 'climax' ? .02 : .09);
        const raw = (this.rumble * (.65 + pressure * .35) + pink * .15
          + wide * (.3 + pressure * .55) + howl * (.25 + pressure * .65)) * stage.density * pulse * pan;
        const highpass = raw - this.last[channel] + this.dcPole * this.dc[channel];
        this.last[channel] = raw; this.dc[channel] = highpass;
        const value = .85 * Math.tanh(highpass) * attack * fade;
        if (channel === 0) left[i] = value; else right[i] = value;
      }
      this.frames++; this.seconds += 1 / this.sampleRate;
      if (this.fade > 0 && --this.fade === 0) this.ended = true;
    }
    return !this.ended;
  }
}

const modules = new WeakMap();
export async function preparePressureWind(context, nodeFactory) {
  if (!modules.has(context)) modules.set(context, (async () => {
    if (context.audioWorklet?.addModule && nodeFactory) {
      try { await context.audioWorklet.addModule(new URL('./pressure-wind-worklet.mjs', import.meta.url).href); return 'worklet'; }
      catch { /* Fall back to generated streaming PCM, never to a short asset loop. */ }
    }
    return context.createScriptProcessor ? 'script' : null;
  })());
  return modules.get(context);
}

let voiceSeed = 713;
export function createPressureWind(context, mode, nodeFactory, seconds = 0) {
  voiceSeed = (voiceSeed + 0x9e3779b9) >>> 0;
  const seed = globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] : voiceSeed;
  const node = mode === 'worklet'
    ? nodeFactory(context, 'pressure-wind', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { seed, seconds } })
    : context.createScriptProcessor(2048, 0, 2);
  const dsp = mode === 'script' ? new PressureWindDSP(context.sampleRate, { seed, seconds }) : null;
  let disposed = false;
  const source = { onended: null,
    connect(target) { node.connect(target); },
    disconnect() {
      if (disposed) return;
      disposed = true;
      if (node.port) { node.port.postMessage({ type: 'shutdown' }); node.port.onmessage = null; node.port.close(); }
      node.onaudioprocess = null; node.disconnect();
    },
    setProgress(progress) { if (!disposed) { if (dsp) dsp.setProgress(progress); else node.port.postMessage({ type: 'progress', progress }); } },
    stop(immediate = false) {
      if (disposed) return;
      if (immediate) { dsp?.stop(true); source.onended?.(); }
      else if (dsp) dsp.stop(); else node.port.postMessage({ type: 'stop' });
    } };
  if (dsp) node.onaudioprocess = event => {
    if (!dsp.render(event.outputBuffer.getChannelData(0), event.outputBuffer.getChannelData(1))) source.onended?.();
  };
  else node.port.onmessage = event => { if (event.data?.type === 'ended' && !disposed) source.onended?.(); };
  return source;
}
