export const AUDIO_FILES = Object.freeze(Object.fromEntries(Object.entries({
  charge: 'pressure-charge.mp3', release: 'water-release.mp3', impact: 'water-impact.mp3',
  chargedRelease: 'sonic-release.mp3', chargedImpact: 'explosion-impact.mp3', chant: 'water-chant.mp3',
}).map(([kind, file]) => [kind, new URL(`./assets/${file}`, import.meta.url).href])));
export const MAX_VOICES = 6;

const defaultContext = () => {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return Context ? new Context() : null;
};
const ignorePromise = value => { Promise.resolve(value).catch(() => {}); };
const clampVolume = value => Math.max(0, Math.min(1, value));

// Owns one context and three decoded buffers. Main calls stopCharge() on cancel/pause;
// release stops charge automatically. Missing/unready sounds are dropped, never queued.
export class RuntimeAudio {
  #contextFactory; #fetcher; #gestureTarget; #gesture;
  #context = null; #master = null; #buffers = new Map(); #voices = new Set();
  #charge = null; #chant = null; #loading = null; #unlocking = null;
  #unlocked = false; #destroyed = false; #volume;

  constructor({ volume = 1, audioContextFactory = defaultContext,
    fetcher = globalThis.fetch?.bind(globalThis), gestureTarget = globalThis.document } = {}) {
    if (typeof audioContextFactory !== 'function' || (fetcher !== undefined && typeof fetcher !== 'function')) throw new TypeError('Invalid audio dependencies');
    if (!Number.isFinite(volume)) throw new TypeError('Invalid volume');
    this.#volume = clampVolume(volume);
    this.#contextFactory = audioContextFactory;
    this.#fetcher = fetcher;
    this.#gestureTarget = gestureTarget;
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
    durations: Object.fromEntries([...this.#buffers].map(([kind, buffer]) => [kind, buffer.duration])) }; }
  stopChant() { this.#stop(this.#chant); }

  async #loadBuffers() {
    await Promise.all(Object.entries(AUDIO_FILES).map(async ([kind, url]) => {
      try {
        if (!this.#fetcher || this.#destroyed) return;
        const response = await this.#fetcher(url);
        if (!response?.ok || this.#destroyed) return;
        const data = await response.arrayBuffer();
        if (this.#destroyed) return;
        const buffer = await this.#context.decodeAudioData(data);
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
        this.#master = context.createGain();
        this.#master.gain.value = this.#volume;
        this.#master.connect(context.destination);
      }
      // Invoke resume synchronously inside the user gesture, before any fetch/await.
      const resumed = this.#context.state === 'running' ? Promise.resolve() : this.#context.resume();
      this.#unlocked = false;
      this.#unlocking = Promise.resolve(resumed).then(async () => {
        if (this.#destroyed || this.#context.state !== 'running') return false;
        this.#unlocked = true;
        this.#loading ??= this.#loadBuffers();
        await this.#loading;
        return this.unlocked;
      }).catch(() => false).finally(() => { this.#unlocking = null; });
      return this.#unlocking;
    } catch {
      this.#unlocked = false;
      return Promise.resolve(false);
    }
  }

  #stop(voice) {
    if (!voice || !this.#voices.delete(voice)) return;
    if (this.#charge === voice) this.#charge = null;
    if (this.#chant === voice) this.#chant = null;
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* A voice may already have ended. */ }
    try { voice.source.disconnect(); } catch { /* Disposal remains idempotent. */ }
  }

  stopCharge() {
    const hadCharge = !!this.#charge;
    this.#stop(this.#charge);
    this.#stop(this.#chant);
    return hadCharge;
  }

  setChargePressure(progress) {
    if (!Number.isFinite(progress) || !this.#charge?.source.playbackRate) return false;
    // The authored crescendo spans the full twelve-second charge, not a short loop.
    const rate = this.#buffers.get('charge').duration / 12;
    const param = this.#charge.source.playbackRate;
    if (param.setTargetAtTime) param.setTargetAtTime(rate, this.#context.currentTime, 0.08);
    else param.value = rate;
    return rate;
  }

  play(kind) {
    if (kind === 'cancel' || kind === 'pause') { this.stopCharge(); return false; }
    if (!Object.hasOwn(AUDIO_FILES, kind)) return false;
    if (kind === 'release' || kind === 'chargedRelease') this.stopCharge();
    if (!this.unlocked || !this.#buffers.has(kind)) return false;
    if (kind === 'charge' && this.#charge) return true;
    if (kind === 'chant' && this.#chant) return true;
    // Preserve the one sustained charge voice when impact effects fill the pool.
    if (this.#voices.size >= MAX_VOICES) this.#stop([...this.#voices].find(v => v !== this.#charge));
    let voice;
    try {
      const source = this.#context.createBufferSource();
      voice = { kind, source };
      this.#voices.add(voice);
      if (kind === 'charge') this.#charge = voice;
      if (kind === 'chant') this.#chant = voice;
      source.buffer = this.#buffers.get(kind);
      source.loop = false;
      if (kind === 'charge' && source.playbackRate && Number.isFinite(source.buffer.duration)) source.playbackRate.value = source.buffer.duration / 12;
      source.connect(this.#master);
      source.onended = () => this.#stop(voice);
      source.start(0);
      return true;
    } catch {
      this.#stop(voice);
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
    for (const type of ['pointerdown', 'keydown', 'touchend']) this.#gestureTarget?.removeEventListener(type, this.#gesture, true);
    for (const voice of [...this.#voices]) this.#stop(voice);
    this.#buffers.clear();
    try { this.#master?.disconnect(); } catch {}
    try { if (this.#context) ignorePromise(this.#context.close()); } catch {}
  }
}

export const createRuntimeAudio = options => new RuntimeAudio(options);
