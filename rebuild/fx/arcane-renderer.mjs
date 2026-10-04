const TAU = Math.PI * 2;
const INK = Object.freeze({ deep: 0x244660, water: 0x398ca9, glass: 0x65c6d9,
  foam: 0xb5e8e9, white: 0xf0f5df, gold: 0xd5b87b, seal: 0x81bfc7 });
const number = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const active = s => valid(s) && Number.isFinite(s.life) && s.life > 0 &&
  Number.isFinite(s.age) && s.age >= 0 && s.age < s.life;
const direction = (x, y) => {
  x = number(x); y = number(y);
  const n = Math.hypot(x, y);
  return n > 0.001 ? { x: x / n, y: y / n } : { x: 1, y: 0 };
};
const xy = (x, y) => ({ x: Math.round(x), y: Math.round(y) });
const local = (o, d, u, v) => xy(o.x + d.x * u - d.y * v, o.y + d.y * u + d.x * v);

function stroke(g, points, color, alpha, width = 1, close = false) {
  g.lineStyle(width, color, clamp(alpha));
  g.beginPath(); g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  if (close) g.closePath();
  g.strokePath();
}

function fill(g, points, color, alpha) {
  g.fillStyle(color, clamp(alpha)); g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  g.closePath(); g.fillPath();
}

function sample(count, fn) {
  const points = [];
  for (let i = 0; i <= count; i++) points.push(fn(i / count));
  return points;
}

// Six authored ornamental ligatures: graphic motifs, not a canonical alphabet.
const GLYPHS = Object.freeze([
  [[-2,-3],[1,-3],[1,2],[-2,2],[-2,0],[3,0]],
  [[-2,3],[-2,-3],[2,-1],[-1,1],[2,3]],
  [[-3,-2],[0,-3],[2,-1],[0,1],[0,3],[3,3]],
  [[-2,-3],[-2,2],[2,2],[2,-2],[-1,-2],[-1,0]],
  [[-3,0],[-1,-3],[1,0],[-1,3],[3,3]],
  [[-2,3],[0,1],[-2,-1],[0,-3],[2,-1],[2,2]]
]);

function groundSeal(g, foot, progress, time, alpha, low) {
  const r = 24 + progress * 8, phase = time / 2300;
  const project = (u, v) => xy(foot.x + u, foot.y + v * 0.5);
  const ellipse = (radius, color, opacity) => stroke(g,
    sample(low ? 24 : 40, t => project(Math.cos(t * TAU) * radius,
      Math.sin(t * TAU) * radius)), color, opacity);
  ellipse(r, INK.gold, alpha * 0.72);
  ellipse(r - 3, INK.seal, alpha * 0.85);
  ellipse(r * 0.55, INK.glass, alpha * 0.68);
  const gates = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
    gates.push([[-3,-2],[-3,2],[0,5],[3,2],[3,-2],[0,0],[-3,-2]].map(([u,v]) =>
      project(ca * (r * 0.58 + v) - sa * u, sa * (r * 0.58 + v) + ca * u)));
  }
  segments(g, gates, INK.gold, alpha * 0.85);
  const ticks = low ? 12 : 24;
  const marks = [];
  for (let i = 0; i < ticks; i++) {
    const a = i * TAU / ticks;
    marks.push([project(Math.cos(a) * (r - 1), Math.sin(a) * (r - 1)),
      project(Math.cos(a) * (r - (i % 3 ? 3 : 5)), Math.sin(a) * (r - (i % 3 ? 3 : 5)))]);
  }
  // Batch disjoint engravings into one Graphics path.
  segments(g, marks, INK.gold, alpha * 0.65);
  const glyphs = [];
  for (let i = 0; i < (low ? 6 : 12); i++) {
    const a = i * TAU / (low ? 6 : 12) + phase * 0.12;
    const ca = Math.cos(a), sa = Math.sin(a), radius = r - 7;
    glyphs.push(GLYPHS[i % GLYPHS.length].map(([u, v]) =>
      project(ca * radius - sa * u + ca * v * 0.65,
        sa * radius + ca * u + sa * v * 0.65)));
  }
  segments(g, glyphs, INK.foam, alpha * 0.85);
  for (let arm = 0; arm < 2; arm++) {
    stroke(g, sample(low ? 18 : 32, t => {
      const a = t * TAU * 1.1 + (arm ? -phase : phase) + arm * Math.PI;
      const radius = 4 + t * (r * 0.52 - 4);
      return project(Math.cos(a) * radius, Math.sin(a) * radius);
    }), arm ? INK.gold : INK.glass, alpha * 0.65);
  }
  // Interleaving water lobes give the central formula a fluid identity.
  stroke(g, sample(low ? 24 : 40, t => {
    const a = t * TAU, radius = (10 + 3 * Math.sin(a * 3 + phase)) * (0.7 + progress * 0.3);
    return project(Math.cos(a) * radius, Math.sin(a) * radius);
  }), INK.foam, alpha * 0.65);
}

function segments(g, paths, color, alpha) {
  g.lineStyle(1, color, clamp(alpha)); g.beginPath();
  for (const points of paths) {
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  }
  g.strokePath();
}

function lens(g, origin, d, radius, phase, alpha, low, etched = true) {
  // Plane normal follows flight: narrow axial projection, broad transverse face.
  const project = (a, r) => local(origin, d, Math.cos(a) * r * 0.45, Math.sin(a) * r);
  for (let layer = 0; layer < (low ? 1 : 2); layer++) {
    const r = radius - layer * 3;
    stroke(g, sample(low ? 18 : 28, t => project(t * TAU, r)),
      layer ? INK.gold : INK.foam, alpha * (layer ? 0.65 : 0.9));
  }
  if (!etched) return;
  const grooves = [];
  for (let i = 0; i < (low ? 3 : 4); i++) {
    const a = phase + i * TAU / (low ? 3 : 4);
    const glyph = GLYPHS[i % GLYPHS.length];
    grooves.push(glyph.map(([u, v]) => project(a + u * 0.045, radius - 2 + v * 0.35)));
  }
  segments(g, grooves, INK.gold, alpha);
  // Four separated locking chords keep the projected seal readable around its core.
  segments(g, Array.from({length: low ? 2 : 4}, (_, i) => {
    const a = phase * 0.35 + i * Math.PI / 2;
    return [project(a - 0.18, radius * 0.72), project(a, radius * 0.62),
      project(a + 0.18, radius * 0.72)];
  }), INK.glass, alpha * 0.6);
}

function flowStrip(g, center, count, width, color, alpha) {
  const left = [], right = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count, p = center(t), before = center(Math.max(0, t - 0.02));
    const after = center(Math.min(1, t + 0.02));
    const d = direction(after.x - before.x, after.y - before.y);
    const w = width * (0.2 + Math.sin(t * Math.PI) * 0.8);
    left.push(xy(p.x - d.y * w, p.y + d.x * w));
    right.push(xy(p.x + d.y * w, p.y - d.x * w));
  }
  fill(g, left.concat(right.reverse()), color, alpha);
}

function rising(g, foot, origin, p, time, low) {
  for (let i = 0; i < (low ? 2 : 3); i++) {
    const side = i - 1, phase = time / 180 + i * 2;
    flowStrip(g, t => {
      const envelope = Math.sin(t * Math.PI);
      return { x: foot.x + (origin.x - foot.x) * t +
        (side * 12 + Math.sin(phase + t * 5) * 5) * envelope,
      y: foot.y + (origin.y - foot.y) * t - envelope * (7 + p * 4) };
    }, low ? 8 : 12, 0.7 + p * 0.5, i === 1 ? INK.foam : INK.glass, 0.35 + p * 0.3);
  }
}

function pressure(g, s, time, low, scale = 1) {
  const d = direction(s.dx, s.dy), phase = time / 85 + number(s.life) / 310;
  const power = clamp(number(s.power, 1), 1, 2);
  const size = clamp(scale, 0.35, 1.5) * (1 + (power - 1) * 0.5);
  const length = (32 + Math.sin(phase * 0.35) * 1.2) * size;
  const width = 7.5 * size, count = low ? 10 : 16;
  // A continuous water volume: rear taper, broad pressure shoulder, rounded nose.
  const radius = t => width * (0.06 + Math.sin(t * Math.PI) ** 0.65 * (0.45 + t * 0.65));
  const wobble = t => Math.sin(t * 7 - phase) * Math.sin(t * Math.PI) * 0.45 * size;
  const surface = (t, fraction) => local(s, d, -length * (1 - t),
    wobble(t) + radius(t) * fraction);
  const band = (top, bottom, color, alpha) => fill(g,
    sample(count, t => surface(t, top(t))).concat(sample(count, t => surface(t, bottom(t))).reverse()),
    color, alpha);
  for (const side of [-1, 1]) {
    const center = t => local(s, d, -length * (1.05 - t * 0.55),
      side * width * (0.35 + Math.sin(t * Math.PI) * (0.65 + Math.sin(phase) * 0.08)));
    flowStrip(g, center, low ? 5 : 7, size * 1.4, INK.water, 0.85);
    if (!low) stroke(g, sample(7, center), INK.glass, 0.85);
  }
  band(() => -1, () => 1, INK.deep, 0.94);
  band(() => -0.9, () => 0.65, INK.water, 0.96);
  // Broad refractive planes, rather than transparent strings standing in for volume.
  band(t => -0.65 + Math.sin(t * 5 - phase * 0.5) * 0.08,
    t => -0.12 + Math.sin(t * 5 - phase * 0.5) * 0.1, INK.glass, 0.72);
  if (!low) band(t => 0.1 + Math.sin(t * 6 - phase) * 0.08,
    () => 0.48, INK.deep, 0.55);
  stroke(g, sample(count, t => surface(0.27 + t * 0.73, -0.95)), INK.foam, 0.88);
  stroke(g, sample(count, t => surface(0.5 + t * 0.5, 0.98)), INK.glass, 0.75);
  fill(g, sample(low ? 6 : 10, t => surface(0.55 + t * 0.43, -0.75))
    .concat(sample(low ? 6 : 10, t => surface(0.55 + t * 0.43,
      -0.75 + Math.sin(t * Math.PI) * 0.28)).reverse()), INK.foam, 0.84);
  // Draw only the front half of each helical sheet; the core occludes its back half.
  for (let arm = 0; arm < (low ? 1 : 2); arm++) {
    let upper = [], lower = [];
    const flush = () => {
      if (upper.length > 1) fill(g, upper.concat(lower.reverse()), arm ? INK.foam : INK.glass, 0.88);
      upper = []; lower = [];
    };
    for (let i = 0; i <= count; i++) {
      const t = i / count, a = t * TAU * 1.1 - phase + arm * Math.PI;
      if (Math.cos(a) < 0) { flush(); continue; }
      const v = Math.sin(a) * radius(t) * 0.82 + wobble(t);
      const u = -length * (1 - t), half = (arm ? 0.6 : 1.0) * size;
      upper.push(local(s, d, u, v - half)); lower.push(local(s, d, u, v + half));
    }
    flush();
  }
  // A dense curved pressure shoulder joins the body and the contact-facing nose.
  const shoulder = local(s, d, -3 * size, 0);
  stroke(g, sample(low ? 6 : 10, t => local(shoulder, d,
    Math.sin(t * Math.PI) * 3 * size, (t - 0.5) * 8 * size)), INK.white, 0.9);
  const trail = Array.isArray(s.trail) ? s.trail.slice(-6).filter(valid) : [];
  if (trail.length > 1) {
    for (let side = -1; side <= 1; side += 2) {
      stroke(g, trail.map((p, i) => local(p, d, 0,
        Math.sin(phase - i * 1.3 + side) * (i / trail.length) * 3 * size)), INK.glass, 0.48);
    }
  }
}

function sparkle(g, o, alpha, scale = 1) {
  // Four narrow stepped rays; no full-screen flash or filled star plate.
  segments(g, [
    [xy(o.x - 4 * scale, o.y), xy(o.x - scale, o.y), xy(o.x, o.y - scale)],
    [xy(o.x, o.y - 5 * scale), xy(o.x, o.y - scale)],
    [xy(o.x + scale, o.y), xy(o.x + 4 * scale, o.y)],
    [xy(o.x, o.y + scale), xy(o.x, o.y + 4 * scale)]
  ], INK.white, alpha);
}

function impact(g, s, low) {
  const t = s.age / s.life, wall = s.kind === 'wall';
  const v = wall ? s.normal || s.direction : s.direction;
  const d = direction(v?.x ?? s.vx, v?.y ?? s.vy);
  const expand = Math.sin(clamp(t * 3) * Math.PI / 2), fade = (1 - t) ** 1.7;
  // The incoming volume flattens into a filled wet sheet before it splits.
  flowStrip(g, u => local(s, d, Math.sin(u * Math.PI) * (wall ? 6 : 3),
    (u - 0.5) * (wall ? 12 + expand * 20 : 8 + expand * 12)),
  low ? 6 : 10, wall ? 4.5 : 3.2, INK.water, fade * 0.94);
  if (wall) {
    for (let i = 0; i < (low ? 3 : 5); i++) {
      const lane = (i / (low ? 2 : 4) - 0.5) * 2.1;
      const reach = (9 + expand * 17) * (1 - Math.abs(lane) * 0.18);
      flowStrip(g, u => local(s, d, u * reach * Math.cos(lane),
        Math.sin(lane) * u * reach + Math.sin(u * Math.PI) * (lane < 0 ? -3 : 3)),
      low ? 6 : 10, 1.2, i % 2 ? INK.glass : INK.foam, fade);
    }
    stroke(g, sample(low ? 10 : 18, u => local(s, d,
      Math.sin(u * Math.PI) * (3 + expand * 6), (u - 0.5) * (12 + expand * 26))),
    INK.white, fade * 0.8);
  } else {
    // The flesh front buckles and divides into two short lateral folds.
    for (const side of [-1, 1]) flowStrip(g, u => local(s, d,
      Math.sin(u * Math.PI) * (2 + expand * 3), side * u * (4 + expand * 8)),
    low ? 6 : 9, 1.5, INK.foam, fade);
    stroke(g, [local(s, d, -7, 0), local(s, d, 2, 0)], INK.white,
      fade * clamp(1 - s.age / 90), 2);
  }
  if (s.age < 75) sparkle(g, s, 1 - s.age / 75, wall ? 1.4 : 0.8);
}

function residue(g, s, time, low) {
  const t = s.age / s.life, alpha = (1 - t) * 0.35;
  const radius = (s.kind === 'wall' ? 17 : 11) * (0.7 + clamp(t * 5) * 0.3);
  fill(g, sample(low ? 10 : 16, u => {
    const a = u * TAU, r = radius * (0.9 + Math.sin(a * 3) * 0.1);
    return xy(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r * 0.3);
  }), INK.water, alpha);
  stroke(g, sample(10, u => {
    const a = u * 4.6 + time / 900;
    return xy(s.x + Math.cos(a) * radius * 0.65, s.y + Math.sin(a) * radius * 0.18);
  }), INK.glass, alpha * 0.75);
}

/**
 * Millisecond/world-pixel presentation only. Caller clears and orders both Graphics.
 * caster is the foot anchor; origin is the actual staff anchor, not the foot.
 * Optional quality:'low' reduces geometry and effect slots without altering simulation.
 * Returns { lights }; color is 0xRRGGBB, intensity 0..1, radius in world pixels.
 */
export function renderArcane(groundG, airG, state = {}) {
  const low = state.quality === 'low', limit = low ? 4 : 8;
  const time = number(state.timeMs), lights = [];
  let slots = 0;
  const light = (p, radius, intensity, color = INK.glass) => {
    if (lights.length < limit && valid(p) && intensity > 0)
      lights.push({ x: p.x, y: p.y, radius, color, intensity: clamp(intensity) });
  };
  const channel = state.channel, release = state.release;
  if (valid(state.caster) && valid(channel?.origin)) {
    const p = clamp(number(channel.progress)), d = direction(channel.direction?.x, channel.direction?.y);
    groundSeal(groundG, state.caster, p, time, 0.4 + p * 0.45, low);
    if (!state.bitmapWater && !state.suppressRising) rising(airG, state.caster, channel.origin, p, time, low);
    const sealOrigin = local(channel.origin, d, 7, 0);
    lens(airG, sealOrigin, d, 8 + p * 8, time / 700, 0.55 + p * 0.4, low);
    if(!state.bitmapWater)pressure(airG, {...(valid(channel.waterOrigin)?channel.waterOrigin:local(channel.origin, d, 15 + p * 9, 0)),
      dx:d.x,dy:d.y,life:0,power:1+p}, time, low, 0.5 + p * 0.12);
    if (p > 0.6) sparkle(airG, channel.origin, (p - 0.6) * 1.5);
    light(channel.origin, 38 + p * 22, 0.18 + p * 0.25);
    slots++;
  }
  if (valid(release) && Number.isFinite(release.age) && release.age >= 0 && release.age < 320 && slots < limit) {
    const t = release.age / 320, fade = (1 - t) ** 1.5;
    const scale = clamp(number(release.scale, 1), 0.6, 1.5), d = direction(release.dx, release.dy);
    if (valid(state.caster)) groundSeal(groundG, state.caster, clamp(1 - t), time, fade * 0.7, low);
    lens(airG, local(release, d, 5 + t * 8, 0), d, (10 + t * 14) * scale,
      time / 650, fade, low, release.age < 180);
    if (release.age < 110) {
      const tip = local(release, d, 14 + Math.sin(release.age / 110 * Math.PI) * 14, 0);
      if(!state.bitmapWater)pressure(airG, { ...tip, dx: d.x, dy: d.y, life: release.age }, time, low, scale * 0.7);
      sparkle(airG, release, (1 - release.age / 110) * 0.8);
    }
    light(release, 62 * scale, fade * 0.7, INK.foam);
    slots++;
  }
  const splashes = Array.isArray(state.splashes) ? state.splashes : [];
  // Contact fronts precede flights in the budget; new impacts are visually important.
  for (let i = splashes.length - 1; i >= 0 && slots < limit; i--) {
    const s = splashes[i];
    if (!active(s) || !s.crown || s.puddle) continue;
    if(!state.bitmapWater)impact(airG, s, low); slots++;
    light(s, s.kind === 'wall' ? 42 : 28, (1 - s.age / s.life) ** 2 * 0.55, INK.foam);
  }
  const shots = Array.isArray(state.shots) ? state.shots : [];
  for (let i = shots.length - 1; i >= 0 && slots < limit; i--) {
    const s = shots[i];
    if (!valid(s)) continue;
    if(!state.bitmapWater)pressure(airG, s, time, low); slots++;
    const charged = clamp(number(s.power, 1), 1, 2) - 1;
    light(s, 25 + charged * 8, 0.24 + charged * 0.12);
  }
  for (let i = splashes.length - 1; i >= 0 && slots < limit; i--) {
    const s = splashes[i];
    if (!active(s) || !s.puddle) continue;
    residue(groundG, s, time, low); slots++;
  }
  for (let i = splashes.length - 1; i >= 0 && slots < limit; i--) {
    const s = splashes[i];
    if (!active(s) || s.puddle || s.crown) continue;
    const d = direction(s.vx, s.vy), t = s.age / s.life;
    stroke(airG, [local(s, d, -4 * (1 - t), 1), local(s, d, -2, 0), local(s, d, 0, 0)],
      s.kind === 'wall' ? INK.foam : INK.glass, (1 - t) * 0.75);
    slots++;
  }
  return { lights };
}

export default renderArcane;
