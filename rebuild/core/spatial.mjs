// World-space xy (+y down). Body: {x,y,radius}; delta is displacement, not velocity.
// Collider: {id,kind:'wall'|'enemy',shape:'aabb',x,y,width,height} (top-left),
// or {id,kind,shape:'circle',x,y,radius} (center). Geometry is simulation data.
// Hits expose center, surface point and outward normal; no animation/Phaser input.
const EPS = 1e-8;
const TIME_EPS = 32 * Number.EPSILON;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`Invalid ${name}`);
}

function point(value, name) {
  if (!value || typeof value !== 'object') throw new TypeError(`Invalid ${name}`);
  finite(value.x, `${name}.x`);
  finite(value.y, `${name}.y`);
}

function validate(body, delta, colliders) {
  point(body, 'body');
  point(delta, 'delta');
  finite(body.radius, 'radius');
  if (body.radius < 0 || !Array.isArray(colliders)) throw new TypeError('Invalid geometry');
  finite(body.x + delta.x, 'endpoint.x');
  finite(body.y + delta.y, 'endpoint.y');
  const ids = new Set();
  for (const c of colliders) {
    point(c, 'collider');
    if (typeof c.id !== 'string' || !c.id || ids.has(c.id) || !['wall', 'enemy'].includes(c.kind)) {
      throw new TypeError('Invalid collider identity');
    }
    ids.add(c.id);
    if (c.shape === 'aabb') {
      finite(c.width, 'width');
      finite(c.height, 'height');
      if (c.width <= 0 || c.height <= 0) throw new TypeError('Invalid AABB');
      finite(c.x + c.width, 'right');
      finite(c.y + c.height, 'bottom');
    } else if (c.shape === 'circle') {
      finite(c.radius, 'collider.radius');
      if (c.radius <= 0) throw new TypeError('Invalid circle');
      finite(c.radius + body.radius, 'combined radius');
    } else throw new TypeError('Invalid collider shape');
  }
}

function normal(x, y, fallback = { x: 1, y: 0 }) {
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : fallback;
}

function hit(body, delta, c, t, n, depth = 0) {
  const center = { x: body.x + delta.x * t, y: body.y + delta.y * t };
  return {
    colliderId: c.id, kind: c.kind, t, center,
    point: { x: center.x - n.x * body.radius, y: center.y - n.y * body.radius },
    normal: n, initialOverlap: depth > 0, depth
  };
}

function overlap(body, delta, c) {
  if (c.shape === 'circle') {
    const dx = body.x - c.x, dy = body.y - c.y;
    const depth = body.radius + c.radius - Math.hypot(dx, dy);
    return depth > EPS ? hit(body, delta, c, 0, normal(dx, dy, normal(-delta.x, -delta.y)), depth) : null;
  }
  const right = c.x + c.width, bottom = c.y + c.height;
  if (body.x >= c.x && body.x <= right && body.y >= c.y && body.y <= bottom) {
    const edges = [
      { distance: body.x - c.x, n: { x: -1, y: 0 } },
      { distance: right - body.x, n: { x: 1, y: 0 } },
      { distance: body.y - c.y, n: { x: 0, y: -1 } },
      { distance: bottom - body.y, n: { x: 0, y: 1 } }
    ];
    edges.sort((a, b) => a.distance - b.distance);
    const depth = body.radius + edges[0].distance;
    return depth > EPS ? hit(body, delta, c, 0, edges[0].n, depth) : null;
  }
  const qx = Math.max(c.x, Math.min(right, body.x));
  const qy = Math.max(c.y, Math.min(bottom, body.y));
  const depth = body.radius - Math.hypot(body.x - qx, body.y - qy);
  return depth > EPS ? hit(body, delta, c, 0, normal(body.x - qx, body.y - qy), depth) : null;
}

function circleTime(body, delta, x, y, radius) {
  const px = body.x - x, py = body.y - y;
  const a = delta.x * delta.x + delta.y * delta.y;
  const b = px * delta.x + py * delta.y;
  const c = px * px + py * py - radius * radius;
  const disc = b * b - a * c;
  if (![a, b, c, disc].every(Number.isFinite)) throw new RangeError('Geometry exceeds numeric range');
  if (a === 0 || disc < 0) return null;
  // Stable quadratic root, especially when the start is close to a surface.
  const q = -b - (b >= 0 ? Math.sqrt(disc) : -Math.sqrt(disc));
  const roots = q === 0 ? [-b / a] : [q / a, c / q];
  roots.sort((u, v) => u - v);
  for (const t of roots) if (t >= -TIME_EPS && t <= 1 + TIME_EPS) return Math.max(0, Math.min(1, t));
  return null;
}

function sweepOne(body, delta, c) {
  const initial = overlap(body, delta, c);
  if (initial) return initial;
  if (delta.x === 0 && delta.y === 0) return null;
  const candidates = [];
  const add = (t, n) => {
    if (t === null || t < -TIME_EPS || t > 1 + TIME_EPS) return;
    // Touching but separating/tangential at the start is not a blocking contact.
    if (t <= TIME_EPS && delta.x * n.x + delta.y * n.y >= 0) return;
    candidates.push(hit(body, delta, c, Math.max(0, Math.min(1, t)), n));
  };
  if (c.shape === 'circle') {
    const t = circleTime(body, delta, c.x, c.y, body.radius + c.radius);
    if (t !== null) add(t, normal(body.x + delta.x * t - c.x, body.y + delta.y * t - c.y));
  } else {
    const right = c.x + c.width, bottom = c.y + c.height, r = body.radius;
    for (const [x, nx] of [[c.x - r, -1], [right + r, 1]]) {
      if (delta.x === 0) continue;
      const t = (x - body.x) / delta.x, y = body.y + delta.y * t;
      if (y >= c.y - EPS && y <= bottom + EPS) add(t, { x: nx, y: 0 });
    }
    for (const [y, ny] of [[c.y - r, -1], [bottom + r, 1]]) {
      if (delta.y === 0) continue;
      const t = (y - body.y) / delta.y, x = body.x + delta.x * t;
      if (x >= c.x - EPS && x <= right + EPS) add(t, { x: 0, y: ny });
    }
    // Minkowski sum has four rounded corners, not an inflated rectangular box.
    if (r > 0) for (const [x, y, sx, sy] of [[c.x, c.y, -1, -1], [right, c.y, 1, -1], [c.x, bottom, -1, 1], [right, bottom, 1, 1]]) {
      const t = circleTime(body, delta, x, y, r);
      if (t === null) continue;
      const dx = body.x + delta.x * t - x, dy = body.y + delta.y * t - y;
      if (dx * sx >= -EPS && dy * sy >= -EPS) add(t, normal(dx, dy));
    }
  }
  candidates.sort((a, b) => a.t - b.t);
  return candidates[0] ?? null;
}

function first(body, delta, colliders) {
  let best = null;
  for (const c of colliders) {
    const contact = sweepOne(body, delta, c);
    if (!contact) continue;
    const tied = best && Math.abs(contact.t - best.t) <= TIME_EPS;
    if (!best || contact.t < best.t - TIME_EPS || (tied && (
      (contact.kind === 'wall' && best.kind !== 'wall') ||
      (contact.kind === best.kind && contact.colliderId < best.colliderId)
    ))) best = contact;
  }
  return best;
}

// Earliest continuous contact in t=[0,1], or null. Includes initial penetration.
export function sweepCircle(body, delta, colliders) {
  validate(body, delta, colliders);
  return first(body, delta, colliders);
}

// Static-collider slide; no mutation. Filter nonblocking colliders before calling.
// Returns bounded recovery/slide diagnostics; an impossible overlap stops safely.
export function moveCircle(body, delta, colliders, { maxIterations = 8, skin = 1e-6 } = {}) {
  validate(body, delta, colliders);
  if (!Number.isSafeInteger(maxIterations) || maxIterations < 1 || maxIterations > 64 ||
      !Number.isFinite(skin) || skin < EPS) throw new TypeError('Invalid movement options');
  const position = { x: body.x, y: body.y, radius: body.radius };
  const contacts = [];
  let recoverySteps = 0;
  const deepest = () => {
    let best = null;
    for (const c of colliders) {
      const h = overlap(position, delta, c);
      if (h && (!best || h.depth > best.depth)) best = h;
    }
    return best;
  };
  let penetration = deepest();
  while (penetration && recoverySteps < maxIterations) {
    contacts.push(penetration);
    position.x += penetration.normal.x * (penetration.depth + skin);
    position.y += penetration.normal.y * (penetration.depth + skin);
    recoverySteps++;
    penetration = deepest();
  }
  if (penetration) return { x: position.x, y: position.y, contacts, unresolvedOverlap: true, iterationLimit: true };
  let remaining = { ...delta }, iterations = 0;
  while (Math.hypot(remaining.x, remaining.y) > EPS && iterations < maxIterations) {
    const h = first(position, remaining, colliders);
    iterations++;
    if (!h) {
      position.x += remaining.x;
      position.y += remaining.y;
      remaining = { x: 0, y: 0 };
      break;
    }
    contacts.push(h);
    position.x = h.center.x + h.normal.x * skin;
    position.y = h.center.y + h.normal.y * skin;
    remaining.x *= 1 - h.t;
    remaining.y *= 1 - h.t;
    const inward = remaining.x * h.normal.x + remaining.y * h.normal.y;
    if (inward < 0) {
      remaining.x -= h.normal.x * inward;
      remaining.y -= h.normal.y * inward;
    }
  }
  return {
    x: position.x, y: position.y, contacts, unresolvedOverlap: !!deepest(),
    iterationLimit: Math.hypot(remaining.x, remaining.y) > EPS
  };
}
