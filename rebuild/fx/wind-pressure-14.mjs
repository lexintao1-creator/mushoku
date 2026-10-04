// Approximate 2.5D streamlines, not CFD. Reverse circulation is imposed magic,
// not the same-direction viscous entrainment of an ordinary rotating solid.
// Caller: cone age = main elapsed - 6000; array 1.8..6s, cone 6..12s.
export const WIND_PRESSURE_MANIFEST = Object.freeze({ version: 2, mode: 'curves' });
export function preloadWindPressure() { return WIND_PRESSURE_MANIFEST; }
const STREAMS = 14, TAU = Math.PI * 2;
export const WIND_PRESSURE_LAYOUT = Object.freeze(Array.from({ length: STREAMS }, (_, s) =>
  s < 2 || s === 4 ? 96 : s === 2 || s === 5 || s === 8 ? 64 : 32));
export const WIND_PRESSURE_OFFSETS = Object.freeze(WIND_PRESSURE_LAYOUT.map((_, s) =>
  WIND_PRESSURE_LAYOUT.slice(0, s).reduce((sum, count) => sum + count, 0)));
const CENTERS = WIND_PRESSURE_LAYOUT.reduce((sum, count) => sum + count, 0);
const FLOWS = Object.freeze([
  [180, -5, 90, 1, 1.9, 0], [-160, -45, -100, 0.97, 1.7, 1],
  [80, 115, 78, 0.91, 1.1, 0], [-150, 85, -35, 1.04, 1.2, 0],
  [-25, 130, 12, 0.96, 0.8, 1], [-60, -98, -42, 0.88, 1.1, 0],
  [115, -85, 45, 1.03, 1.1, 0], [-44, -78, -100, 1, 0.75, 1],
  [35, 65, 25, 0.84, 1, 0], [-95, 70, -30, 0.92, 1.2, 0],
  [180, -5, 90, 1, 0.6, 0], [-160, -45, -100, 0.97, 0.65, 1],
  [12, 28, -18, 0.92, 0.9, 0], [-5, -16, -11, 0.7, 0.65, 0]
].map(Object.freeze));
const finite = Number.isFinite;
const point = p => p && finite(p.x) && finite(p.y);
const clamp = v => Math.max(0, Math.min(1, v));
const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
// Rounded-up alpha>=200 column envelope of all 16 water-spear-10 frames,
// over formation scales .35..1; five-world-unit bins, PNG d53a4ef4...ca6.
const CONE_ENVELOPE = Object.freeze([1.7, 3, 4, 5.2, 6.5, 7.8, 9.1, 10.4, 11.6, 11.7, 0, 0]);
function coneEnvelope(along) {
  const t = Math.max(0, along / 5), i = Math.min(11, Math.floor(t));
  const a = Math.max(CONE_ENVELOPE[Math.max(0, i - 1)], CONE_ENVELOPE[i], CONE_ENVELOPE[Math.min(11, i + 1)]);
  const b = Math.max(CONE_ENVELOPE[i], CONE_ENVELOPE[Math.min(11, i + 1)], CONE_ENVELOPE[Math.min(11, i + 2)]);
  return mix(a, b, smooth(t - i));
}
const streamParameter = (sample, main, count) => {
  const t = sample / (count - 1);
  return main ? Math.pow(t, 1.6) : t;
};
// A smooth bounding cylinder avoids following alpha-profile bin shoulders
// into sharp radius changes. The cone narrows inside this airflow shell.
const frontRadius = (along, zoom) => Math.max(18, 11.7 + 3 + 3.25 / zoom) * smooth(along / 8);
export function windPhase(ageMs) {
  const t = ageMs / 1000, r = Math.min(t, 6);
  return TAU * (0.55 * r + 0.075 * r * r + Math.max(0, t - 6) * 1.45);
}
// Integral of shared axial speed, including the .82..1 smooth expansion ramp.
export function windTravel(ageMs) {
  const t = Math.min(ageMs / 1000, 6), a = 4.92, span = 1.08;
  const x = clamp((t - a) / span);
  const ramp = (0.55 + 0.15 * a) * span * (x ** 3 - 0.5 * x ** 4)
    + 0.15 * span * span * (0.75 * x ** 4 - 0.4 * x ** 5);
  return 20 * (0.55 * t + 0.075 * t * t) + 170 * ramp + Math.max(0, ageMs / 1000 - 6) * 275.5;
}
function packet(arc, head, span) {
  const distance = head - arc;
  return distance < 0 ? smooth(1 + distance / 5) : smooth(1 - distance / span);
}
// Three fixed emission trains, advected in world arc space, not texture scroll.
function fieldPacket(arc, head, span) {
  return Math.max(packet(arc, head, span), packet(arc, (head + 760 / 3) % 760, span),
    packet(arc, (head + 1520 / 3) % 760, span));
}
function shellBrush(u, stream) {
  const start = stream === 2 ? 0.08 : stream === 5 ? 0.32 : 0.62;
  const end = stream === 2 ? 0.48 : stream === 5 ? 0.79 : 0.91;
  return smooth((u - start) / 0.12) * smooth((end - u) / 0.18);
}
export class WindPressureRenderer {
  constructor(scene, _legacyManifest, options = {}) {
    if (!scene?.add?.graphics) throw new TypeError('Wind requires Phaser Graphics');
    this.scene = scene; this.pool = [scene.add.graphics(), scene.add.graphics()];
    for (const key of ['x', 'y', 'axial', 'radial', 'orbit', 'orbitDepth', 'arcLength', 'transportArc', 'normalX', 'normalY', 'parameters']) this[key] = new Float64Array(CENTERS);
    this.flowState = Array.from({ length: STREAMS }, (_, stream) => ({ stream, localCycle: 0, fullCycle: 0,
      localHeadTransportArc: 0, fullHeadTransportArc: 0, localPeriod: 120, fullPeriod: 760, localSpan: 0, fullSpan: 0,
      localSeed: 0, fullSeed: 0, timeMs: 0,
      fullVisible: false, fullHeadX: 0, fullHeadY: 0, fullHeadArcLength: 0 }));
    this.frontAlpha = clamp(finite(options.frontAlpha) ? options.frontAlpha : 0.62);
    this.backAlpha = clamp(finite(options.backAlpha) ? options.backAlpha : 0.46);
    this.destroyed = false;
    this.output = { mode: 'curves', active: 0, allocated: 2, stage: null, frame: null, phase: 0, fieldBlend: 0, travel: 0,
      byLayer: { back: 0, front: 0 }, missingTextures: [], diagnostics: [],
      budget: { graphicsLimit: 3, graphics: 2, imageLimit: 0, decodedBytes: 0,
        points: CENTERS, pointLimit: CENTERS, streams: STREAMS, samplesPerStream: WIND_PRESSURE_LAYOUT, scalarBufferBytes: CENTERS * 11 * 8,
        textureLimitBytes: 0, exceedsTextureBudget: false, scope: '736-centers-curvature-weighted-fixed-buffers-no-textures' } };
    this.hide();
  }
  hide() {
    for (const g of this.pool) g.clear().setVisible(false);
    this.output.active = 0; this.output.byLayer.back = this.output.byLayer.front = 0;
  }
  reset() { this.hide(); }
  setManifest() { if (this.destroyed) throw new Error('Wind renderer destroyed'); this.hide(); }
  update(input) {
    const out = this.output; out.stage = null; out.diagnostics.length = 0;
    if (this.destroyed) { out.diagnostics.push('wind-renderer-destroyed'); return out; }
    this.hide();
    if (!input || input.holding !== true || input.paused || input.cancelled || input.released) return out;
    if (!finite(input.timeMs) || input.timeMs < 0 || !finite(input.ageMs) || input.ageMs < 0 ||
      !finite(input.progress) || !point(input.tip) || !point(input.aim) || Math.hypot(input.aim.x, input.aim.y) < 1e-6 ||
      !finite(input.depth?.back) || !finite(input.depth?.front) || input.depth.back >= input.depth.front) {
      out.diagnostics.push('wind-authoritative-snapshot-required'); return out;
    }
    const p = clamp(input.progress); if (!p) return out;
    const blend = smooth((p - 0.82) / 0.18), phase = windPhase(input.ageMs), travel = windTravel(input.ageMs);
    // Pressure expansion emphasizes axial transport rather than frantic near-tip whipping.
    const rotationPhase = phase - TAU * 0.6 * (travel - 20 * phase / TAU) / 170;
    out.phase = phase; out.fieldBlend = blend; out.travel = travel; out.stage = p >= 1 ? 'full' : 'pre';
    const magnitude = Math.hypot(input.aim.x, input.aim.y);
    const hx = -input.aim.x / magnitude, hy = -input.aim.y / magnitude, nx = -hy, ny = hx;
    const z = this.scene.cameras?.main?.zoom, zoom = finite(z) && z > 0 ? z : 1;
    this.pool[0].setDepth(input.depth.back).setVisible(true); this.pool[1].setDepth(input.depth.front).setVisible(true);
    for (let s = 0; s < STREAMS; s++) {
      const side = s % 2 ? -1 : 1, flow = FLOWS[s], base = WIND_PRESSURE_OFFSETS[s], count = WIND_PRESSURE_LAYOUT[s];
      const main = s < 2 || s === 4;
      const pressureMain = main || s === 12;
      const shell = s === 2 || s === 5 || s === 8;
      const outerShell = s === 8, fieldOrbit = !shell;
      const fieldLength = shell ? 52 : 320 * flow[3], cylinderRadius = 12 + s % 3;
      const direction = input.coneSpinDirection === -1 ? -1 : 1;
      const localRate = outerShell ? 0.72 * (12 / 14) ** 2 : s === 3 || s === 7 ? 0.55 : (12 / cylinderRadius) ** 2;
      const localOffset = outerShell ? Math.PI : s === 3 || s === 7 ? (s === 3 ? 0 : Math.PI)
        : shell ? (s - 2) / 3 * TAU / 3 : s * 0.91;
      const fullOffset = s === 0 ? 0 : s === 1 ? TAU / 3 : s === 4 ? 2 * TAU / 3
        : s === 12 ? Math.PI / 3 : s === 10 ? 0 : s === 11 ? TAU / 3 : localOffset;
      // The entire field rotates about the cast axis, not in the screen plane.
      // Shared angular velocity and pitch avoid rotating endpoint derivatives.
      const localAngleOffset = -direction * rotationPhase * localRate + localOffset;
      const fullAngleOffset = -direction * rotationPhase * (pressureMain || s === 10 || s === 11 ? 0.7 : 0.5) + fullOffset;
      for (let j = 0; j < count; j++) {
        const u = streamParameter(j, main, count), i = base + j;
        this.parameters[i] = u;
        const start = s < 2 ? 3 : 4 + s % 4 * 3;
        const end = s < 2 ? 51 : Math.min(52, start + 30 + s % 3 * 5);
        const fullAlong = fieldLength * u;
        const along = mix(mix(start, end, u), fullAlong, blend);
        const localAlong = mix(start, end, u);
        const radius = Math.max(8 + (s < 2 ? 10 : 6 + s % 3) * Math.pow(Math.sin(Math.PI * u), 0.8),
          coneEnvelope(localAlong) + 3 + 2 / zoom) * (outerShell ? 1.45 : 1);
        // Shared circulation at each streamline's representative cylinder radius.
        // Do not accumulate different angular rates along one arc into a jagged rope.
        const localAngle = localAngleOffset + u * TAU * 0.82;
        const fullAngle = shell ? localAngle : fullAngleOffset + u * TAU * 0.35;
        const angle = shell ? localAngle : mix(localAngle, fullAngle, blend);
        const rFront = shell ? Math.max(radius, coneEnvelope(fullAlong) + 3 + 3.5 / zoom) * smooth(u / 0.04)
          : frontRadius(fullAlong, zoom);
        const spread = pressureMain ? (s === 12 ? 52 : 82) : 58;
        const orbitRadius = fieldOrbit ? rFront + spread * Math.sin(Math.PI * u) * smooth(fullAlong / 72)
          + 32 * smooth((u - 0.65) / 0.35) : 0;
        const fullRadius = shell ? rFront : orbitRadius;
        const projectedRadius = mix(radius, fullRadius, blend);
        const raw = projectedRadius * Math.sin(angle);
        const seal = smooth((along - 42) / 12) * (1 - smooth((along - 114) / 20));
        const avoidance = shell ? 0 : seal * smooth(blend / 0.2) * (1 - blend) ** 2 * smooth((along - 40) / 24);
        const across = mix(raw, side * Math.hypot(raw, 27), avoidance)
          + (s === 10 || s === 11 ? blend * 0.5 / zoom * Math.sin(Math.PI * u) : 0);
        this.axial[i] = along; this.radial[i] = across; this.orbit[i] = angle;
        this.orbitDepth[i] = projectedRadius * Math.cos(angle);
        this.x[i] = input.tip.x + hx * along + nx * across; this.y[i] = input.tip.y + hy * along + ny * across;
        if (!j) { this.arcLength[i] = 0; this.transportArc[i] = 0; }
        else {
          const ds = Math.hypot(this.x[i] - this.x[i - 1], this.y[i] - this.y[i - 1]);
          this.arcLength[i] = this.arcLength[i - 1] + ds;
          // Larger cross-section slows transport; narrowing accelerates it.
          this.transportArc[i] = this.transportArc[i - 1] + ds * (1 + blend * Math.abs(across) / 150);
        }
      }
      for (let j = 0; j < count; j++) {
        const i = base + j, before = base + Math.max(0, j - 1), after = base + Math.min(count - 1, j + 1);
        const dx = this.x[after] - this.x[before], dy = this.y[after] - this.y[before], length = Math.hypot(dx, dy);
        this.normalX[i] = length > 1e-7 ? -dy / length : 0; this.normalY[i] = length > 1e-7 ? dx / length : 0;
      }
      // Fixed transport cycles: changing curve length must never renormalize a
      // previously emitted crest. Local and field families crossfade, not reset.
      const localSpan = shell ? 28 : s < 2 ? 24 : 14, fullSpan = shell ? 28 : pressureMain ? 100 : 45;
      const offset = s === 1 || s === 11 ? 1 / 3 : s === 4 ? 2 / 3 : 0;
      const localEmission = travel + s * 23, fullEmission = travel + (main || s === 10 || s === 11 ? 760 * offset : s * 23);
      const localHead = localEmission % 120, fullHead = shell ? localHead : fullEmission % 760;
      const flowState = this.flowState[s];
      flowState.localCycle = Math.floor(localEmission / 120); flowState.fullCycle = Math.floor((shell ? localEmission : fullEmission) / (shell ? 120 : 760));
      flowState.fullPeriod = shell ? 120 : 760;
      flowState.localHeadTransportArc = localHead; flowState.fullHeadTransportArc = fullHead;
      flowState.localSpan = localSpan; flowState.fullSpan = fullSpan;
      flowState.localSeed = s * 23; flowState.fullSeed = shell ? s * 23 : main || s === 10 || s === 11 ? 760 * offset : s * 23;
      flowState.timeMs = input.timeMs;
      flowState.fullVisible = fullHead <= this.transportArc[base + count - 1];
      flowState.fullHeadX = flowState.fullHeadY = flowState.fullHeadArcLength = 0;
      if (flowState.fullVisible) for (let j = 1; j < count; j++) {
        const i = base + j; if (this.transportArc[i] < fullHead) continue;
        const fraction = clamp((fullHead - this.transportArc[i - 1]) / Math.max(1e-7, this.transportArc[i] - this.transportArc[i - 1]));
        flowState.fullHeadX = mix(this.x[i - 1], this.x[i], fraction); flowState.fullHeadY = mix(this.y[i - 1], this.y[i], fraction);
        flowState.fullHeadArcLength = mix(this.arcLength[i - 1], this.arcLength[i], fraction); break;
      }
      // Two readable local layers only. Retain the unused shell's geometry and
      // transport contract, but do not add a third visible knot around the cone.
      if (s === 5) continue;
      for (let j = 0; j < count - 1; j++) {
        const i = base + j, u = this.parameters[i], v = this.parameters[i + 1];
        const pulseA = mix(packet(this.transportArc[i], localHead, localSpan), shell ? packet(this.transportArc[i], fullHead, fullSpan)
          : fieldPacket(this.transportArc[i], fullHead, fullSpan), blend);
        const pulseB = mix(packet(this.transportArc[i + 1], localHead, localSpan), shell ? packet(this.transportArc[i + 1], fullHead, fullSpan)
          : fieldPacket(this.transportArc[i + 1], fullHead, fullSpan), blend);
        const pulse = (pulseA + pulseB) * 0.5;
        const shellA = 1 - smooth((320 * u * flow[3] - 28) / 32);
        const shellB = 1 - smooth((320 * v * flow[3] - 28) / 32);
        // Keep the lower shoulders legible between crests, without adding glow.
        // The cone shell has a narrower peak so layered arcs do not form a knot.
        const fieldCore = outerShell ? 1.9 : shell ? 2.6 : pressureMain ? (s === 0 ? 2.4 : 3.2) : 1.1;
        const fieldCoreA = pressureMain ? mix(fieldCore, 2.8, shellA) : fieldCore;
        const fieldCoreB = pressureMain ? mix(fieldCore, 2.8, shellB) : fieldCore;
        const peakA = outerShell ? 0.9 : shell ? 1.3 : pressureMain ? mix(6.5, 5, shellA) - fieldCoreA : 0.4;
        const peakB = outerShell ? 0.9 : shell ? 1.3 : pressureMain ? mix(6.5, 5, shellB) - fieldCoreB : 0.4;
        const coreA = mix(outerShell ? 1.9 : shell ? 2.6 : s < 2 ? 2 : 0.8, fieldCoreA, blend)
          + pulseA * mix(shell ? 0.8 : s < 2 ? 2 : 0.3, peakA, blend);
        const coreB = mix(outerShell ? 1.9 : shell ? 2.6 : s < 2 ? 2 : 0.8, fieldCoreB, blend)
          + pulseB * mix(shell ? 0.8 : s < 2 ? 2 : 0.3, peakB, blend);
        const ta = shell ? shellBrush(u, s) : mix(Math.pow(Math.sin(Math.PI * u), 0.45), smooth(u / 0.025) * smooth((1 - u) / 0.3), blend);
        const tb = shell ? shellBrush(v, s) : mix(Math.pow(Math.sin(Math.PI * v), 0.45), smooth(v / 0.025) * smooth((1 - v) / 0.3), blend);
        // Thin connections between broad moving crests keep a continuous flow,
        // without restoring the uniformly wide C-shaped outline.
        const ribbonA = shell ? 1 : mix(1, Math.max(0.28 + 0.72 * Math.sqrt(pulseA), pressureMain ? 1.4 / coreA : 0), blend);
        const ribbonB = shell ? 1 : mix(1, Math.max(0.28 + 0.72 * Math.sqrt(pulseB), pressureMain ? 1.4 / coreB : 0), blend);
        const a = coreA / zoom * ta * ribbonA, b = coreB / zoom * tb * ribbonB;
        const fieldBase = shell ? 0.8 : pressureMain ? 0.34 : 0;
        const intensity = mix(shell ? 0.65 : main ? 0.12 : 0.025, fieldBase, blend)
          + Math.sqrt(pulse) * (shell ? 0.3 : pressureMain ? 1 : 1.05);
        const orbitalNear = smooth(0.5 + 0.5 * Math.cos((this.orbit[i] + this.orbit[i + 1]) * 0.5));
        const near = shell || fieldOrbit ? orbitalNear : mix(orbitalNear, flow[5], blend);
        const seal = smooth((this.axial[i] - 48) / 12) * (1 - smooth((this.axial[i] - 114) / 12));
        const margin = smooth((Math.min(Math.abs(this.radial[i]), Math.abs(this.radial[i + 1])) - 24) / 8);
        // Let the three local crescents carry the tip pressure. Long streams
        // attach gradually at their shoulders instead of a bright shared knot.
        const attachment = shell ? 1 : mix(1, smooth(((this.axial[i] + this.axial[i + 1]) * 0.5 - 24) / 40), blend);
        const fade = (1 - seal * blend * (s >= 12 ? 0.85 : 0.05)) * attachment;
        for (let layer = 0; layer < 2; layer++) {
          const weight = layer ? near : 1 - near; if (weight < 1e-7) continue;
          const localAlpha = (shell ? 0.95 : s < 2 ? 0.9 : s < 6 ? 0.45 : 0.16) * smooth(p / 0.82);
          const fullAlpha = pressureMain || shell ? 0.95 : s < 6 ? 0.7 : (layer ? this.frontAlpha : this.backAlpha);
          const actorZone = smooth((this.axial[i] - 124) / 12) * (1 - smooth((this.axial[i] - 184) / 16));
          const actorMargin = smooth((Math.min(Math.abs(this.radial[i]), Math.abs(this.radial[i + 1])) - 20) / 14);
          const glyphFade = layer ? (1 - seal * (1 - margin) * blend) * (1 - actorZone * (1 - actorMargin) * blend) : 1;
          const density = outerShell ? 0.45 : shell ? 1 : blend * (pressureMain ? 1 : 0.42);
          const alpha = mix(localAlpha, fullAlpha, blend) * weight * fade * glyphFade * density;
          const accent = s === 10 || s === 11;
          const dark = accent ? blend : 0, g = this.pool[layer];
          if (dark) this.band(g, i, a, b, 0x17242c, pulse * 0.3 * dark * weight);
          if (!accent) this.band(g, i, a + ta * 1.4 / zoom, b + tb * 1.4 / zoom, 0x8ee5fa,
            mix(alpha * 0.18, 0.075 * weight * glyphFade * attachment * density, blend)
              * mix(intensity, shell ? intensity : Math.min(intensity, 0.16 + Math.sqrt(pulse)), blend) * (1 - dark));
          const blue = !pressureMain && !shell && !fieldOrbit && s >= 2 && s < 10 && s % 3 !== 0 ? blend : 0;
          if (!accent) this.band(g, i, a, b, 0xf3fdff, clamp(alpha * intensity * (1 - blue) * (1 - dark)));
          if (blue) this.band(g, i, a, b, 0xb9eaff, clamp(alpha * intensity * blue));
        }
      }
    }
    out.active = 2; out.byLayer.back = out.byLayer.front = 1; return out;
  }
  band(g, i, a, b, color, alpha) {
    if (alpha <= 1e-7) return;
    const ax = this.x[i], ay = this.y[i], bx = this.x[i + 1], by = this.y[i + 1];
    const d = Math.hypot(bx - ax, by - ay); if (d < 1e-6) return;
    const px = this.normalX[i] * 0.5, py = this.normalY[i] * 0.5;
    const qx = this.normalX[i + 1] * 0.5, qy = this.normalY[i + 1] * 0.5;
    g.fillStyle(color, alpha);
    g.fillTriangle(ax + px * a, ay + py * a, ax - px * a, ay - py * a, bx + qx * b, by + qy * b);
    g.fillTriangle(ax - px * a, ay - py * a, bx - qx * b, by - qy * b, bx + qx * b, by + qy * b);
  }
  destroy() {
    if (this.destroyed) return;
    for (const g of this.pool) g.destroy(); this.pool.length = 0; this.scene = null; this.destroyed = true;
    this.output.active = this.output.allocated = this.output.budget.graphics = 0;
    this.output.byLayer.back = this.output.byLayer.front = 0;
  }
}
