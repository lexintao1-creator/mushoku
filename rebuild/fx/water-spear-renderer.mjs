// Bitmap water only. Main retains arcane groundSeal/lens and suppresses old pressure body.
// new WaterSpearRenderer(scene, manifest?, {maxInstances:24,lowInstances:12}).
// update({timeMs,caster:{x,y,staff|staffTip|actualStaffAnchor},channel:{startMs?,
//   origin?,direction:{x,y},progress?,skillId?},shots,splashes,quality?}) -> {lights,...}.
// channel.origin is the old actualStaffAnchor fallback; no guessed hand/foot offset.
// shots use projected DISPLAY xy, dx/dy, id|castId, ageMs|age|life (old life is elapsed ms).
// Main should hand off formation tip as projection.visualOrigin on release, while keeping
// collision groundOrigin unchanged. We never move shots or generate release/hit events.
// splashes require eventId|impactId|id|startId, or castId + eventIndex/eventindex.
// Pause hides all bitmaps/lights; contacts/consumed IDs survive. Resume uses SIM age,
// never restarts impacts. Main must freeze simulation time to freeze their age.
// Recent IDs expire at effect end and are bounded by oldest-first eviction.
// Retired IDs rely on authoritative age: expired events are rejected before dedupe.
// Active contacts/rings also dedupe even if their recent ID was evicted.
// Main completes the array before loading the cone at hold age 6000ms.
// Main maps stageElapsedMs=holdElapsedMs-6000; 6000ms of forming completes at 12s.
// Without explicit mapping, the same six-second gate applies. Short taps stay legacy.
// Explicit stage time owns formation progress; otherwise channel.progress then legacy age.
// Front plane layers sit +12/+30/+50; cone tail>=+65 and bright tip+115.
// shots require bitmapWater:true, charged:true or power>1; bitmapWater:false always wins.
// Optional shot.formationScale preserves partial held size (0.35..1; default 1).
// Material frame flow conveys axial rotation; sprite rotation only follows aim, not spin.
// Narrow charge airflow streams backward from the tip along the fixed cone axis.
// Optional releases: {eventId|castId, x,y, direction, ageMs, charged:true}.
// Existing main can use shot.castId + shot.projection.visualOrigin instead.
// New Meowa spear animation is shared by formation/flight, not the previous water sphere.

const finite = Number.isFinite;
const point = p => p && finite(p.x) && finite(p.y);
const number = (v, fallback = 0) => finite(v) ? v : fallback;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const list = (v, max) => Array.isArray(v) ? v.slice(-max).filter(p => p && typeof p === 'object') : [];
const direction = (p) => {
  if (!point(p) || Math.hypot(p.x, p.y) < 1e-6) return null;
  const length = Math.hypot(p.x, p.y); return { x: p.x / length, y: p.y / length };
};
const keyId = v => typeof v === 'string' && v.length > 0 && v.length <= 256 || Number.isSafeInteger(v);
const impactId = s => {
  const id = [s.eventId, s.impactId, s.id, s.startId].find(keyId);
  if (id !== undefined) return JSON.stringify(['event', id]);
  const index = s.eventIndex ?? s.eventindex;
  return keyId(s.castId) && Number.isSafeInteger(index) && index >= 0 ? JSON.stringify(['cast', s.castId, index]) : null;
};
const frames = (sheet, key) => sheet.roots.map((root, frame) => ({ key, frame, root: { ...root } }));

// Read-only measurement: alpha>200, RGB sum>570, tip column >=3 bright pixels;
// y averages the final five columns. This excludes soft fringes and isolated sparks.
export const WATER_SPEAR_ROOTS = Object.freeze([
  [602, 340], [602, 339], [598, 340], [602, 341],
  [602, 340], [606, 339], [601, 340], [598, 339],
  [599, 338], [596, 339], [602, 340], [603, 339],
  [603, 339], [600, 339], [598, 339], [598, 339]
].map(([x, y]) => Object.freeze({ x, y, unit: 'pixels' })));

// Measured left flash cores (alpha > 80, RGB sum > 660). Last fading frame
// keeps the preceding contact axis because its flash is no longer measurable.
export const WATER_PRESSURE_ROOTS = Object.freeze([
  [82, 149], [68, 149], [63, 149], [59, 150],
  [61, 148], [54, 145], [56, 145], [56, 145],
  [57, 145], [56, 145], [57, 145], [57, 146],
  [57, 145], [56, 145], [55, 145], [57, 145]
].map(([x, y]) => Object.freeze({ x, y, unit: 'pixels' })));

export const WATER_SPEAR_ASSETS = Object.freeze({
  flight: Object.freeze({ key: 'meowaWaterSpear10', url: new URL('../assets/water-spear-10.png', import.meta.url).href,
    frameWidth: 640, frameHeight: 640, startFrame: 0, endFrame: 15, decodedBytes: 2560 * 2560 * 4 }),
  impact: Object.freeze({ key: 'meowaWaterPressure12', url: new URL('../assets/water-pressure-12/impact.png', import.meta.url).href,
    frameWidth: 256, frameHeight: 256, startFrame: 0, endFrame: 15, decodedBytes: 1024 * 1024 * 4 }),
  airflow: Object.freeze({ key: 'waterChargeAir12', url: new URL('../assets/water-pressure-12/airflow.png', import.meta.url).href,
    frameWidth: 128, frameHeight: 128, startFrame: 0, endFrame: 15, decodedBytes: 512 * 512 * 4 }),
  release: Object.freeze({ key: 'waterSonicRing12', url: new URL('../assets/water-pressure-12/sonic-ring.png', import.meta.url).href,
    frameWidth: 256, frameHeight: 256, startFrame: 0, endFrame: 0, decodedBytes: 256 * 256 * 4 })
});

export function preloadWaterSpear(scene, { flightKey = WATER_SPEAR_ASSETS.flight.key, impactKey = WATER_SPEAR_ASSETS.impact.key } = {}) {
  if (!scene?.load?.spritesheet) throw new TypeError('Water spear preload requires spritesheet loader');
  for (const [stage, key] of [['flight', flightKey], ['impact', impactKey], ['airflow', WATER_SPEAR_ASSETS.airflow.key], ['release', WATER_SPEAR_ASSETS.release.key]]) {
    const a = WATER_SPEAR_ASSETS[stage];
    scene.load.spritesheet(key, a.url, { frameWidth: a.frameWidth, frameHeight: a.frameHeight,
      startFrame: a.startFrame, endFrame: a.endFrame });
  }
}

export function createWaterSpearManifest({ flightKey = WATER_SPEAR_ASSETS.flight.key, impactKey = WATER_SPEAR_ASSETS.impact.key } = {}) {
  return { version: 1,
    formation: { frames: frames({ roots: WATER_SPEAR_ROOTS }, flightKey), loopMs: 800, formDurationMs: 6000, materialSpeed: 0.7, materialEndSpeed: 3.4, ringDistance: 7,
      tailGap: 58, tipDistance: 115, sourceLeft: 4, candidate: false },
    flight: { frames: frames({ roots: WATER_SPEAR_ROOTS }, flightKey), loopMs: 800,
      scale: (115 - 7 - 58) / Math.max(...WATER_SPEAR_ROOTS.map(root => root.x - 4)) },
    impact: { frames: frames({ roots: WATER_PRESSURE_ROOTS }, impactKey), durationMs: 1200, scale: 160 / 256 },
    airflow: { frames: frames({ roots: Array.from({ length: 16 }, () => ({ x: 116, y: 64, unit: 'pixels' })) }, WATER_SPEAR_ASSETS.airflow.key), loopMs: 1100, scale: 1 },
    release: { frames: [{ key: WATER_SPEAR_ASSETS.release.key, frame: 0, root: { x: 128, y: 128, unit: 'pixels' } }], durationMs: 760, scale: 1 }
  };
}

function normalize(manifest) {
  if (manifest?.version !== 1) throw new TypeError('Water spear manifest version must be 1');
  const result = {};
  for (const stage of ['formation', 'flight', 'impact', 'airflow', 'release']) {
    const c = manifest[stage];
    if (!c && (stage === 'airflow' || stage === 'release')) continue;
    const once = stage === 'impact' || stage === 'release';
    if (!c || !Array.isArray(c.frames) || !c.frames.length || c.frames.length > 256 ||
      !finite(once ? c.durationMs : c.loopMs) || (once ? c.durationMs : c.loopMs) <= 0) throw new TypeError(`Invalid ${stage} frames/timing`);
    const checked = c.frames.map(f => {
      if (!f || typeof f.key !== 'string' || !f.key || f.frame !== undefined && !(typeof f.frame === 'string' || Number.isSafeInteger(f.frame)) ||
        !point(f.root) || f.root.unit !== 'pixels') throw new TypeError(`${stage} requires actual pixel frame roots`);
      return Object.freeze({ key: f.key, frame: f.frame, root: Object.freeze({ ...f.root }) });
    });
    if (stage === 'formation') {
      if (!finite(c.ringDistance) || c.ringDistance < 0 || !finite(c.tailGap) || c.tailGap < 12 ||
        !finite(c.tipDistance) || c.tipDistance <= c.ringDistance + c.tailGap || !finite(c.sourceLeft) || c.sourceLeft < 0 ||
        checked.some(f => f.root.x <= c.sourceLeft)) throw new TypeError('Formation requires ring, >=12world tail gap and forward tip');
      if (c.materialSpeed !== undefined && (!finite(c.materialSpeed) || c.materialSpeed <= 0)) throw new TypeError('Invalid formation material speed');
      if (c.materialEndSpeed !== undefined && (!finite(c.materialEndSpeed) || c.materialEndSpeed < number(c.materialSpeed, 0.7))) throw new TypeError('Invalid formation end speed');
      if (c.formDurationMs !== undefined && (!finite(c.formDurationMs) || c.formDurationMs <= 0)) throw new TypeError('Invalid formation duration');
    } else if (!finite(c.scale) || c.scale <= 0) throw new TypeError(`Invalid ${stage} scale`);
    result[stage] = Object.freeze({ ...c, frames: Object.freeze(checked) });
  }
  return Object.freeze(result);
}

export class WaterSpearRenderer {
  constructor(scene, manifest = createWaterSpearManifest(), options = {}) {
    if (!scene?.add?.image || !scene.textures?.exists || !scene.textures.getFrame) throw new TypeError('Water spear requires Phaser Image/TextureManager');
    this.manifest = normalize(manifest); this.scene = scene;
    this.maxInstances = clamp(Number.isSafeInteger(options.maxInstances) ? options.maxInstances : 24, 1, 24);
    this.lowInstances = clamp(Number.isSafeInteger(options.lowInstances) ? options.lowInstances : 12, 1, this.maxInstances);
    this.maxConsumed = clamp(Number.isSafeInteger(options.maxConsumed) ? options.maxConsumed : 256, 1, 1024);
    this.consumed = new Map();
    this.pool = []; this.contacts = new Map(); this.releases = new Map(); this.releaseConsumed = new Map(); this.channelStart = null; this.channelKey = null;
    this.sampledTextures = new WeakSet();
    this.lastTime = null; this.destroyed = false;
  }

  setManifest(manifest) {
    if (this.destroyed) throw new Error('Water spear renderer destroyed');
    const next = normalize(manifest); this.reset(); this.manifest = next;
  }

  reset() {
    this.contacts.clear(); this.consumed.clear(); this.releases.clear(); this.releaseConsumed.clear(); this.channelStart = null; this.channelKey = null; this.lastTime = null;
    for (const image of this.pool) image.setVisible(false);
  }

  restart() {
    if (this.destroyed) throw new Error('Water spear renderer destroyed');
    this.reset();
  }

  remember(ledger, id, expiresMs) {
    ledger.set(id, expiresMs);
    if (ledger.size > this.maxConsumed) ledger.delete(ledger.keys().next().value);
  }

  bitmap(stage, ageMs, position, angle, scale, alpha, depth, out) {
    if (alpha <= 0.001) return null;
    if (this.used >= this.limit) { out.dropped++; return null; }
    const c = this.manifest[stage];
    if (!c) return null;
    const once = stage === 'impact' || stage === 'release';
    if (once && ageMs >= c.durationMs) return null;
    const local = once ? ageMs : ageMs % c.loopMs;
    const duration = once ? c.durationMs : c.loopMs;
    const index = Math.min(c.frames.length - 1, Math.floor(Math.max(0, local) / duration * c.frames.length));
    const f = c.frames[index], actual = this.scene.textures.exists(f.key) ? this.scene.textures.getFrame(f.key, f.frame) : null;
    if (!actual) { this.missing.add(`${stage}:${f.key}:${f.frame ?? '__BASE'}`); return null; }
    const texture = this.scene.textures.get?.(f.key) ?? actual.texture;
    if (texture && typeof texture.setFilter === 'function') {
      if (!this.sampledTextures.has(texture)) {
        // Override game's pixelArt NEAREST only for these HD bitmap textures.
        texture.setFilter(globalThis.Phaser?.Textures?.FilterMode?.LINEAR ?? 0);
        this.sampledTextures.add(texture);
      }
    } else out.diagnostics.push('water-linear-sampling-unavailable');
    const w = actual.realWidth ?? actual.width, h = actual.realHeight ?? actual.height;
    if (!finite(w) || !finite(h) || w <= 0 || h <= 0) { this.missing.add(`${stage}:frame-size`); return null; }
    let image = this.pool[this.used];
    if (!image) { image = this.scene.add.image(0, 0, f.key, f.frame); this.pool.push(image); }
    this.used++;
    const normal = globalThis.Phaser?.BlendModes?.NORMAL ?? 0;
    image.setTexture(f.key, f.frame).setOrigin(f.root.x / w, f.root.y / h).setScale(scale)
      .setPosition(position.x, position.y).setRotation(angle).setDepth(depth)
      .setBlendMode(normal).setAlpha(clamp(alpha)).setVisible(true);
    out.byStage[stage]++;
    return { root: f.root, width: w, height: h, scale, frame: index };
  }

  light(out, p, radius, intensity) {
    if (out.lights.length < (this.low ? 2 : 6)) out.lights.push({ x: p.x, y: p.y, radius, color: 0x8ee9ff, intensity: clamp(intensity) });
  }

  update(input = {}) {
    const knownKeys = new Set(Object.values(this.manifest).flatMap(c => c?.frames?.map(f => f.key) ?? []));
    const knownDecodedBytes = Object.values(WATER_SPEAR_ASSETS).reduce((sum, a) => sum + (knownKeys.has(a.key) ? a.decodedBytes : 0), 0);
    const out = { lights: [], active: 0, allocated: this.pool.length, dropped: 0,
      byStage: { formation: 0, flight: 0, impact: 0, airflow: 0, release: 0 }, formation: null, anchors: null, missingTextures: [], diagnostics: [],
      paused: input?.paused === true,
      impactState: { resume: 'simulation-age-no-restart', seenPolicy: 'bounded-recent-until-effect-expiry',
        consumed: this.consumed.size, limit: this.maxConsumed, saturated: this.consumed.size >= this.maxConsumed },
      budgets: { knownDecodedBytes, textureLimitBytes: 32 * 1024 * 1024,
        knownDecodedBytesWithSeal10: knownDecodedBytes + 1024 * 1024 * 4,
        exceedsKnownTextureBudget: knownDecodedBytes > 32 * 1024 * 1024,
        scope: 'known-default-asset-estimate-not-gpu-allocation' },
      visualStatus: this.manifest.formation.candidate ? 'existing-flight-formation-candidate' : 'bitmap-assets-unreviewed' };
    if (this.destroyed) return out;
    if (!input || !finite(input.timeMs) || input.timeMs < 0) { this.reset(); out.impactState.consumed = 0; out.impactState.saturated = false; return out; }
    const time = input.timeMs;
    if (this.lastTime !== null && time < this.lastTime) this.reset();
    for (const ledger of [this.consumed, this.releaseConsumed]) {
      for (const [id, expiresMs] of ledger) if (time >= expiresMs) ledger.delete(id);
    }
    out.impactState.consumed = this.consumed.size;
    out.impactState.saturated = this.consumed.size >= this.maxConsumed;
    if (input.paused === true) {
      for (const image of this.pool) image.setVisible(false);
      if (!input.channel || input.channel.shaping === false) { this.channelKey = null; this.channelStart = null; }
      this.lastTime = time;
      return out;
    }
    this.low = input.quality === 'low'; this.limit = this.low ? this.lowInstances : this.maxInstances;
    this.used = 0; this.missing = new Set(); this.pendingAirflow = null;
    const caster = input.caster, channel = input.channel;
    const staff = point(caster?.actualStaffAnchor) ? caster.actualStaffAnchor : point(caster?.staff) ? caster.staff :
      point(caster?.staffTip) ? caster.staffTip : point(channel?.origin) ? channel.origin : null;
    const aim = direction(channel?.direction ?? caster?.aim);
    const preparing = channel && channel.shaping !== false && channel.bitmapWater !== false && (!channel.skillId || channel.skillId === 'water') && staff && aim;
    if (preparing) {
      const key = channel.id ?? channel.startMs ?? 'legacy-channel';
      if (this.channelKey !== key) { this.channelStart = finite(channel.startMs) ? channel.startMs : time; this.channelKey = key; }
      const age = Math.max(0, time - this.channelStart), c = this.manifest.formation;
      const stageElapsed = finite(channel.stageElapsedMs) ? channel.stageElapsedMs : age - 6000;
      if (stageElapsed >= 0) {
        const tip = { x: staff.x + aim.x * c.tipDistance, y: staff.y + aim.y * c.tipDistance };
        const ring = { x: staff.x + aim.x * c.ringDistance, y: staff.y + aim.y * c.ringDistance };
        const length = c.tipDistance - c.ringDistance - c.tailGap;
        const sourceLength = Math.max(...c.frames.map(f => f.root.x - c.sourceLeft));
        const timed = finite(channel.stageElapsedMs);
        const progress = timed ? clamp(stageElapsed / number(c.formDurationMs, 6000)) :
          finite(channel.progress) ? clamp(channel.progress) : clamp(stageElapsed / number(c.formDurationMs, 6000));
        out.formation = { progress, ready: progress >= 1,
          progressSource: timed ? 'stageElapsedMs' : finite(channel.progress) ? 'channel.progress' : 'legacy-age' };
        const scale = length / sourceLength * (0.35 + progress * 0.65);
        // Fast liquid flow loops, but the pointed axis/root never whirl around the staff.
        // Integrate speed analytically so skipped frames and pause cannot change phase.
        const duration = number(c.formDurationMs, 6000), t = Math.min(stageElapsed, duration);
        const initialSpeed = number(c.materialSpeed, 0.7), endSpeed = number(c.materialEndSpeed, initialSpeed);
        const acceleration = endSpeed - initialSpeed;
        const materialAge = initialSpeed * stageElapsed + acceleration * (t ** 3 / (3 * duration ** 2) + Math.max(0, stageElapsed - duration));
        out.formation.materialSpeed = initialSpeed + acceleration * (t / duration) ** 2;
        out.formation.materialAgeMs = materialAge;
        const alpha = (0.22 + 0.68 * progress) * clamp(stageElapsed / 800); // Slow shaping, not rhythmic full-image flash.
        const drawn = this.bitmap('formation', materialAge, tip, Math.atan2(aim.y, aim.x), scale, alpha,
          number(caster?.y, staff.y) + 0.2, out);
        const tailDistance = drawn ? c.tipDistance - (drawn.root.x - c.sourceLeft) * scale : c.ringDistance + c.tailGap;
        const tail = { x: staff.x + aim.x * tailDistance, y: staff.y + aim.y * tailDistance };
        out.anchors = { staff: { ...staff }, ring, tail, tip, tailGap: tailDistance - c.ringDistance };
        if (drawn) {
          const phase = age / 1000 * 18;
          this.light(out, tip, 28, alpha * (0.2 + Math.sin(phase) * 0.055));
          this.light(out, tail, 20, alpha * (0.13 + Math.sin(phase + 2.2) * 0.035));
        }
        this.pendingAirflow = { materialAge, tip, angle: Math.atan2(aim.y, aim.x), scale: length / 104 * (0.35 + progress * 0.65), alpha: alpha * 0.3, depth: number(caster?.y, staff.y) + 0.15 };
      }
    } else { this.channelKey = null; this.channelStart = null; }

    // Contacts are supplied by simulation, not detected or inferred from shot disappearance.
    for (const s of list(input.splashes, this.maxInstances)) {
      if (!point(s) || s.bitmapWater === false || !(s.bitmapWater === true || s.charged === true) ||
        s.skillId && s.skillId !== 'water' || s.puddle || !(s.crown || s.type === 'impact' || s.skillId === 'water')) continue;
      const age = number(s.ageMs, number(s.age, -1));
      if (age < 0 || age >= this.manifest.impact.durationMs) continue;
      const id = impactId(s);
      if (id === null) { out.diagnostics.push('impact-stable-id-required'); out.dropped++; continue; }
      if (this.consumed.has(id) || this.contacts.has(id)) continue;
      const start = time - age;
      this.remember(this.consumed, id, start + this.manifest.impact.durationMs);
      this.contacts.set(id, { ...s, start });
      if (this.contacts.size > this.maxInstances) this.contacts.delete(this.contacts.keys().next().value);
    }
    for (const [id, s] of this.contacts) {
      const age = time - s.start;
      if (age >= this.manifest.impact.durationMs) { this.contacts.delete(id); continue; }
      const ground = point(s.groundPoint) ? s.groundPoint : { x: s.x, y: number(s.groundY, s.y) };
      const impulse = direction(s.direction ?? { x: s.dx, y: s.dy });
      const impactAngle = impulse ? Math.atan2(impulse.y, impulse.x) : 0;
      if (!impulse) out.diagnostics.push('impact-forward-direction-required');
      const drawn = this.bitmap('impact', age, ground, impactAngle, this.manifest.impact.scale, 1 - clamp((age - 650) / 550), ground.y + 0.1, out);
      if (drawn && age < 180) this.light(out, ground, 55, 0.22 * (1 - age / 180));
    }
    for (const s of list(input.shots, this.maxInstances)) {
      if (!point(s) || s.bitmapWater === false || !(s.bitmapWater === true || s.charged === true || s.power > 1) || s.skillId && s.skillId !== 'water') continue;
      const aim = direction({ x: s.dx, y: s.dy });
      const age = number(s.ageMs, number(s.age, number(s.life, -1)));
      if (!aim || age < 0) continue;
      const scale = this.manifest.flight.scale * clamp(number(s.formationScale, 1), 0.35, 1);
      const drawn = this.bitmap('flight', age, s, Math.atan2(aim.y, aim.x), scale,
        0.95, number(s.groundY, s.y) + 0.1, out);
      if (drawn) this.light(out, s, 42, 0.18);
      const origin = s.releaseOrigin ?? s.projection?.visualOrigin;
      if (point(origin)) this.consumeRelease({ ...s, ...origin, ageMs: age, direction: aim }, time, out);
    }
    for (const event of list(input.releases, this.maxInstances)) this.consumeRelease(event, time, out);
    for (const [id, event] of this.releases) {
      const age = time - event.start, c = this.manifest.release;
      if (!c || age >= c.durationMs) { this.releases.delete(id); continue; }
      const p = clamp(age / c.durationMs);
      this.bitmap('release', age, event, event.angle, (40 + 240 * p) / 256 * c.scale, (1 - p) ** 2 * 0.75, event.depth, out);
    }
    const airflow = this.pendingAirflow; this.pendingAirflow = null;
    if (airflow && this.manifest.airflow) this.bitmap('airflow', airflow.materialAge, airflow.tip, airflow.angle, airflow.scale * this.manifest.airflow.scale, airflow.alpha, airflow.depth, out);
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].setVisible(false);
    out.active = this.used; out.allocated = this.pool.length; out.missingTextures = [...this.missing];
    out.diagnostics = [...new Set(out.diagnostics)];
    out.impactState.consumed = this.consumed.size;
    out.impactState.saturated = this.consumed.size >= this.maxConsumed;
    if (out.missingTextures.length) out.visualStatus = 'non-final-missing-bitmap';
    this.lastTime = time;
    return out;
  }

  consumeRelease(event, time, out) {
    const c = this.manifest.release;
    if (!c || !point(event) || event.bitmapWater === false || !(event.charged === true || event.bitmapWater === true || event.power > 1) || event.skillId && event.skillId !== 'water') return;
    const id = keyId(event.castId) ? JSON.stringify(['cast', event.castId]) : impactId(event);
    const age = number(event.ageMs, number(event.age, -1)), aim = direction(event.direction ?? { x: event.dx, y: event.dy });
    if (age >= c.durationMs) return;
    if (id === null || age < 0 || !aim) { out.diagnostics.push('release-authority-required'); return; }
    if (this.releaseConsumed.has(id) || this.releases.has(id)) return;
    this.remember(this.releaseConsumed, id, time - age + c.durationMs);
    this.releases.set(id, { x: event.x, y: event.y, start: time - age, angle: Math.atan2(aim.y, aim.x), depth: number(event.groundY, event.y) + 0.2 });
    if (this.releases.size > this.maxInstances) this.releases.delete(this.releases.keys().next().value);
  }

  destroy() {
    if (this.destroyed) return;
    this.reset(); for (const image of this.pool) image.destroy();
    this.pool.length = 0; this.scene = null; this.destroyed = true;
  }
}
