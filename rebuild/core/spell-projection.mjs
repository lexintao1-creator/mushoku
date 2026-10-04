import { sweepCircle } from './spatial.mjs';

export const SPELL_PLANE = Object.freeze({ muzzleDistance: 12, visualHeight: 20, handoffMs: 120, projectileSpeed: 440 });

function point(p) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new TypeError('Invalid spell point');
  return { x: p.x, y: p.y };
}

function unit(p, fallback = { x: 1, y: 0 }) {
  const a = point(p), length = Math.hypot(a.x, a.y);
  if (length > 1e-9) return { x: a.x / length, y: a.y / length };
  const b = point(fallback), n = Math.hypot(b.x, b.y);
  return n > 1e-9 ? { x: b.x / n, y: b.y / n } : { x: 1, y: 0 };
}

// The cursor selects the rendered flight plane, never the current sprite's pose.
export function spellAim(foot, cursor, fallback) {
  const f = point(foot), c = point(cursor);
  return unit({ x: c.x - f.x, y: c.y + SPELL_PLANE.visualHeight - f.y }, fallback);
}

function handoffDuration(offset, speed) {
  if (!Number.isFinite(speed) || speed <= 0) throw new TypeError('Invalid projectile speed');
  // Smoothstep's peak derivative is 1.5. Include the final flight-plane height,
  // so correction speed never exceeds travel speed, even for vertical aim.
  const duration = Math.max(SPELL_PLANE.handoffMs,
    1500 * (Math.hypot(offset.x, offset.y + SPELL_PLANE.visualHeight) / speed));
  if (!Number.isFinite(duration)) throw new TypeError('Invalid launch offset');
  return duration;
}

export function createSpellProjection({ foot, direction, visualOrigin, colliders = [], speed = SPELL_PLANE.projectileSpeed }) {
  const f = point(foot), d = unit(direction), v = point(visualOrigin);
  const delta = { x: d.x * SPELL_PLANE.muzzleDistance, y: d.y * SPELL_PLANE.muzzleDistance };
  const hit = sweepCircle({ ...f, radius: 3 }, delta, colliders);
  const groundOrigin = Object.freeze(hit ? {
    x: hit.center.x + hit.normal.x * 1e-6,
    y: hit.center.y + hit.normal.y * 1e-6,
  } : { x: f.x + delta.x, y: f.y + delta.y });
  const launchOffset = Object.freeze({ x: v.x - groundOrigin.x, y: v.y - groundOrigin.y });
  const handoffMs = handoffDuration(launchOffset, speed);
  return Object.freeze({
    groundOrigin,
    direction: Object.freeze(d),
    visualOrigin: Object.freeze(v),
    launchOffset,
    speed,
    handoffMs,
  });
}

// Per-shot handoff joins the launch tip to the stable flight plane without backtracking
// along the flight axis when ground motion uses the projection's launch speed.
// Collision always consumes ground coordinates, including during this handoff.
export function spellVisualPoint(ground, projection, ageMs) {
  const g = point(ground), a = point(projection?.launchOffset);
  if (!Number.isFinite(ageMs)) throw new TypeError('Invalid spell age');
  const duration = projection.handoffMs ?? handoffDuration(a, projection.speed ?? SPELL_PLANE.projectileSpeed);
  if (!Number.isFinite(duration) || duration <= 0) throw new TypeError('Invalid handoff duration');
  const t = Math.max(0, Math.min(1, ageMs / duration));
  const w = t * t * (3 - 2 * t);
  return {
    x: g.x + a.x * (1 - w),
    y: g.y + a.y * (1 - w) - SPELL_PLANE.visualHeight * w,
  };
}
