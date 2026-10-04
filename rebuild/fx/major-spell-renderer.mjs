// MEETING-10 presentation adapter for cumulonimbus, Phaser 3.90. No hits/costs/AI.
// Default: seal-only preparation, rejected clouds disabled; formal release art missing.
// preloadMajorSeal(scene); new MajorSpellRenderer(scene, createSealOnlyManifest()).
// cameraPush.factor is relative to main's BASE zoom, capped at 1.12; focus/retainPoints
// keep caster and target framed. No automatic camera mutation or spell release.
// seal-only uses caster.staff/actualStaffAnchor + normalized caster.aim at +12/+30/+50.
// Optional spell.stageElapsedMs is main's layer clock starting after the 2s gate;
// readiness still follows prepareStartMs. Material rotates, Image plane only follows aim.
// {sealOnly:false} preserves the previous weather controller as an unused candidate.
// new MajorSpellRenderer(scene, manifest?, {maxInstances:24, lowInstances:12}).
// update({timeMs, paused, quality, caster:{x,y,staff:{x,y}}, camera:{worldView},
//   spell:{id:'water-shaping' (sealOnly) | 'cumulonimbus',castId,phase,prepareStartMs,phaseStartMs,releasedMs?,
//     x,y,radius:280,durationMs?}, events:[{id,castId,spellId,type,timeMs,x?,y?}]}).
// phase: prepare|ready|build|sustain|dissipate|cancelled|ended. Times are SIMULATION ms.
// water-shaping accepts prepare/ready/cancelled/ended only, never weather or weather release.
// Its forward seals reveal over 2-4s, 3-5s and 4-6s, ahead of 12s readiness.
// 12s prepares readiness, never releases. Weather requires authoritative releasedMs
// or a release/released event after >=12s preparation. Sustain never auto-ends.
// Pauses freeze presentation; caller must freeze simulation time too. Paused cancel
// clears preparation immediately; active weather requires a dissipate snapshot.
// Main preloads all textures. setManifest({version:1,clips:{cloudBuild:{role:'cloud',
//   frames:[{key,frame?,root:{x,y,unit:'pixels'|'normalized'}}],durationMs:3000,
//   playback:'once'|'loop'|'hold',scale,offset:{x,y},blend:'NORMAL'|'ADD',depth?}}}).
// Roots/scale always describe actual assets: no assumed sheet sizes or enlarged water clouds.
// Slots: prepareStart/Weave/Pressure/Lock/Ready/Cancel; sealInner/Middle/Outer;
// cloudBuild/Sustain/Dissipate; rainBuild/Sustain/Dissipate; groundRain;
// cloudFlash; lightning; wetGround. Cloud/rain/lightning roles must match their slot.
// Outputs: lights<=6/2, cloudShadow, ambientFactor, audioMix (no sound playback),
// cameraHint (no camera mutation), ready, beat, diagnostics, missingAssets,
// visualStatus:'assets-present-unreviewed'|'non-final-missing-main-assets', budgets.
// Procedural lines below are secondary ring controls, warning and cloud-shadow only.
// Source API: phaserjs/phaser v3.90.0 Graphics.js, TextureManager.js, Origin.js, FX.js.

const TAU = Math.PI * 2;
const phases = new Set(['prepare', 'ready', 'build', 'sustain', 'dissipate', 'cancelled', 'ended']);
const weather = new Set(['build', 'sustain', 'dissipate']);
const roles = { prepareStart: 'preparation', prepareWeave: 'preparation', preparePressure: 'preparation',
  prepareLock: 'preparation', prepareReady: 'preparation', prepareCancel: 'preparation',
  sealInner: 'seal', sealMiddle: 'seal', sealOuter: 'seal', cloudBuild: 'cloud', cloudSustain: 'cloud',
  cloudDissipate: 'cloud', rainBuild: 'rain', rainSustain: 'rain', rainDissipate: 'rain',
  groundRain: 'ground', wetGround: 'ground', cloudFlash: 'lightning', lightning: 'lightning' };
const finite = Number.isFinite;
const point = p => p && finite(p.x) && finite(p.y);
const num = (n, fallback = 0) => finite(n) ? n : fallback;
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = (n) => { n = clamp(n); return n * n * (3 - 2 * n); };
const array = (v, count) => Array.isArray(v) ? v.slice(-count).filter(v => v && typeof v === 'object') : [];
const copy = value => structuredClone(value);
const mix = () => ({ chant: 0, flow: 0, pressure: 0, wind: 0, rain: 0, ambience: 1 });
let sealTextureSerial = 0;
const RUNE_SIZE = 256;
export const AIR_SEAL_COLORS = Object.freeze([0xff655a, 0x65bfff, 0xffd36a]);
export function colorAirSealPixels(data, layer) {
  if (layer === 1) return data;
  const color = AIR_SEAL_COLORS[layer];
  if (color === undefined) throw new RangeError('Air seal layer must be 0..2');
  const channels = [color >>> 16, color >>> 8 & 255, color & 255];
  for (let i = 0; i < data.length; i += 4) {
    const brightness = Math.max(data[i], data[i + 1], data[i + 2]) / 255;
    for (let k = 0; k < 3; k++) data[i + k] = Math.round(channels[k] * brightness);
  }
  return data;
}
const SEAL_ALPHA_LUT = Uint8ClampedArray.from({ length: 256 }, (_, alpha) =>
  alpha <= 32 ? 0 : Math.round(255 * ((alpha - 32) / 223) ** 0.7));

// Remove low-alpha haze and raise existing rune cores, never dilate or paint symbols.
export function clarifySealPixels(data) {
  for (let i = 3; i < data.length; i += 4) {
    data[i] = SEAL_ALPHA_LUT[data[i]];
    if (!data[i]) { data[i - 3] = 0; data[i - 2] = 0; data[i - 1] = 0; }
  }
  return data;
}

// Bitmap LOD: retain the source's primary rim and selected large medallions only.
// Max coverage sampling thickens retained SOURCE ink to survive a subpixel footprint.
export function readableSealPixels(data, width, height, layer, radiusX = 1, radiusY = 1) {
  if (data.length !== width * height * 4) throw new TypeError('Seal pixels require actual RGBA dimensions');
  const original = new Uint8ClampedArray(data), count = width * height;
  const ink = new Uint8Array(count), horizontal = new Int32Array(count);
  const medallions = [[0, -0.76], [0, 0.65], [-0.65, -0.42], [0.65, -0.42], [-0.63, 0.37], [0.63, 0.37]];
  const symbols = layer === 0 ? [] : medallions.slice(0, layer === 1 ? 2 : 6);
  const rx = clamp(Math.ceil(radiusX), 1, 10), ry = clamp(Math.ceil(radiusY), 1, 10);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, p = i * 4;
    const u = (x + 0.5 - width / 2) / (width * 0.46875), v = (y + 0.5 - height / 2) / (height * 0.46875);
    const r = Math.hypot(u, v);
    const selected = r >= 0.91 && r <= 1.025 || symbols.some(([sx, sy]) => Math.hypot(u - sx, v - sy) <= 0.185);
    if (selected && original[p + 3] >= 96 && original[p] + original[p + 1] + original[p + 2] >= 565) ink[i] = original[p + 3];
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let best = y * width + x;
    for (let xx = Math.max(0, x - rx); xx <= Math.min(width - 1, x + rx); xx++) {
      const i = y * width + xx; if (ink[i] > ink[best]) best = i;
    }
    horizontal[y * width + x] = best;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let best = horizontal[y * width + x];
    for (let yy = Math.max(0, y - ry); yy <= Math.min(height - 1, y + ry); yy++) {
      const i = horizontal[yy * width + x]; if (ink[i] > ink[best]) best = i;
    }
    const p = (y * width + x) * 4, src = best * 4;
    for (let k = 0; k < 3; k++) data[p + k] = ink[best] ? original[src + k] : 0;
    data[p + 3] = ink[best];
  }
  return data;
}

export function sealRunePhase(ageMs, layer) {
  const t = Math.max(0, (ageMs - 2000) / 1000), u = clamp((t - 6) / 2);
  const slowedIntegral = t <= 6 ? 0 : t < 8 ? 2 * (u ** 3 - 0.5 * u ** 4) : t - 7;
  return [1.2, -0.95, 0.72][layer] * (t - 0.65 * slowedIntegral);
}

export const MAJOR_SEAL_ASSET = Object.freeze({ key: 'majorSeal11',
  path: new URL('../assets/arcane-seal-11.png', import.meta.url).href });

export function preloadMajorSeal(scene) {
  if (!scene.textures.exists(MAJOR_SEAL_ASSET.key)) scene.load.image(MAJOR_SEAL_ASSET.key, MAJOR_SEAL_ASSET.path);
}

export function createSealOnlyManifest({ key = 'majorSeal11', root = { x: 0.5, y: 0.5, unit: 'normalized' },
  scales = [0.036, 0.052, 0.068], sourceWidth = 1024,
  bounds = { x: 0, y: 0, width: 1024, height: 1024 } } = {}) {
  return { version: 1, clips: Object.fromEntries(['sealInner', 'sealMiddle', 'sealOuter'].map((slot, i) =>
    [slot, { role: 'seal', frames: [{ key, root: { ...root } }], durationMs: 12000,
      playback: 'hold', scale: scales[i], blend: 'NORMAL',
      frontPlane: { squash: 0.42, sourceWidth, bounds: { ...bounds },
        readabilityLOD: false, rejectedSource: key === 'majorSeal' } }])) };
}

// Main applies baseZoom * factor, never multiplies the previous frame's zoom.
export function sealCameraPush(ageMs, caster, target, camera) {
  if (!point(caster) || !point(target)) return null;
  const progression = 0.025 * smooth(ageMs / 2000) + 0.035 * smooth((ageMs - 2000) / 3000) +
    0.035 * smooth((ageMs - 5000) / 3000) + 0.025 * smooth((ageMs - 8000) / 2000);
  const view = camera?.worldView;
  let fit = 1.12;
  if (view && finite(view.width) && finite(view.height) && view.width > 0 && view.height > 0) {
    fit = Math.min(fit, view.width / (Math.abs(caster.x - target.x) + 128),
      view.height / (Math.abs(caster.y - target.y) + 128));
  }
  return { factor: Math.min(1 + progression, Math.max(1, fit)), maxFactor: 1.12,
    focus: { x: (caster.x + target.x) / 2, y: (caster.y + target.y) / 2 },
    retainPoints: [{ x: caster.x, y: caster.y }, { x: target.x, y: target.y }] };
}

export function majorSpellEnvelope(phase, ageMs) {
  const t = Math.max(0, num(ageMs));
  const e = { beat: phase, ready: false, coreAlpha: 0, coreScale: 1, rings: [0, 0, 0],
    reveal: [0, 0, 0], spin: [0, 0, 0], cloud: 0, rain: 0, ambientFactor: 1, audioMix: mix() };
  if (phase === 'prepare' || phase === 'ready') {
    const a = smooth(t / 2000), b = smooth((t - 2000) / 3000), c = smooth((t - 5000) / 3000);
    const lock = smooth((t - 8000) / 2000), quiet = t >= 11700 && t < 12000;
    e.beat = t < 2000 ? 'start' : t < 5000 ? 'weave' : t < 8000 ? 'load' : t < 10000 ? 'compress' : quiet ? 'quiet' : t < 12000 ? 'lock' : 'ready';
    e.ready = t >= 12000;
    e.coreAlpha = quiet ? 0.38 : 0.24 + a * 0.18 + b * 0.18 + lock * 0.13;
    e.coreScale = 1 - lock * 0.1;
    e.rings = [a * (0.28 - c * 0.12), b * (0.27 - lock * 0.12), c * 0.24];
    if (quiet || e.ready) e.rings = e.rings.map(v => v * 0.55);
    e.reveal = [a, b, c];
    e.spin = [0.16 * (1 - lock), -0.11 * (1 - lock), 0.07 * (1 - lock)];
    e.audioMix = { chant: 0.75, flow: quiet ? 0.12 : 0.15 + b * 0.45,
      pressure: quiet ? 0.15 : c * 0.7, wind: 0, rain: 0, ambience: lock ? 0.7 : 1 };
  } else if (weather.has(phase)) {
    const build = phase === 'build';
    const fade = phase === 'dissipate' ? 1 - smooth(t / 3000) : 1;
    e.cloud = (build ? smooth(t / 3000) : 1) * fade;
    e.rain = (build ? smooth((t - 1500) / 1500) * 0.4 : 1) * fade;
    e.ambientFactor = 1 - e.cloud * 0.32;
    e.audioMix = { chant: 0, flow: 0, pressure: 0, wind: e.cloud * 0.7,
      rain: e.rain * 0.85, ambience: 1 - e.cloud * 0.25 };
  } else if (phase === 'cancelled') {
    const fade = 1 - smooth(t / 350);
    e.coreAlpha = fade * 0.4; e.rings = [fade * 0.15, fade * 0.1, 0]; e.reveal = [1, 1, 0];
    e.audioMix.flow = fade * 0.2;
  }
  return e;
}

export function normalizeMajorManifest(manifest = { version: 1, clips: {} }) {
  if (manifest?.version !== 1 || !manifest.clips || typeof manifest.clips !== 'object' || Array.isArray(manifest.clips)) throw new TypeError('Major manifest requires version:1, clips:{}');
  const clips = new Map();
  for (const [slot, c] of Object.entries(manifest.clips)) {
    if (!roles[slot] || !c || c.role !== roles[slot] || !Array.isArray(c.frames) || !c.frames.length || c.frames.length > 256 ||
      !finite(c.durationMs) || c.durationMs <= 0 || !finite(c.scale) || c.scale <= 0 ||
      !['once', 'hold', 'loop'].includes(c.playback) || !['NORMAL', 'ADD'].includes(c.blend ?? 'NORMAL') ||
      c.offset !== undefined && !point(c.offset) || c.depth !== undefined && !finite(c.depth)) throw new TypeError(`Invalid major clip ${slot}`);
    if (c.frontPlane && (!(finite(c.frontPlane.squash) && c.frontPlane.squash > 0 && c.frontPlane.squash <= 1) ||
      !finite(c.frontPlane.sourceWidth) || c.frontPlane.sourceWidth <= 0 || !point(c.frontPlane.bounds) ||
      !finite(c.frontPlane.bounds.width) || c.frontPlane.bounds.width <= 0 ||
      !finite(c.frontPlane.bounds.height) || c.frontPlane.bounds.height <= 0)) throw new TypeError(`Invalid front plane ${slot}`);
    const frames = c.frames.map(f => {
      if (!f || typeof f.key !== 'string' || !f.key || f.frame !== undefined && !(typeof f.frame === 'string' || Number.isSafeInteger(f.frame)) ||
        !point(f.root) || !['pixels', 'normalized'].includes(f.root.unit)) throw new TypeError(`Invalid ${slot} frame/root`);
      if (['cloud', 'rain', 'lightning'].includes(c.role) && /(?:waterflight|waterformation|waterimpact|waterfx)/i.test(f.key)) throw new TypeError(`Water-ball asset cannot supply ${slot}`);
      return Object.freeze({ key: f.key, frame: f.frame, root: Object.freeze({ ...f.root }) });
    });
    clips.set(slot, Object.freeze({ ...c, frames: Object.freeze(frames), offset: Object.freeze({ x: num(c.offset?.x), y: num(c.offset?.y) }) }));
  }
  return clips;
}

export class MajorSpellRenderer {
  constructor(scene, manifest, options = {}) {
    if (!scene?.add?.image || !scene.add.graphics || !scene.textures?.exists || !scene.textures.getFrame) throw new TypeError('MajorSpellRenderer requires Phaser image/graphics/textures');
    this.sealOnly = options.sealOnly !== false;
    this.clips = normalizeMajorManifest(manifest ?? createSealOnlyManifest());
    this.scene = scene;
    this.maxInstances = clamp(Number.isSafeInteger(options.maxInstances) ? options.maxInstances : 24, 1, 24);
    this.lowInstances = clamp(Number.isSafeInteger(options.lowInstances) ? options.lowInstances : 12, 1, this.maxInstances);
    this.pool = []; this.seen = new Set(); this.strikes = new Map(); this.sources = new Map();
    this.runeTextures = new Map();
    this.sampledTextures = new WeakSet();
    this.textureBytes = 0; this.castId = null; this.spellId = null; this.releaseMs = null; this.cancelMs = null; this.lastTime = null;
    this.stopRequested = false;
    this.saved = null; this.lastOutput = null; this.destroyed = false;
    const modes = globalThis.Phaser?.BlendModes ?? { NORMAL: 0, ADD: 1 };
    this.warning = scene.add.graphics().setDepth(5).setBlendMode(modes.NORMAL);
    this.shadow = scene.add.graphics().setDepth(4).setBlendMode(modes.NORMAL);
    this.rings = scene.add.graphics().setDepth(6).setBlendMode(modes.ADD);
    this.staffSeal = scene.add.graphics().setDepth(1800).setBlendMode(modes.ADD);
  }

  setManifest(manifest) {
    if (this.destroyed) throw new Error('MajorSpellRenderer destroyed');
    const clips = normalizeMajorManifest(manifest);
    this.reset(); this.disposeRuneTextures(); this.clips = clips; this.sources.clear(); this.textureBytes = 0;
  }

  reset() {
    for (const image of this.pool) image.setVisible(false);
    this.warning.clear(); this.shadow.clear(); this.rings.clear(); this.staffSeal.clear();
    this.seen.clear(); this.strikes.clear(); this.castId = null; this.spellId = null; this.releaseMs = null; this.cancelMs = null;
    this.saved = null; this.lastOutput = null; this.lastTime = null;
    this.stopRequested = false;
  }

  output() {
    return { phase: 'ended', beat: 'ended', ready: false, paused: false, active: 0, lights: [], shake: 0, flash: 0,
      ambientFactor: 1, cloudShadow: null, audioMix: mix(), cameraHint: null, cameraPush: null, needsDissipate: false,
      mode: this.sealOnly ? 'seal-only' : 'weather-candidate', releaseVisualReady: false,
      sealLayers: [],
      missingAssets: [], diagnostics: [], visualStatus: 'non-final-missing-main-assets',
      budgets: { allocatedImages: this.pool.length, textureBytes: this.textureBytes, textureLimitBytes: 32 * 1024 * 1024 } };
  }

  events(events, spell, time, out) {
    for (const e of array(events, 128)) {
      if (e.castId !== spell.castId || e.spellId !== undefined && e.spellId !== spell.id ||
        !finite(e.timeMs) || e.timeMs > time || typeof e.id !== 'string' || !e.id || this.seen.has(e.id)) continue;
      this.seen.add(e.id); if (this.seen.size > 128) this.seen.delete(this.seen.values().next().value);
      if (['release', 'released'].includes(e.type)) {
        if (e.timeMs - spell.prepareStartMs >= 12000 && this.cancelMs === null) this.releaseMs ??= e.timeMs;
        else out.diagnostics.push('release-before-12s-or-after-cancel');
      } else if (e.type === 'cancel' || e.type === 'interrupt') {
        if (this.releaseMs === null) this.cancelMs ??= e.timeMs;
        else { out.needsDissipate = true; this.stopRequested = true; }
      } else if (['lightning', 'hit'].includes(e.type) && this.releaseMs !== null && point(e) && e.timeMs >= this.releaseMs) {
        if (time - e.timeMs < 400) {
          this.strikes.set(e.id, { ...e });
          if (this.strikes.size > 6) this.strikes.delete(this.strikes.keys().next().value);
        }
      }
    }
  }

  runeFrame(slot, f, projection, plane, out) {
    const phase = plane.phase;
    const cacheId = JSON.stringify([slot, f.key, f.frame]);
    let entry = this.runeTextures.get(cacheId);
    if (!entry) {
      const sourceFrame = this.scene.textures.getFrame(f.key, f.frame);
      this.bitmapSampling(f.key, sourceFrame, out);
      const source = sourceFrame?.source?.image;
      if (!source || !this.scene.textures.createCanvas) {
        out.diagnostics.push('seal-rune-raster-animation-unavailable'); return null;
      }
      const originalSource = sourceFrame.source;
      if (!this.sources.has(originalSource)) {
        const w = originalSource.width ?? source.width, h = originalSource.height ?? source.height;
        if (!finite(w) || !finite(h) || w <= 0 || h <= 0) {
          out.diagnostics.push('seal-rune-source-size-unknown'); return null;
        }
        const bytes = w * h * 4;
        if (this.textureBytes + bytes > 32 * 1024 * 1024) {
          out.diagnostics.push('seal-rune-texture-budget'); return null;
        }
        this.sources.set(originalSource, bytes); this.textureBytes += bytes;
      }
      if (this.textureBytes + 2 * RUNE_SIZE * RUNE_SIZE * 4 > 32 * 1024 * 1024) {
        out.diagnostics.push('seal-rune-texture-budget'); return null;
      }
      const key = `major-seal-runes-${++sealTextureSerial}`;
      const texture = this.scene.textures.createCanvas(key, RUNE_SIZE, RUNE_SIZE);
      texture.add(0, 0, 0, 0, RUNE_SIZE, RUNE_SIZE);
      const lodKey = `${key}-source-lod`;
      const lodTexture = this.scene.textures.createCanvas(lodKey, RUNE_SIZE, RUNE_SIZE);
      lodTexture.add(0, 0, 0, 0, RUNE_SIZE, RUNE_SIZE);
      this.bitmapSampling(lodKey, this.scene.textures.getFrame(lodKey, 0), out);
      const lodSource = this.scene.textures.getFrame(lodKey, 0)?.source;
      if (lodSource) { this.sources.set(lodSource, RUNE_SIZE * RUNE_SIZE * 4); this.textureBytes += RUNE_SIZE * RUNE_SIZE * 4; }
      entry = { key, texture, source, lodKey, lodTexture, profile: null, phase: null };
      this.runeTextures.set(cacheId, entry);
    }
    const rx = clamp(Math.ceil(0.55 * RUNE_SIZE / Math.max(1, plane.screenWidth)), 1, 10);
    const ry = clamp(Math.ceil(0.55 * RUNE_SIZE / Math.max(1, plane.screenHeight)), 1, 10);
    const profile = projection.readabilityLOD === true ? `${plane.layer}:${rx}:${ry}` : 'native-complete-art';
    if (entry.profile !== profile) {
      const ctx = entry.lodTexture.getContext(), b = projection.bounds;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, RUNE_SIZE, RUNE_SIZE);
      ctx.drawImage(entry.source, b.x, b.y, b.width, b.height, 8, 8, 240, 240);
      // New authored coarse symbols stay complete: no mask, dilation or alpha rewrite.
      if (projection.readabilityLOD === true || plane.layer !== 1) {
        const pixels = ctx.getImageData(0, 0, RUNE_SIZE, RUNE_SIZE);
        if (projection.readabilityLOD === true) {
          clarifySealPixels(pixels.data);
          readableSealPixels(pixels.data, RUNE_SIZE, RUNE_SIZE, plane.layer, rx, ry);
        }
        colorAirSealPixels(pixels.data, plane.layer);
        ctx.putImageData(pixels, 0, 0);
      }
      entry.lodTexture.refresh();
      entry.profile = profile; entry.phase = null;
    }
    if (entry.phase !== phase) {
      const ctx = entry.texture.getContext();
      // Continuous material rotation reuses the LOD; no per-frame image readback.
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, RUNE_SIZE, RUNE_SIZE); ctx.save();
      ctx.translate(RUNE_SIZE / 2, RUNE_SIZE / 2); ctx.rotate(phase);
      ctx.drawImage(entry.lodTexture.getContext().canvas, -128, -128);
      ctx.restore();
      entry.texture.refresh(); entry.phase = phase;
    }
    return { key: entry.key, frame: 0, root: { x: 0.5, y: 0.5, unit: 'normalized' } };
  }

  disposeRuneTextures() {
    for (const entry of this.runeTextures.values()) {
      this.scene.textures.remove(entry.key); this.scene.textures.remove(entry.lodKey);
    }
    this.runeTextures.clear();
  }

  bitmapSampling(key, frame, out) {
    const texture = this.scene.textures.get?.(key) ?? frame?.texture;
    if (!texture || typeof texture.setFilter !== 'function') {
      out.diagnostics.push('seal-linear-sampling-unavailable'); return;
    }
    if (!this.sampledTextures.has(texture)) {
      // Phaser Texture.setFilter returns undefined; never chain it with add/getFrame.
      texture.setFilter(globalThis.Phaser?.Textures?.FilterMode?.LINEAR ?? 0);
      this.sampledTextures.add(texture);
    }
  }

  frame(slot, ageMs, pos, opacity, out, rotation = 0, scaleFactor = 1, plane = null) {
    const c = this.clips.get(slot);
    if (!c) { this.missing.add(slot); return false; }
    if (opacity <= 0.001 || this.used >= this.limit || !point(pos)) return false;
    const age = Math.max(0, ageMs);
    if (c.playback === 'once' && age >= c.durationMs) return false;
    const t = c.playback === 'loop' ? age % c.durationMs : Math.min(age, c.durationMs - 0.001);
    const index = Math.min(c.frames.length - 1, Math.floor(t / c.durationMs * c.frames.length));
    let f = c.frames[index];
    const projection = plane && c.frontPlane;
    if (projection && c.frames.length === 1 && this.scene.textures.exists(f.key)) {
      const zoom = this.zoom ?? 1;
      const screenHeight = c.scale * scaleFactor * projection.sourceWidth * zoom;
      f = this.runeFrame(slot, f, projection, { ...plane, screenWidth: screenHeight * projection.squash, screenHeight }, out) ?? f;
    }
    const actual = this.scene.textures.exists(f.key) ? this.scene.textures.getFrame(f.key, f.frame) : null;
    if (!actual) { this.missing.add(`${slot}:${f.key}:${f.frame ?? '__BASE'}`); return false; }
    this.bitmapSampling(f.key, actual, out);
    const w = actual.realWidth ?? actual.width, h = actual.realHeight ?? actual.height;
    if (!finite(w) || w <= 0 || !finite(h) || h <= 0) { this.missing.add(`${slot}:dimensions`); return false; }
    const source = actual.source;
    if (source && !this.sources.has(source)) {
      const sw = source.width ?? source.image?.width, sh = source.height ?? source.image?.height;
      if (finite(sw) && finite(sh) && sw > 0 && sh > 0) {
        const bytes = sw * sh * 4;
        if (this.textureBytes + bytes > 32 * 1024 * 1024) { this.missing.add(`${slot}:texture-budget`); return false; }
        this.sources.set(source, bytes); this.textureBytes += bytes;
      } else out.diagnostics.push(`${slot}:texture-source-size-unknown`);
    } else if (!source) out.diagnostics.push(`${slot}:texture-source-size-unknown`);
    const x = pos.x + c.offset.x, y = pos.y + c.offset.y;
    const margin = Math.max(w, h) * c.scale * scaleFactor;
    const view = this.view;
    if (view && (x + margin < view.x || x - margin > view.x + view.width || y + margin < view.y || y - margin > view.y + view.height)) return false;
    let image = this.pool[this.used];
    if (!image) { image = this.scene.add.image(0, 0, f.key, f.frame); this.pool.push(image); }
    this.used++;
    const root = f.root, modes = globalThis.Phaser?.BlendModes ?? { NORMAL: 0, ADD: 1 };
    const scale = c.scale * scaleFactor * (projection ? projection.sourceWidth / w : 1);
    image.setTexture(f.key, f.frame).setOrigin(root.unit === 'pixels' ? root.x / w : root.x,
      root.unit === 'pixels' ? root.y / h : root.y).setScale(scale * (plane ? projection?.squash ?? 0.42 : 1), scale).setPosition(x, y)
      .setAlpha(clamp(opacity)).setRotation(rotation).setBlendMode(modes[c.blend ?? 'NORMAL'])
      .setDepth(c.depth ?? (plane ? y + 1800 : c.role === 'ground' || c.role === 'seal' ? 6 : y + 1800)).setVisible(true);
    return true;
  }

  arc(g, x, y, r, start, fraction, alpha, squash = 1) {
    if (fraction <= 0 || alpha <= 0) return;
    g.lineStyle(1.4, 0x9ecddc, clamp(alpha)); g.beginPath();
    const count = this.low ? 20 : 40;
    for (let i = 0; i <= count; i++) {
      const a = start + fraction * TAU * i / count, xx = x + Math.cos(a) * r, yy = y + Math.sin(a) * r * squash;
      if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
    }
    g.strokePath();
  }

  drawShadow(center, strength, time, radius) {
    // Low-cost ground mask only, not a procedural substitute for Meowa cloud volume.
    for (let j = 0; j < (this.low ? 3 : 6); j++) {
      const drift = Math.sin(time / 5000 + j) * radius * 0.03;
      this.shadow.fillStyle(0x172331, strength * 0.05); this.shadow.beginPath();
      for (let k = 0; k <= 12; k++) {
        const a = k / 12 * TAU, r = radius * (0.64 + j * 0.035) * (1 + Math.sin(a * 3 + j) * 0.1);
        const x = center.x + Math.cos(a) * r + drift, y = center.y + Math.sin(a) * r;
        if (!k) this.shadow.moveTo(x, y); else this.shadow.lineTo(x, y);
      }
      this.shadow.closePath(); this.shadow.fillPath();
    }
  }

  update(input = {}) {
    let out = this.output();
    if (this.destroyed) return out;
    if (!input || !finite(input.timeMs) || input.timeMs < 0) { this.reset(); out.diagnostics.push('invalid-simulation-time'); return out; }
    const time = input.timeMs;
    const s = input.spell;
    const waterShaping = this.sealOnly && s?.id === 'water-shaping';
    if (!s || s.id !== 'cumulonimbus' && !waterShaping || typeof s.castId !== 'string' || !s.castId || !phases.has(s.phase) ||
      !finite(s.prepareStartMs) || !finite(s.phaseStartMs) || s.prepareStartMs > time || s.phaseStartMs > time || !point(s)) {
      this.reset(); if (s) out.diagnostics.push('invalid-major-spell-snapshot'); return out;
    }
    if (waterShaping && (weather.has(s.phase) || finite(s.releasedMs))) {
      this.reset(); out.diagnostics.push('water-shaping-cannot-enter-weather'); return out;
    }
    if (this.castId !== s.castId || this.spellId !== s.id || this.lastTime !== null && time < this.lastTime) {
      this.reset(); this.castId = s.castId; this.spellId = s.id;
    }
    if (s.phase === 'ended') { this.reset(); return out; }
    if (input.paused && this.lastOutput) {
      const cancels = array(input.events, 128).some(e => e.castId === s.castId && ['cancel', 'interrupt'].includes(e.type));
      if (cancels && this.releaseMs === null) {
        const cancelledAt = this.lastTime;
        this.reset(); this.castId = s.castId; this.spellId = s.id; this.cancelMs = cancelledAt; this.lastTime = cancelledAt;
        out.paused = true; out.phase = 'cancelled'; this.lastOutput = copy(out); return out;
      }
      out = copy(this.lastOutput); out.paused = true; out.shake = 0; out.flash = 0;
      out.audioMix = { ...mix(), ambience: 0 };
      if (cancels && this.releaseMs !== null) { out.needsDissipate = true; this.stopRequested = true; }
      return out;
    }
    if (input.paused) { this.reset(); out.paused = true; return out; }
    if (finite(s.releasedMs) && s.releasedMs <= time && this.releaseMs === null && this.cancelMs === null) {
      if (s.releasedMs - s.prepareStartMs >= 12000) this.releaseMs = s.releasedMs;
      else out.diagnostics.push('weather-released-before-12s');
    }
    if (waterShaping && array(input.events, 128).some(e => e.castId === s.castId &&
      ['release', 'released', 'lightning', 'hit'].includes(e.type))) out.diagnostics.push('water-shaping-weather-events-rejected');
    this.events(waterShaping ? array(input.events, 128).filter(e => ['cancel', 'interrupt'].includes(e.type)) : input.events, s, time, out);
    out.needsDissipate = this.stopRequested && s.phase !== 'dissipate';
    let phase = s.phase;
    if (this.cancelMs !== null && !weather.has(phase)) phase = 'cancelled';
    if (weather.has(phase) && this.releaseMs === null) { phase = 'prepare'; out.diagnostics.push('weather-without-authoritative-release'); }
    if (s.phase === 'ended') { this.reset(); return out; }
    const age = phase === 'cancelled' ? time - (this.cancelMs ?? s.phaseStartMs) :
      phase === 'prepare' || phase === 'ready' ? time - s.prepareStartMs : time - s.phaseStartMs;
    const e = majorSpellEnvelope(phase, phase === 'dissipate' && finite(s.durationMs) && s.durationMs > 0 ? age * 3000 / s.durationMs : age);
    const layerAge = this.sealOnly && finite(s.stageElapsedMs) && (phase === 'prepare' || phase === 'ready') ? s.stageElapsedMs + 2000 : age;
    if (this.sealOnly && (phase === 'prepare' || phase === 'ready')) {
      const revealStarts = waterShaping ? [2000, 3000, 4000] : [2000, 4500, 7000];
      const revealDuration = waterShaping ? 2000 : 2500;
      e.reveal = revealStarts.map(start => smooth((layerAge - start) / revealDuration));
      const lock = smooth((layerAge - 9500) / 2200), quiet = age >= 11700 && age < 12000;
      e.rings = e.reveal.map((v, j) => v * [1, 0.97, 0.94][j] * (0.86 - lock * 0.06) * (quiet ? 0.85 : 1));
    }
    out.phase = phase; out.beat = e.beat; out.ready = e.ready; out.ambientFactor = e.ambientFactor; out.audioMix = e.audioMix;
    this.low = input.quality === 'low'; this.limit = this.low ? this.lowInstances : this.maxInstances;
    this.zoom = clamp(num(input.camera?.zoom, 1), 0.1, 4);
    this.used = 0; this.missing = new Set();
    const view = input.camera?.worldView ?? input.camera;
    this.view = point(view) && finite(view.width) && finite(view.height) && view.width > 0 && view.height > 0 ? view : null;
    this.warning.clear(); this.shadow.clear(); this.rings.clear(); this.staffSeal.clear();
    const radius = clamp(num(s.radius, 280), 40, 600), center = { x: s.x, y: s.y };
    const caster = point(input.caster) ? input.caster : null;
    const staff = point(caster?.actualStaffAnchor) ? caster.actualStaffAnchor : point(caster?.staff) ? caster.staff : null;
    const aim = point(caster?.aim) && Math.hypot(caster.aim.x, caster.aim.y) > 1e-6 ? caster.aim : null;
    const aimAngle = aim ? Math.atan2(aim.y, aim.x) : 0;
    if (phase !== 'cancelled' && !this.sealOnly) this.arc(this.warning, center.x, center.y, radius, 0, 1, 0.55);
    if (phase === 'prepare' || phase === 'ready' || phase === 'cancelled') {
      const slot = phase === 'cancelled' ? 'prepareCancel' : age < 2000 ? 'prepareStart' : age < 5000 ? 'prepareWeave' :
        age < 8000 ? 'preparePressure' : age < 12000 ? 'prepareLock' : 'prepareReady';
      if (!this.sealOnly) {
        if (staff) this.frame(slot, phase === 'cancelled' ? age : age - (slot === 'prepareWeave' ? 2000 : slot === 'preparePressure' ? 5000 : slot === 'prepareLock' ? 8000 : slot === 'prepareReady' ? 12000 : 0), staff, e.coreAlpha, out);
        else { this.missing.add(slot); out.diagnostics.push('staff-anchor-required'); }
      }
      if (caster && (!this.sealOnly || staff && aim)) for (let j = 0; j < 3; j++) {
        const lock = smooth((layerAge - 8000) / 2000);
        const runePhase = sealRunePhase(layerAge, j);
        const spin = this.sealOnly ? aimAngle : age / 1000 * e.spin[j];
        const distance = [12, 30, 50][j];
        const position = this.sealOnly ? { x: staff.x + Math.cos(aimAngle) * distance,
          y: staff.y + Math.sin(aimAngle) * distance } : caster;
        const size = this.sealOnly ? 0.72 + 0.28 * e.reveal[j] - 0.13 * lock : 1;
        const drawn = this.frame(['sealInner', 'sealMiddle', 'sealOuter'][j], this.sealOnly ?
          (runePhase % TAU + TAU) % TAU / TAU * this.clips.get(['sealInner', 'sealMiddle', 'sealOuter'][j])?.durationMs : age, position,
          e.rings[j], out, spin, size, this.sealOnly ? { phase: runePhase, layer: j } : null);
        if (this.sealOnly) out.sealLayers.push({ ...position, index: j, color: AIR_SEAL_COLORS[j], reveal: e.reveal[j], distance, normalAngle: aimAngle, runePhase, visible: drawn });
        if (!drawn && !this.sealOnly) this.arc(this.rings, caster.x, caster.y, 28 + j * 16, spin, e.reveal[j], e.rings[j] * 0.55, 0.65);
      }
      if (this.sealOnly && (!staff || !aim)) out.diagnostics.push('staff-and-aim-required');
      if (staff && !this.sealOnly) {
        const aim = point(caster?.aim) ? caster.aim : { x: 1, y: 0 };
        const angle = Math.atan2(aim.y, aim.x), x = staff.x + Math.cos(angle) * 8, y = staff.y + Math.sin(angle) * 8;
        // Small elliptical formula plane, never a filled horizontal water body.
        const reveal = Math.max(e.reveal[0], e.reveal[1]);
        this.arc(this.staffSeal, x, y, 10, age / 6000, reveal, e.coreAlpha * 0.5, 0.5);
        this.arc(this.staffSeal, x, y, 14, -age / 8000, e.reveal[1], e.coreAlpha * 0.28, 0.5);
      }
      if (staff && e.coreAlpha > 0) out.lights.push({ x: staff.x, y: staff.y, radius: 90, color: 0x83cbdc, intensity: e.coreAlpha * 0.45 });
      if (caster) out.cameraHint = { x: caster.x * 0.65 + center.x * 0.35, y: caster.y * 0.65 + center.y * 0.35, strength: 0.15 };
      if (phase !== 'cancelled') out.cameraPush = sealCameraPush(age, caster, center, input.camera);
    } else if (!this.sealOnly) {
      const suffix = phase[0].toUpperCase() + phase.slice(1);
      this.frame(`cloud${suffix}`, age, center, e.cloud * 0.82, out);
      this.frame(`rain${suffix}`, age, center, e.rain * (this.low ? 0.4 : 0.6), out);
      this.frame('groundRain', age, center, e.rain * 0.5, out);
      if (phase === 'dissipate') this.frame('wetGround', age, center, 0.3 + e.rain * 0.15, out);
      out.cloudShadow = { x: center.x, y: center.y, radius, strength: e.cloud * 0.25, driftX: Math.sin(time / 5000) * 8 };
      this.drawShadow(center, e.cloud, time, radius);
      for (const [id, strike] of this.strikes) {
        const elapsed = time - strike.timeMs;
        if (elapsed >= 400) { this.strikes.delete(id); continue; }
        const fade = clamp(1 - elapsed / 350);
        this.frame('lightning', elapsed, strike, fade, out);
        this.frame('cloudFlash', elapsed, center, fade * 0.25, out);
        if (out.lights.length < (this.low ? 2 : 6)) out.lights.push({ x: strike.x, y: strike.y, radius: 100, color: 0xc3dcff, intensity: fade * 0.65 });
        out.flash = Math.max(out.flash, 0.04 * clamp(1 - elapsed / 80));
        out.shake = Math.max(out.shake, 0.005 * clamp(1 - elapsed / 140));
      }
    }
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].setVisible(false);
    // Always report unfinished main assets, even before their phase becomes visible.
    if (this.sealOnly) {
      if (!waterShaping) out.missingAssets.push('formal-release-bitmap');
      out.ambientFactor = 1;
      if (weather.has(phase)) { out.audioMix = mix(); out.diagnostics.push('weather-authority-preserved-release-visual-unavailable'); }
    }
    for (const slot of this.sealOnly ? ['sealInner', 'sealMiddle', 'sealOuter'] : ['prepareStart', 'prepareWeave', 'preparePressure', 'prepareLock', 'prepareReady',
      'cloudBuild', 'cloudSustain', 'cloudDissipate', 'rainBuild', 'rainSustain', 'rainDissipate', 'groundRain', 'lightning']) {
      const clip = this.clips.get(slot);
      if (!clip) this.missing.add(slot);
      else {
        if (this.sealOnly && clip.frontPlane?.rejectedSource) this.missing.add(`${slot}:rejected-source`);
        for (const f of clip.frames) if (!this.scene.textures.exists(f.key) || !this.scene.textures.getFrame(f.key, f.frame)) this.missing.add(`${slot}:${f.key}:${f.frame ?? '__BASE'}`);
      }
    }
    out.active = this.used; out.missingAssets.push(...this.missing);
    out.visualStatus = out.missingAssets.length ? 'non-final-missing-main-assets' : 'assets-present-unreviewed';
    out.diagnostics = [...new Set(out.diagnostics)];
    out.budgets = { ...out.budgets, allocatedImages: this.pool.length, textureBytes: this.textureBytes,
      runtimeRuneBytes: this.runeTextures.size * 2 * RUNE_SIZE * RUNE_SIZE * 4 };
    this.lastTime = time; this.saved = copy(s); this.lastOutput = copy(out);
    return out;
  }

  destroy() {
    if (this.destroyed) return;
    this.reset();
    for (const image of this.pool) image.destroy();
    this.disposeRuneTextures();
    this.warning.destroy(); this.shadow.destroy(); this.rings.destroy(); this.staffSeal.destroy();
    this.pool.length = 0; this.sources.clear(); this.clips.clear(); this.scene = null; this.destroyed = true;
  }
}
