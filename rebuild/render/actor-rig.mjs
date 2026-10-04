const TAU = Math.PI * 2;
let serial = 0;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const wrap = p => ((p % 1) + 1) % 1;
const length = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

const leg = (x, hipY, kneeY, ankleY, polygon, footBox) => ({
  hip: { x, y: hipY }, knee: { x, y: kneeY }, ankle: { x, y: ankleY },
  polygon, footBox,
});

// All coordinates are local to the measured 627px idle cells, not opaque bounds.
export const ACTOR_RIG_PROFILE = {
  cellSize: 627,
  scale: 48 / 539,
  rootX: [315, 297, 321, 305],
  rootY: [575, 579, 579, 575],
  rows: [
    { direction: [0, 1], amplitude: 22, projectedKnees: true, bend: [-1, 1], cloakPolygons: [
      [[184,418],[233,425],[233,470],[208,478],[178,455]],
      [[365,422],[449,419],[479,454],[395,482],[362,456]],
    ], legs: [
      leg(283, 444, 490, 544, [[262,438],[312,438],[312,519],[315,578],[253,578],[257,529],[262,490]], [253,531,315,580]),
      leg(339, 444, 490, 544, [[318,438],[366,438],[367,516],[371,578],[315,578],[317,524]], [315,531,373,580]),
    ] },
    { direction: [-1, 0], amplitude: 55, bend: [-1, -1], reconstructedFarLeg: true,
      cloakPolygons: [[[319,420],[387,418],[422,493],[337,521],[317,475]]], legs: [
      leg(297, 458, 502, 548, [[275,452],[312,452],[313,522],[336,551],[336,583],[255,583],[259,542],[274,517]], [255,537,338,584]),
    ] },
    { direction: [1, 0], amplitude: 55, bend: [1, 1], reconstructedFarLeg: true,
      cloakPolygons: [[[193,417],[279,417],[282,475],[253,510],[162,474]]], legs: [
      leg(313, 458, 502, 548, [[288,452],[329,452],[329,528],[367,550],[367,583],[269,583],[274,542],[285,518]], [269,536,369,584]),
    ] },
    { direction: [0, -1], amplitude: 18, projectedKnees: true, bend: [-1, 1],
      cloakPolygons: [[[203,417],[378,417],[400,477],[350,498],[254,498],[185,480]]], legs: [
      leg(283, 468, 506, 546, [[261,461],[307,461],[307,529],[310,578],[258,578],[260,530]], [258,535,311,580]),
      leg(333, 468, 506, 546, [[310,461],[355,461],[355,531],[355,578],[307,578],[309,531]], [307,535,358,580]),
    ] },
  ],
};

export const RUDEUS_CAST_POSE_META = Object.freeze({
  path: 'assets/rudeus-cast-v3.png', cellSize: 627, columns: 2,
  sheetSize: Object.freeze([1254, 1254]), scale: 48 / 547.5,
  headTop: Object.freeze([34, 35, 22, 33]),
  shoeBottom: Object.freeze([581, 581, 576, 578]),
  rootX: Object.freeze([313, 330, 292, 318]),
  rootY: Object.freeze([581, 581, 576, 578]),
  // Visually located bulb centers, not animation events or a proved magic origin.
  staffTips: Object.freeze([[255,248], [63,184], [586,163], [557,50]].map(Object.freeze)),
  completeCastAnimation: false,
});

export function solveTwoBone(hip, target, upperLength, lowerLength, bend = 1) {
  if (![hip.x, hip.y, target.x, target.y, upperLength, lowerLength, bend].every(Number.isFinite)
    || upperLength <= 0 || lowerLength <= 0) throw new RangeError('Invalid two-bone inputs');
  const dx = target.x - hip.x, dy = target.y - hip.y;
  const requested = Math.hypot(dx, dy);
  const reach = clamp(requested, Math.abs(upperLength - lowerLength) + 1e-6, upperLength + lowerLength - 1e-6);
  const ux = requested > 1e-9 ? dx / requested : 0;
  const uy = requested > 1e-9 ? dy / requested : 1;
  const along = (upperLength ** 2 - lowerLength ** 2 + reach ** 2) / (2 * reach);
  const across = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2)) * Math.sign(bend || 1);
  return {
    knee: { x: hip.x + ux * along - uy * across, y: hip.y + uy * along + ux * across },
    ankle: { x: hip.x + ux * reach, y: hip.y + uy * reach },
    constrained: Math.abs(reach - requested) > 1e-5,
  };
}

export function sampleActorPose({ row = 0, phase = 0, weight = 1, scale = ACTOR_RIG_PROFILE.scale,
  rootX = ACTOR_RIG_PROFILE.rootX[row], rootY = ACTOR_RIG_PROFILE.rootY[row] } = {}) {
  if (!Number.isInteger(row) || row < 0 || row > 3 || ![phase, weight, scale, rootX, rootY].every(Number.isFinite)
    || scale <= 0) throw new RangeError('Invalid actor pose inputs');
  const profile = ACTOR_RIG_PROFILE.rows[row];
  weight = clamp(weight, 0, 1);
  const point = (p, offsetY = 0) => ({ x: (p.x - rootX) * scale, y: (p.y - rootY + offsetY) * scale });
  const bodyX = 4 * Math.sin(phase * TAU) * weight * scale;
  const bodyY = (24 + 2 * (1 - Math.cos(phase * TAU * 2))) * weight * scale;
  const bodyAngle = .008 * Math.sin(phase * TAU) * weight;
  const cloakAngle = bodyAngle + .008 * Math.sin(phase * TAU - .55) * weight;
  const bodyPivotY = (profile.legs[0].hip.y - rootY) * scale;
  const legs = [0, 1].map(i => {
    const source = profile.legs[i] || profile.legs[0];
    const p = wrap(phase + i * 0.5);
    const contact = p < 0.5;
    const swing = contact ? 0 : (p - 0.5) * 2;
    const stride = contact ? 1 - p * 4 : -Math.cos(swing * Math.PI);
    const lift = contact ? 0 : 15 * Math.sin(swing * Math.PI) ** 2 * weight;
    const offset = profile.reconstructedFarLeg && i === 0 ? -profile.direction[0] * 10 * weight : 0;
    const localHip = point(source.hip);
    const hip = {
      x: bodyX + localHip.x * Math.cos(bodyAngle) - (localHip.y - bodyPivotY) * Math.sin(bodyAngle) + offset * scale,
      y: bodyY + bodyPivotY + localHip.x * Math.sin(bodyAngle) + (localHip.y - bodyPivotY) * Math.cos(bodyAngle),
    };
    const desired = point(source.ankle);
    desired.x += (profile.direction[0] * stride * profile.amplitude * weight + offset) * scale;
    desired.y += (profile.direction[1] * stride * profile.amplitude * weight - lift) * scale;
    const ik = weight === 0 ? { knee: point(source.knee), ankle: point(source.ankle), constrained: false }
      : solveTwoBone(hip, desired, length(source.hip, source.knee) * scale,
        length(source.knee, source.ankle) * scale, profile.bend[i]);
    if (weight > 0 && profile.projectedKnees) {
      // Sagittal knee bend is depth in front/back views, not a sideways bow.
      const ratio = length(source.hip, source.knee) / (length(source.hip, source.knee) + length(source.knee, source.ankle));
      ik.knee = { x: hip.x + (ik.ankle.x - hip.x) * ratio, y: hip.y + (ik.ankle.y - hip.y) * ratio };
    }
    return { hip, knee: ik.knee, ankle: ik.ankle, contact, lift: lift * scale,
      constrained: ik.constrained, projectedKnee: !!profile.projectedKnees,
      phase: p, sourceIndex: Math.min(i, profile.legs.length - 1), footAngle: 0 };
  });
  return { row, phase: wrap(phase), weight, bodyX, bodyY, bodyAngle, bodyPivotY, cloakAngle, legs,
    reconstructedFarLeg: !!profile.reconstructedFarLeg };
}

export class ActorRigGait {
  constructor({ scale = ACTOR_RIG_PROFILE.scale, rootX = ACTOR_RIG_PROFILE.rootX,
    rootY = ACTOR_RIG_PROFILE.rootY, supportedRows = [0, 1, 2, 3], phaseMode = 'stylized', strideDistance = 78 } = {}) {
    if (!Number.isFinite(scale) || scale <= 0 || !['distance', 'preview', 'stylized'].includes(phaseMode)
      || !Number.isFinite(strideDistance) || strideDistance <= 0) {
      throw new RangeError('Invalid rig gait configuration');
    }
    this.scale = scale; this.rootX = rootX; this.rootY = rootY;
    this.supportedRows = supportedRows; this.phaseMode = phaseMode;
    this.stylizedStrideDistance = strideDistance;
    this.phase = 0; this.previous = null; this.plants = [null, null];
  }

  step({ x, y, row, state, progress, dtMs, distance }) {
    if (![x, y, progress, dtMs].every(Number.isFinite) || dtMs < 0
      || !Number.isInteger(row) || row < 0 || row > 3) throw new RangeError('Invalid gait step');
    const previous = this.previous;
    const dx = previous ? x - previous.x : 0, dy = previous ? y - previous.y : 0;
    const traveled = distance ?? Math.hypot(dx, dy);
    if (!Number.isFinite(traveled) || traveled < 0) throw new RangeError('Invalid actual distance');
    const profile = ACTOR_RIG_PROFILE.rows[row];
    // Half-cycle stance travels from +amplitude to -amplitude: period = 4 * amplitude.
    const strictStrideDistance = 4 * profile.amplitude * this.scale;
    const strideDistance = this.phaseMode === 'stylized' ? this.stylizedStrideDistance : strictStrideDistance;
    const supported = this.supportedRows.includes(row);
    const changed = !previous || previous.row !== row;
    if (state === 'idle' || state === 'start' || changed) {
      this.phase = 0; this.plants = [null, null];
    }
    if (state === 'walk') {
      if (this.phaseMode === 'preview') this.phase = progress;
      else if (dtMs > 0) this.phase += traveled / strideDistance;
    }
    const weight = state === 'walk' ? 1 : state === 'start' ? smooth(progress)
      : state === 'stop' ? 1 - smooth(progress) : 0;
    const pose = sampleActorPose({ row, phase: this.phase, weight: supported ? weight : 0,
      scale: this.scale, rootX: this.rootX[row], rootY: this.rootY[row] });
    const axisMatches = row === 1 ? dx <= 0 && Math.abs(dy) < 1e-5
      : row === 2 ? dx >= 0 && Math.abs(dy) < 1e-5 : false;
    const canPlant = supported && state === 'walk' && this.phaseMode === 'distance' && axisMatches;
    let contactError = 0;
    for (let i = 0; i < 2; i++) {
      const l = pose.legs[i], cycle = Math.floor(this.phase + i * .5);
      if (!canPlant || !l.contact) { this.plants[i] = null; continue; }
      const plant = this.plants[i];
      if (!plant || plant.cycle !== cycle || changed || previous?.state !== 'walk') {
        this.plants[i] = { cycle, x: x + l.ankle.x, y: y + l.ankle.y };
      } else {
        const source = profile.legs[l.sourceIndex], target = { x: plant.x - x, y: plant.y - y };
        const ik = solveTwoBone(l.hip, target, length(source.hip, source.knee) * this.scale,
          length(source.knee, source.ankle) * this.scale, profile.bend[i]);
        l.knee = ik.knee; l.ankle = ik.ankle; l.constrained = ik.constrained;
        contactError = Math.max(contactError, length(l.ankle, target));
      }
    }
    this.previous = { x, y, row, state };
    const recommendedMaxSpeed = this.phaseMode === 'stylized' ? strideDistance / .5 : strictStrideDistance * 2.5;
    return { ...pose, supported, strideDistance, recommendedMaxSpeed,
      footLock: canPlant && contactError < 1e-5 && !pose.legs.some(l => l.contact && l.constrained),
      contactError, speed: dtMs > 0 ? traveled / dtMs * 1000 : 0,
      speedWarning: dtMs > 0 && traveled / dtMs * 1000 > recommendedMaxSpeed,
      expectedStanceSlip: this.phaseMode === 'stylized' ? Math.max(0, strideDistance / 2 - 2 * profile.amplitude * this.scale) : 0,
      candidate: true, visualAccepted: false, phaseMode: this.phaseMode };
  }
}

function path(ctx, polygon) {
  ctx.beginPath();
  polygon.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
}

function bounds(polygon) {
  const xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]);
  const x = Math.floor(Math.min(...xs)), y = Math.floor(Math.min(...ys));
  return { x, y, width: Math.ceil(Math.max(...xs)) - x, height: Math.ceil(Math.max(...ys)) - y };
}

function removeDisconnected(imageData) {
  const { width, height, data } = imageData;
  const seen = new Uint8Array(width * height);
  let largest = [];
  for (let seed = 0; seed < seen.length; seed++) {
    if (seen[seed] || data[seed * 4 + 3] < 32) continue;
    const component = [seed]; seen[seed] = 1;
    for (let q = 0; q < component.length; q++) {
      const v = component[q], x = v % width, y = Math.floor(v / width);
      for (const n of [x > 0 ? v - 1 : -1, x < width - 1 ? v + 1 : -1,
        y > 0 ? v - width : -1, y < height - 1 ? v + width : -1]) {
        if (n >= 0 && !seen[n] && data[n * 4 + 3] >= 32) { seen[n] = 1; component.push(n); }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  const keep = new Uint8Array(seen.length);
  for (const v of largest) {
    const x = v % width, y = Math.floor(v / width);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) keep[v + dy * width + dx] = 1;
    }
  }
  for (let i = 0; i < keep.length; i++) if (!keep[i]) data[i * 4 + 3] = 0;
}

export function createActorRig(scene, { idleKeys = ['idle:0', 'idle:1', 'idle:2', 'idle:3'],
  idleKey, assetMeta = {}, supportedRows = [0, 1, 2, 3], phaseMode = 'stylized', strideDistance = 78,
  castKeys, castMeta,
  keyPrefix = `actor-rig-${++serial}` } = {}) {
  if (idleKey) idleKeys = typeof idleKey === 'string' ? [idleKey, ...idleKeys.slice(1)] : idleKey;
  const meta = assetMeta.idle || assetMeta;
  const scale = Number.isFinite(meta.scale) && meta.scale > 0 ? meta.scale : ACTOR_RIG_PROFILE.scale;
  const rootX = meta.rootX || ACTOR_RIG_PROFILE.rootX;
  const rootY = meta.rootY || ACTOR_RIG_PROFILE.rootY;
  const container = scene.add.container(0, 0);
  const owned = [], rows = [], diagnostics = [];
  const gait = new ActorRigGait({ scale, rootX, rootY, supportedRows, phaseMode, strideDistance });
  let destroyed = false, row = 0;
  const casts = [];
  if (castKeys && castMeta) for (let r = 0; r < 4; r++) {
    if (!scene.textures.exists(castKeys[r])) continue;
    const frame = scene.textures.get(castKeys[r]).get();
    if (![castMeta.scale, castMeta.rootX?.[r], castMeta.rootY?.[r]].every(Number.isFinite)
      || castMeta.scale <= 0 || frame.cutWidth <= 0 || frame.cutHeight <= 0) continue;
    const image = scene.add.image(0, 0, castKeys[r]).setScale(castMeta.scale)
      .setOrigin(castMeta.rootX[r] / frame.cutWidth, castMeta.rootY[r] / frame.cutHeight).setVisible(false);
    container.add(image); casts[r] = image;
  }

  const makeTexture = (key, width, height, draw) => {
    if (scene.textures.exists(key)) throw new Error('Rig texture key collision');
    const tex = scene.textures.createCanvas(key, width, height);
    owned.push(key);
    const ctx = tex.context || tex.getContext();
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    const imageData = ctx.getImageData(0, 0, width, height), pixels = imageData.data;
    // A boot crop must not carry a disconnected staff fragment into the moving foot.
    removeDisconnected(imageData);
    let opaque = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 16) pixels[i] = 0;
      if (pixels[i] >= 32) opaque++;
    }
    ctx.putImageData(imageData, 0, 0);
    if (opaque < 64) throw new Error(`Empty source patch: ${key}`);
    tex.refresh();
    return { key, opaque };
  };

  const patch = (frame, polygon, region, suffix, eraseLegs) => {
    const b = region || bounds(polygon);
    const data = makeTexture(`${keyPrefix}:${suffix}`, b.width, b.height, ctx => {
      ctx.save(); ctx.translate(-b.x, -b.y); path(ctx, polygon); ctx.clip();
      ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, 627, 627, 0, 0, 627, 627);
      if (eraseLegs) eraseLegs(ctx);
      ctx.restore();
    });
    return { ...data, ...b };
  };

  for (let r = 0; r < 4; r++) {
    const start = owned.length, profile = ACTOR_RIG_PROFILE.rows[r];
    const images = [];
    const add = key => {
      const s = scene.add.image(0, 0, key);
      container.add(s); s.setVisible(false); images.push(s); return s;
    };
    let idle = null;
    try {
      if (!scene.textures.exists(idleKeys[r])) throw new Error(`Missing idle texture ${idleKeys[r]}`);
      idle = add(idleKeys[r]);
      idle.setOrigin(rootX[r] / 627, rootY[r] / 627).setScale(scale);
      const frame = scene.textures.get(idleKeys[r]).get();
      if (frame.cutWidth !== 627 || frame.cutHeight !== 627 || !frame.source?.image) {
        throw new Error('Rig requires an untrimmed 627x627 idle frame');
      }
      const eraseLegs = ctx => {
        ctx.globalCompositeOperation = 'destination-out';
        for (const source of profile.legs) {
          // Preserve shorts/hem; remove original socks and boots, including lower alpha edges.
          ctx.save(); ctx.beginPath(); ctx.rect(0, r === 3 ? 480 : r === 0 ? 451 : 472, 627, 627); ctx.clip();
          path(ctx, source.polygon); ctx.fill(); ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
      };
      const cloak = profile.cloakPolygons.map((polygon, i) =>
        patch(frame, polygon, null, `${r}:cloak:${i}`, eraseLegs));
      const body = makeTexture(`${keyPrefix}:${r}:body`, 627, 627, ctx => {
        ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, 627, 627, 0, 0, 627, 627);
        eraseLegs(ctx);
        ctx.globalCompositeOperation = 'destination-out';
        for (const polygon of profile.cloakPolygons) {
          const cx = polygon.reduce((n, p) => n + p[0], 0) / polygon.length;
          const cy = polygon.reduce((n, p) => n + p[1], 0) / polygon.length;
          // Retain painted underlap at the moving hem join rather than exposing a hole.
          path(ctx, polygon.map(([x,y]) => [cx + (x-cx)*.94, cy + (y-cy)*.94])); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      });
      const parts = [];
      for (let i = 0; i < 2; i++) {
        const source = profile.legs[i] || profile.legs[0];
        const b = bounds(source.polygon);
        const thigh = patch(frame, source.polygon,
          { x: b.x, y: b.y, width: b.width, height: source.knee.y + 2 - b.y }, `${r}:${i}:thigh`);
        const shin = patch(frame, source.polygon,
          { x: b.x, y: source.knee.y - 2, width: b.width, height: source.footBox[3] - (source.knee.y - 2) }, `${r}:${i}:boot`);
        // Sock, ankle strap and toe stay in one continuous painted patch.
        const pair = { source, thigh, shin,
          thighSprite: add(thigh.key), shinSprite: add(shin.key) };
        if (profile.reconstructedFarLeg && i === 0) {
          for (const s of [pair.thighSprite, pair.shinSprite]) s.setTint(0xc5bdb5);
        }
        parts.push(pair);
      }
      // Original upper body and cloak are in front of the hip joins and far leg.
      const bodySprite = add(body.key).setOrigin(rootX[r] / 627, profile.legs[0].hip.y / 627).setScale(scale);
      const cloakParts = cloak.map(p => ({ ...p, sprite: add(p.key)
        .setOrigin((rootX[r]-p.x)/p.width, (420-p.y)/p.height).setScale(scale) }));
      rows[r] = { idle, parts, bodySprite, cloakParts, images, supported: true };
      diagnostics[r] = { supported: true, reconstructedFarLeg: !!profile.reconstructedFarLeg,
        opaquePatches: [body.opaque, ...parts.flatMap(p => [p.thigh.opaque, p.shin.opaque]), ...cloak.map(p => p.opaque)] };
    } catch (error) {
      for (const s of images) if (s !== idle) s.destroy();
      for (const key of owned.splice(start)) scene.textures.remove(key);
      rows[r] = { idle, images: idle ? [idle] : [], supported: false };
      diagnostics[r] = { supported: false, reason: error.message };
    }
  }

  function bone(sprite, patchInfo, from, to, sourceFrom, sourceTo) {
    sprite.setOrigin((sourceFrom.x - patchInfo.x) / patchInfo.width,
      (sourceFrom.y - patchInfo.y) / patchInfo.height);
    sprite.setPosition(from.x, from.y);
    sprite.setRotation(Math.atan2(to.y - from.y, to.x - from.x)
      - Math.atan2(sourceTo.y - sourceFrom.y, sourceTo.x - sourceFrom.x));
    sprite.setScale(scale, length(from, to) / length(sourceFrom, sourceTo));
  }

  return {
    container, diagnostics,
    strideDistance: phaseMode === 'stylized' ? strideDistance : 220 * scale,
    recommendedMaxSpeed: phaseMode === 'stylized' ? strideDistance / .5 : 550 * scale,
    supportedRows: [...supportedRows],
    update({ x = 0, y = 0, row: nextRow = row, progress = 0, state = 'idle', timeMs = 0, dtMs = 0, distance } = {}) {
      if (destroyed) return { destroyed: true };
      if (![x, y, progress, timeMs, dtMs].every(Number.isFinite) || dtMs < 0
        || !Number.isInteger(nextRow) || nextRow < 0 || nextRow > 3) throw new RangeError('Invalid rig update');
      row = nextRow;
      container.setPosition(x, y).setDepth(y);
      for (const entry of rows) for (const image of entry.images) image.setVisible(false);
      for (const image of casts) image?.setVisible(false);
      const entry = rows[row];
      const pose = gait.step({ x, y, row, progress, state, dtMs, distance });
      if (state === 'cast' && casts[row]) {
        casts[row].setVisible(true);
        const tip = castMeta.staffTips?.[row];
        const staffTip = tip ? { x: x + (tip[0] - castMeta.rootX[row]) * castMeta.scale,
          y: y + (tip[1] - castMeta.rootY[row]) * castMeta.scale } : null;
        return { ...pose, rig: false, fallback: false, castPose: true, staffTip, state };
      }
      if (!entry.supported || !pose.supported || pose.weight === 0) {
        entry.idle?.setVisible(true);
        return { ...pose, rig: false, fallback: !entry.supported || !pose.supported,
          missingActionPose: state === 'cast' || state === 'dodge', castPose: false, state };
      }
      for (let i = 0; i < 2; i++) {
        const part = entry.parts[i], target = pose.legs[i], source = part.source;
        bone(part.thighSprite, part.thigh, target.hip, target.knee, source.hip, source.knee);
        bone(part.shinSprite, part.shin, target.knee, target.ankle, source.knee, source.ankle);
        for (const s of [part.thighSprite, part.shinSprite]) s.setVisible(true);
      }
      entry.bodySprite.setPosition(pose.bodyX, pose.bodyPivotY + pose.bodyY)
        .setRotation(pose.bodyAngle).setVisible(true);
      const hemY = (420 - rootY[row]) * scale - pose.bodyPivotY;
      for (const part of entry.cloakParts) part.sprite
        .setPosition(pose.bodyX - hemY * Math.sin(pose.bodyAngle),
          pose.bodyPivotY + pose.bodyY + hemY * Math.cos(pose.bodyAngle))
        .setRotation(pose.cloakAngle).setVisible(true);
      return { ...pose, rig: true, fallback: false, state };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      container.destroy(true);
      for (const key of owned) scene.textures.remove(key);
      owned.length = 0;
    },
  };
}
