const TAU = Math.PI * 2;
const clamp = v => Math.max(0, Math.min(1, v));

// Project a tightening axial helix, split by depth so it wraps the water core.
export function pressureFlow({ tip, direction, progress, materialAgeMs, loopMs = 800 }) {
  if (!tip || !direction || ![tip.x, tip.y, direction.x, direction.y, progress, materialAgeMs].every(Number.isFinite)) return null;
  const norm = Math.hypot(direction.x, direction.y);
  if (norm < 1e-6 || loopMs <= 0) return null;
  const aim = { x: direction.x / norm, y: direction.y / norm }, p = clamp(progress);
  const length = 65 + 95 * p, phase = -materialAgeMs / loopMs * TAU;
  const frontRadius = 9 + 17 * p, rearRadius = 3 + 4 * p;
  const ribbons = [];
  for (let lane = 0; lane < 3; lane++) {
    const travel = ((materialAgeMs / 520 + lane / 3) % 1 + 1) % 1;
    let segment = null;
    for (let i = 0; i <= 32; i++) {
      const s = i / 32, radius = frontRadius * (1 - s) + rearRadius * s;
      const theta = phase + s * TAU * 1.15 + lane * TAU / 3;
      const behind = Math.sin(theta) < 0;
      const axial = 10 - length * s + radius * .16 * Math.sin(theta);
      const lateral = radius * Math.cos(theta);
      const vertex = { x: tip.x + aim.x * axial - aim.y * lateral,
        y: tip.y + aim.y * axial + aim.x * lateral };
      const distance = Math.min(Math.abs(s - travel), 1 - Math.abs(s - travel));
      const alpha = (.15 + .4 * p) * Math.max(.12, 1 - distance * 3) * Math.sin(Math.PI * s) ** .6;
      if (!segment || segment.behind !== behind) {
        const previous = segment?.points.at(-1);
        segment = { behind, alpha, points: previous ? [previous, vertex] : [vertex] };
        ribbons.push(segment);
      } else {
        segment.points.push(vertex); segment.alpha = Math.max(segment.alpha, alpha);
      }
    }
  }
  // Outer packets curve around the tip and stream past the caster, not around his body.
  if (p >= .999) for (let lane = 0; lane < 4; lane++) {
    const travel = ((materialAgeMs / 1250 + lane / 4) % 1 + 1) % 1;
    const sign = lane % 2 ? -1 : 1, points = [];
    for (let i = 0; i <= 18; i++) {
      const s = Math.max(0, travel - .42) + (Math.min(1, travel + .08) - Math.max(0, travel - .42)) * i / 18;
      const axial = 14 - (95 + 125 * p) * s;
      const lateral = sign * ((15 + 38 * p) * Math.sin(Math.PI * s) + 8 * s);
      points.push({ x: tip.x + aim.x * axial - aim.y * lateral, y: tip.y + aim.y * axial + aim.x * lateral });
    }
    ribbons.push({ behind: lane < 2, alpha: (.1 + .32 * p) * Math.sin(Math.PI * travel) ** .4, points, outer: true });
  }
  const clearRibbons = [];
  for (const ribbon of ribbons) {
    let part = null;
    for (const vertex of ribbon.points) {
      const dx = vertex.x - tip.x, dy = vertex.y - tip.y;
      const along = dx * aim.x + dy * aim.y, across = -dx * aim.y + dy * aim.x;
      if (p < .999 && along < -50 && along > -108 && Math.abs(across) < 30) { part = null; continue; }
      if (!part) { part = { ...ribbon, points: [] }; clearRibbons.push(part); }
      part.points.push(vertex);
    }
  }
  return { ribbons: clearRibbons, phase, length, frontRadius, rearRadius, orbit: 'opposite-material', advection: 'tip-to-rear' };
}

export function drawPressureFlow(back, front, flow, depth) {
  back.clear(); front.clear();
  back.setDepth(depth + .15); front.setDepth(depth + .25);
  if (!flow) return;
  for (const ribbon of flow.ribbons) {
    if (ribbon.points.length < 2) continue;
    const g = ribbon.behind ? back : front;
    g.lineStyle(ribbon.outer ? 1.5 : 1.2, 0xd2eff0, ribbon.alpha * (ribbon.behind ? .65 : 1));
    g.strokePoints(ribbon.points, false);
  }
}
