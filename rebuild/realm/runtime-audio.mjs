import { preparePressureWind, createPressureWind, windStage } from './pressure-wind.mjs';
import { sealTone } from './pressure-seal.mjs';
export const AUDIO_FILES = Object.freeze(Object.fromEntries(Object.entries({
  charge: 'pressure-charge.mp3', release: 'water-release.mp3', impact: 'water-impact.mp3',
  chargedRelease: 'sonic-release.mp3', chargedImpact: 'explosion-impact.mp3', chant: 'water-chant.mp3', hold: 'pressure-hold.mp3',
}).map(([kind, file]) => [kind, new URL(`./assets/${file}`, import.meta.url).href])));
export const MAX_VOICES = 6;
const defaultWindNode = globalThis.AudioWorkletNode
  ? (context, name, options) => new globalThis.AudioWorkletNode(context, name, options) : null;

const defaultContext = () => {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return Context ? new Context() : null;
};
const ignorePromise = value => { Promise.resolve(value).catch(() => {}); };
const clampVolume = value => Math.max(0, Math.min(1, value));

// Owns one context and declared decoded buffers. Main calls stopCharge() on cancel/pause;
// Release fades pressure automatically. Effects never queue; only the current
// gesture's pressure intent waits for initial worklet readiness and is cancelable.
export class RuntimeAudio {
  #contextFactory; #fetcher; #gestureTarget; #gesture; #windNodeFactory; #stateChange;
  #context = null; #master = null; #buffers = new Map(); #voices = new Set();
  #charge = null; #chant = null; #loading = null; #unlocking = null; #windMode = null; #pendingCharge = null;
  #unlocked = false; #destroyed = false; #volume;
  #sealBuffers = []; #sealCast = null; #sealSeen = new Set(); #sealClosed = false; #retiredSealCasts = new Set();

  constructor({ volume = 1, audioContextFactory = defaultContext,
    fetcher = globalThis.fetch?.bind(globalThis), gestureTarget = globalThis.document,
    windNodeFactory = defaultWindNode } = {}) {
    if (typeof audioContextFactory !== 'function' || (fetcher !== undefined && typeof fetcher !== 'function')) throw new TypeError('Invalid audio dependencies');
    if (!Number.isFinite(volume)) throw new TypeError('Invalid volume');
    this.#volume = clampVolume(volume);
    this.#contextFactory = audioContextFactory;
    this.#fetcher = fetcher;
    this.#gestureTarget = gestureTarget;
    this.#windNodeFactory = windNodeFactory;
    this.#stateChange = () => {
      if (this.#context?.state !== 'running') {
        this.#pendingCharge = null;
        this.#sealClosed = true;
        for (const voice of [...this.#voices]) this.#dispose(voice);
      }
    };
    this.#gesture = event => {
      if (event?.isTrusted === false) return;
      ignorePromise(this.unlock());
    };
    for (const type of ['pointerdown', 'keydown', 'touchend']) this.#gestureTarget?.addEventListener(type, this.#gesture, { capture: true, passive: true });
  }

  get volume() { return this.#volume; }
  get unlocked() { return this.#unlocked && !this.#destroyed && this.#context?.state === 'running'; }
  get activeVoices() { return this.#voices.size; }
  get diagnostics() { return { unlocked: this.unlocked, activeVoices: this.activeVoices,
    pressureMode: this.#windMode, pressurePhase: this.#charge
      ? windStage(this.#charge.seconds + Math.max(0, this.#context.currentTime - this.#charge.since)).phase : null,
    sealCast: this.#sealCast, sealPlayed: [...this.#sealSeen],
    durations: Object.fromEntries([...this.#buffers].map(([kind, buffer]) => [kind, buffer.duration])) }; }
  stopChant() { this.#stop(this.#chant); }

  playSeal(index, { castId } = {}) {
    if (!Number.isInteger(index) || index < 0 || index > 2 ||
      !(typeof castId === 'string' && castId.length || typeof castId === 'number' && Number.isFinite(castId)) ||
      !this.unlocked || !this.#sealBuffers[index]) return false;
    if (this.#retiredSealCasts.has(castId)) return false;
    if (castId !== this.#sealCast) {
      if (this.#sealCast !== null) this.#retiredSealCasts.add(this.#sealCast);
      if (this.#retiredSealCasts.size > 8) this.#retiredSealCasts.delete(this.#retiredSealCasts.values().next().value);
      for (const voice of [...this.#voices]) if (voice.seal) this.#dispose(voice);
      this.#sealCast = castId; this.#sealSeen.clear(); this.#sealClosed = false;
    }
    if (this.#sealClosed || this.#sealSeen.has(index)) return false;
    if (!this.#startVoice('seal', this.#context.currentTime, this.#sealBuffers[index])) return false;
    this.#sealSeen.add(index);
    return true;
  }

  async #loadBuffers() {
    await Promise.all(Object.entries(AUDIO_FILES).filter(([kind]) => kind !== 'charge' && kind !== 'hold').map(async ([kind, url]) => {
      try {
        if (!this.#fetcher || this.#destroyed) return;
        const response = await this.#fetcher(url);
        if (!response?.ok || this.#destroyed) return;
        const data = await response.arrayBuffer();
        if (this.#destroyed) return;
        const buffer = await this.#context.decodeAudioData(data);
        if (this.#destroyed) return;
        if (!this.#destroyed && buffer) this.#buffers.set(kind, buffer);
      } catch { /* Missing files and decode rejection leave that kind unavailable. */ }
    }));
  }

  // Call directly in an input handler if automatic gesture listeners are not used.
  unlock() {
    if (this.#destroyed) return Promise.resolve(false);
    if (this.#unlocking) return this.#unlocking;
    if (this.unlocked) return Promise.resolve(true);
    try {
      if (!this.#context) {
        const context = this.#contextFactory();
        if (!context) return Promise.resolve(false);
        this.#context = context;
        context.addEventListener?.('statechange', this.#stateChange);
        this.#master = context.createGain();
        this.#master.gain.value = this.#volume;
        this.#master.connect(context.destination);
        if (context.createBuffer) this.#sealBuffers = [0, 1, 2].map(index => {
          const pcm = sealTone(context.sampleRate, index), buffer = context.createBuffer(1, pcm.length, context.sampleRate);
          buffer.getChannelData(0).set(pcm); return buffer;
        });
      }
      // Invoke resume synchronously inside the user gesture, before any fetch/await.
      const resumed = this.#context.state === 'running' ? Promise.resolve() : this.#context.resume();
      this.#unlocked = false;
      this.#unlocking = Promise.resolve(resumed).then(async () => {
        if (this.#destroyed || this.#context.state !== 'running') return false;
        this.#unlocked = true;
        this.#loading ??= Promise.all([this.#loadBuffers(), preparePressureWind(this.#context, this.#windNodeFactory).then(mode => {
          if (!this.#destroyed) this.#windMode = mode;
        })]);
        await this.#loading;
        if (this.unlocked && this.#pendingCharge) {
          const pending = this.#pendingCharge;
          this.#pendingCharge = null;
          this.#startWind(pending.seconds + Math.max(0, this.#context.currentTime - pending.since));
        }
        return this.unlocked;
      }).catch(() => { this.#pendingCharge = null; return false; }).finally(() => { this.#unlocking = null; });
      return this.#unlocking;
    } catch {
      this.#unlocked = false;
      return Promise.resolve(false);
    }
  }

  #dispose(voice) {
    if (!voice || !this.#voices.delete(voice)) return;
    if (this.#charge === voice) this.#charge = null;
    if (this.#chant === voice) this.#chant = null;
    voice.source.onended = null;
    try { if (voice.wind) voice.source.stop(true); else voice.source.stop(); } catch { /* A voice may already have ended. */ }
    try { voice.source.disconnect(); } catch { /* Disposal remains idempotent. */ }
    if (!voice.wind) try { voice.source.buffer = null; } catch {}
  }

  #stop(voice) {
    if (!voice || !this.#voices.has(voice)) return;
    if (voice.wind && this.#context.state === 'running') {
      if (this.#charge === voice) this.#charge = null;
      if (!voice.stopping) { voice.stopping = true; voice.source.stop(); }
    } else this.#dispose(voice);
  }

  stopCharge() {
    const hadCharge = !!(this.#charge || this.#pendingCharge);
    this.#pendingCharge = null;
    this.#sealClosed = true;
    for (const voice of [...this.#voices]) if (voice.seal) this.#dispose(voice);
    this.#stop(this.#charge);
    this.#stop(this.#chant);
    return hadCharge;
  }

  setChargePressure(progress) {
    if (!Number.isFinite(progress)) return false;
    const value = clampVolume(progress), voice = this.#charge ?? this.#pendingCharge;
    if (!voice) return false;
    voice.seconds = value * 12; voice.since = this.#context.currentTime;
    voice.source?.setProgress(value);
    return value;
  }

  play(kind, { elapsedSeconds = 0 } = {}) {
    if (kind === 'pause') {
      this.#pendingCharge = null;
      this.#sealClosed = true;
      for (const voice of [...this.#voices]) this.#dispose(voice);
      return false;
    }
    if (kind === 'cancel') { this.stopCharge(); return false; }
    if (!Object.hasOwn(AUDIO_FILES, kind)) return false;
    if (kind === 'release' || kind === 'chargedRelease') this.stopCharge();
    if (kind === 'charge' || kind === 'hold') {
      if (this.#charge || this.#pendingCharge) return true;
      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return false;
      const seconds = kind === 'hold' ? 12 : elapsedSeconds;
      if (!this.unlocked || !this.#windMode) {
        if (this.#unlocking) { this.#pendingCharge = { seconds, since: this.#context.currentTime }; return true; }
        return false;
      }
      return this.#startWind(seconds);
    }
    if (!this.unlocked || !this.#buffers.has(kind)) return false;
    if (kind === 'chant' && this.#chant) return true;
    return this.#startVoice(kind, this.#context.currentTime);
  }

  #reserveVoice() {
    if (this.#voices.size >= MAX_VOICES) {
      const victim = [...this.#voices].find(v => v !== this.#charge);
      if (!victim) return false;
      this.#dispose(victim);
    }
    return true;
  }

  #startWind(seconds) {
    if (!this.#windMode || !this.#reserveVoice()) return false;
    let voice;
    try {
      voice = { kind: 'charge', wind: true, seconds, since: this.#context.currentTime,
        source: createPressureWind(this.#context, this.#windMode, this.#windNodeFactory, seconds) };
      this.#voices.add(voice); this.#charge = voice;
      voice.source.onended = () => this.#dispose(voice);
      voice.source.connect(this.#master);
      return true;
    } catch { this.#dispose(voice); return false; }
  }

  #startVoice(kind, startTime, buffer = this.#buffers.get(kind)) {
    if (!this.#reserveVoice()) return false;
    let voice;
    try {
      const source = this.#context.createBufferSource();
      voice = { kind, source, seal: kind === 'seal' };
      this.#voices.add(voice);
      if (kind === 'chant') this.#chant = voice;
      source.buffer = buffer;
      source.loop = false;
      source.connect(this.#master);
      source.onended = () => this.#dispose(voice);
      source.start(startTime);
      return true;
    } catch {
      this.#dispose(voice);
      return false;
    }
  }

  setVolume(value) {
    if (!Number.isFinite(value)) return false;
    this.#volume = clampVolume(value);
    if (this.#master && !this.#destroyed) {
      try { this.#master.gain.setValueAtTime(this.#volume, this.#context.currentTime); }
      catch { try { this.#master.gain.value = this.#volume; } catch {} }
    }
    return this.#volume;
  }

  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#unlocked = false;
    this.#pendingCharge = null;
    for (const type of ['pointerdown', 'keydown', 'touchend']) this.#gestureTarget?.removeEventListener(type, this.#gesture, true);
    for (const voice of [...this.#voices]) this.#dispose(voice);
    this.#buffers.clear();
    this.#sealBuffers = []; this.#sealSeen.clear(); this.#sealClosed = true;
    this.#retiredSealCasts.clear();
    this.#context?.removeEventListener?.('statechange', this.#stateChange);
    try { this.#master?.disconnect(); } catch {}
    try { if (this.#context) ignorePromise(this.#context.close()); } catch {}
  }
}

export const createRuntimeAudio = options => new RuntimeAudio(options);
