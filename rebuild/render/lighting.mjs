const MAX_LIGHTS = 6;
const DEFAULT_KEY_PREFIX = 'rebirth-lighting';
const DEFAULT_SAMPLE_STEP = 16;
const EPS = 1e-6;
let instanceId = 0;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const positive = (value, fallback = 1) => Math.max(EPS, finite(value, fallback));
const hasDocument = () => typeof document !== 'undefined' && typeof document.createElement === 'function';

function makeCanvas(width, height) {
  if (!hasDocument()) throw new Error('createLighting requires document.createElement("canvas").');
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(positive(width)));
  canvas.height = Math.max(1, Math.ceil(positive(height)));
  return canvas;
}

function getContext(canvas) {
  const ctx = canvas?.getContext?.('2d', { willReadFrequently: true }) || canvas?.getContext?.('2d');
  if (!ctx) throw new Error('createLighting requires a readable 2D canvas context.');
  return ctx;
}

function parseColor(color, fallback = { r: 255, g: 210, b: 138 }) {
  if (color && typeof color === 'object') {
    const r = finite(color.r, NaN);
    const g = finite(color.g, NaN);
    const b = finite(color.b, NaN);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) };
    }
  }
  if (typeof color === 'number' && Number.isFinite(color)) {
    return { r: color >> 16 & 255, g: color >> 8 & 255, b: color & 255 };
  }
  if (typeof color === 'string') {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const value = Number.parseInt(hex.length === 3 ? hex.replace(/(.)/g, '$1$1') : hex.slice(0, 6), 16);
      if (Number.isFinite(value)) return parseColor(value, fallback);
    }
    const match = color.match(/rgba?\(([^)]+)\)/i);
    if (match) {
      const [r, g, b] = match[1].split(',').map(v => clamp(finite(v.trim()), 0, 255));
      return { r, g, b };
    }
  }
  return { ...fallback };
}

function getPhaser(scene) {
  return scene?.sys?.game?.constructor?.Phaser || globalThis.Phaser || globalThis.window?.Phaser || null;
}

function blend(scene, name, fallback) {
  const modes = getPhaser(scene)?.BlendModes;
  return modes?.[name] ?? name ?? fallback;
}

function textureImage(scene, key, frameName) {
  if (!key || !scene?.textures?.exists?.(key)) return null;
  const tex = scene.textures.get(key);
  const frame = tex?.get?.(frameName) || tex?.getFrame?.(frameName) || tex?.frames?.[frameName];
  const image = frame?.source?.image || frame?.source?.canvas || tex?.getSourceImage?.() || tex?.source?.[0]?.image || tex?.source?.[0]?.canvas;
  return image ? {
    image,
    sx: finite(frame?.cutX, 0),
    sy: finite(frame?.cutY, 0),
    sw: positive(frame?.cutWidth, image.width || 1),
    sh: positive(frame?.cutHeight, image.height || 1)
  } : null;
}

function surfaceSource(scene, surface) {
  const direct = surface.source || surface.image || surface.canvas;
  if (direct) {
    return {
      image: direct,
      sx: finite(surface.sourceX, 0),
      sy: finite(surface.sourceY, 0),
      sw: positive(surface.sourceWidth, direct.width || surface.width || 1),
      sh: positive(surface.sourceHeight, direct.height || surface.height || 1)
    };
  }
  return textureImage(scene, surface.key || surface.textureKey, surface.frame ?? surface.frameName);
}

function sanitizeSurface(scene, surface, index) {
  if (!surface || typeof surface !== 'object') return null;
  const x = finite(surface.x);
  const y = finite(surface.y);
  const width = positive(surface.width ?? surface.w, 0);
  const height = positive(surface.height ?? surface.h, 0);
  if (width <= EPS || height <= EPS) return null;
  const source = surfaceSource(scene, surface);
  if (!source?.image) {
    const label = surface.id || surface.key || `surface:${index}`;
    throw new Error(`Lighting surface "${label}" requires a source/image/canvas or a valid Phaser texture key; gray fallback is forbidden.`);
  }
  const depth = finite(surface.depth ?? surface.renderDepth ?? surface.layerDepth, -90);
  const polygon = Array.isArray(surface.polygon) ? surface.polygon.map(point => ({
    x: finite(point.x ?? point[0]),
    y: finite(point.y ?? point[1])
  })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)) : null;
  return {
    id: surface.id || `surface:${index}`,
    x,
    y,
    width,
    height,
    sampleStep: clamp(finite(surface.sampleStep ?? surface.resolution, DEFAULT_SAMPLE_STEP), 1, 32),
    localWidth: Math.max(1, Math.ceil(width / clamp(finite(surface.sampleStep ?? surface.resolution, DEFAULT_SAMPLE_STEP), 1, 32))),
    localHeight: Math.max(1, Math.ceil(height / clamp(finite(surface.sampleStep ?? surface.resolution, DEFAULT_SAMPLE_STEP), 1, 32))),
    depth,
    alpha: clamp(finite(surface.alpha, 1), 0, 1),
    reflectance: clamp(finite(surface.reflectance, 1), 0, 2),
    receiveShadow: surface.receiveShadow !== false,
    receiveLight: surface.receiveLight !== false,
    polygon,
    source
  };
}

function sanitizeOccluder(occluder, index) {
  if (!occluder || typeof occluder !== 'object') return null;
  const shape = occluder.shape || (Array.isArray(occluder.points) || Array.isArray(occluder.polygon) ? 'polygon' : 'rect');
  let points = [];
  if (shape === 'polygon') {
    points = (occluder.points || occluder.polygon || []).map(point => ({
      x: finite(point.x ?? point[0]),
      y: finite(point.y ?? point[1])
    })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  } else if (shape === 'circle') {
    const x = finite(occluder.x);
    const y = finite(occluder.y);
    const radius = positive(occluder.radius ?? occluder.r, 0);
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * 2 * i / 10;
      points.push({ x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius });
    }
  } else {
    const x = finite(occluder.x);
    const y = finite(occluder.y);
    const width = positive(occluder.width ?? occluder.w, 0);
    const height = positive(occluder.height ?? occluder.h, 0);
    points = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
  }
  if (points.length < 3) return null;
  const bounds = boundsOf(points);
  return {
    id: occluder.id || `occluder:${index}`,
    points,
    bounds,
    height: clamp(finite(occluder.heightScale ?? occluder.castHeight ?? occluder.height, 1), 0, 4),
    shadow: clamp(finite(occluder.shadow, 1), 0, 1),
    blocksLight: occluder.blocksLight !== false,
    castsShadow: occluder.castsShadow !== false
  };
}

function sanitizeLight(light, index) {
  if (!light || typeof light !== 'object') return null;
  const radius = finite(light.radius ?? light.r, 0);
  if (!Number.isFinite(radius) || radius <= EPS) return null;
  return {
    id: light.id || `light:${index}`,
    x: finite(light.x),
    y: finite(light.y),
    radius: clamp(radius, 1, 1200),
    intensity: clamp(finite(light.intensity, 1), 0, 4),
    color: parseColor(light.color || light.tint || '#ffd28a'),
    pulse: clamp(finite(light.pulse, 0), 0, 1),
    flickerHz: clamp(finite(light.flickerHz ?? light.flicker, 0), 0, 30),
    material: light.material || 'warm',
    shadow: light.castShadow === false ? 0 : clamp(finite(light.shadow, 1), 0, 1)
  };
}

function normalize(vector, fallback = { x: 1, y: 0 }) {
  const x = finite(vector?.x, fallback.x);
  const y = finite(vector?.y, fallback.y);
  const len = Math.hypot(x, y);
  if (!Number.isFinite(len) || len <= EPS) return { ...fallback };
  return { x: x / len, y: y / len };
}

function sanitizeAmbient(ambient) {
  const input = ambient && typeof ambient === 'object' ? ambient : {};
  const directional = input.directional && typeof input.directional === 'object' ? input.directional : null;
  const dir = directional ? normalize({
    x: finite(directional.x, finite(directional.dx, -0.6)),
    y: finite(directional.y, finite(directional.dy, 0.8))
  }, { x: -0.6, y: 0.8 }) : null;
  return {
    color: parseColor(input.color || '#6f7b74', { r: 111, g: 123, b: 116 }),
    intensity: clamp(finite(input.intensity, 0.42), 0, 1.5),
    shadow: clamp(finite(input.shadow, 0.36), 0, 1),
    directional: dir ? {
      x: dir.x,
      y: dir.y,
      strength: clamp(finite(directional.strength, 0.35), 0, 1),
      length: clamp(finite(directional.length ?? directional.shadowLength, 150), 0, 600)
    } : null
  };
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (crosses) {
      const x = (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || EPS) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

function boundsOf(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

function segmentBoundsHit(a, b, bounds) {
  return Math.max(a.x, b.x) + EPS >= bounds.minX &&
    Math.min(a.x, b.x) - EPS <= bounds.maxX &&
    Math.max(a.y, b.y) + EPS >= bounds.minY &&
    Math.min(a.y, b.y) - EPS <= bounds.maxY;
}

function ccw(a, b, c) {
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(area) <= EPS ? 0 : Math.sign(area);
}

function onSegment(a, b, p) {
  return Math.min(a.x, b.x) - EPS <= p.x && p.x <= Math.max(a.x, b.x) + EPS &&
    Math.min(a.y, b.y) - EPS <= p.y && p.y <= Math.max(a.y, b.y) + EPS &&
    ccw(a, b, p) === 0;
}

function segmentsIntersect(a, b, c, d) {
  const d1 = ccw(a, b, c);
  const d2 = ccw(a, b, d);
  const d3 = ccw(c, d, a);
  const d4 = ccw(c, d, b);
  if (d1 === 0 && onSegment(a, b, c)) return true;
  if (d2 === 0 && onSegment(a, b, d)) return true;
  if (d3 === 0 && onSegment(c, d, a)) return true;
  if (d4 === 0 && onSegment(c, d, b)) return true;
  return d1 !== d2 && d3 !== d4;
}

function segmentHitsPolygon(a, b, polygon) {
  if (pointInPolygon(a, polygon)) return false;
  if (pointInPolygon(b, polygon)) return true;
  for (let i = 0; i < polygon.length; i++) {
    const c = polygon[i];
    const d = polygon[(i + 1) % polygon.length];
    if (segmentsIntersect(a, b, c, d)) return true;
  }
  return false;
}

function lightVisibleAt(point, light, occluders) {
  if (Math.hypot(point.x - light.x, point.y - light.y) > light.radius + EPS) return false;
  const from = { x: light.x, y: light.y };
  for (const occluder of occluders) {
    if (occluder.blocksLight && segmentBoundsHit(from, point, occluder.bounds) && segmentHitsPolygon(from, point, occluder.points)) return false;
  }
  return true;
}

function directionalBlocked(point, directional, occluders) {
  return directionalBlockerHeight(point, directional, occluders) > 0;
}

function directionalBlockerHeight(point, directional, occluders) {
  if (!directional?.strength || !directional.length) return 0;
  const from = { x: point.x - directional.x * directional.length, y: point.y - directional.y * directional.length };
  let height = 0;
  for (const occluder of occluders) {
    if (!occluder.castsShadow || occluder.height <= 0) continue;
    const scaledFrom = { x: point.x - directional.x * directional.length * occluder.height, y: point.y - directional.y * directional.length * occluder.height };
    if ((segmentBoundsHit(scaledFrom, point, occluder.bounds) && segmentHitsPolygon(scaledFrom, point, occluder.points)) ||
      (segmentBoundsHit(from, point, occluder.bounds) && segmentHitsPolygon(from, point, occluder.points))) {
      height = Math.max(height, occluder.height);
    }
  }
  return height;
}

function localPoint(surface, lx, ly) {
  return {
    x: surface.x + (lx + 0.5) / surface.localWidth * surface.width,
    y: surface.y + (ly + 0.5) / surface.localHeight * surface.height
  };
}

function surfaceContainsLocal(surface, lx, ly) {
  if (!surface.polygon?.length) return true;
  return pointInPolygon(localPoint(surface, lx, ly), surface.polygon);
}

function lightPulse(light, timeMs) {
  return light.pulse && light.flickerHz
    ? 1 + Math.sin(timeMs * light.flickerHz * Math.PI * 2 / 1000) * light.pulse
    : 1;
}

function addLitColor(target, source, lightColor, scalar) {
  target.r += source.r * (lightColor.r / 255) * scalar;
  target.g += source.g * (lightColor.g / 255) * scalar;
  target.b += source.b * (lightColor.b / 255) * scalar;
}

export function sampleLightingPixel({ source, point, surface, lights = [], occluders = [], ambient = {}, timeMs = 0 }) {
  return sampleLightingPixelNormalized({
    source,
    point,
    surface,
    lights: lights.map((light, index) => sanitizeLight(light, index)).filter(Boolean).slice(0, MAX_LIGHTS),
    occluders: occluders.map((occluder, index) => sanitizeOccluder(occluder, index)).filter(Boolean),
    ambient: sanitizeAmbient(ambient),
    timeMs
  });
}

function sampleLightingPixelNormalized({ source, point, surface, lights, occluders, ambient, timeMs = 0, includeVisibleLights = true }) {
  const src = {
    r: clamp(finite(source?.r), 0, 255),
    g: clamp(finite(source?.g), 0, 255),
    b: clamp(finite(source?.b), 0, 255),
    a: clamp(finite(source?.a, 255), 0, 255)
  };
  const surf = {
    reflectance: clamp(finite(surface?.reflectance, 1), 0, 2),
    receiveLight: surface?.receiveLight !== false,
    receiveShadow: surface?.receiveShadow !== false
  };
  const cleanLights = lights;
  const cleanOccluders = occluders;
  const cleanAmbient = ambient;
  const p = { x: finite(point?.x), y: finite(point?.y) };
  const lit = { r: 0, g: 0, b: 0 };
  let energy = 0;

  if (src.a > 0 && surf.receiveLight) {
    const ambientScalar = cleanAmbient.intensity * 0.18 * surf.reflectance;
    if (ambientScalar > EPS) {
      addLitColor(lit, src, cleanAmbient.color, ambientScalar);
      energy += ambientScalar;
    }
    if (cleanAmbient.directional?.strength && !directionalBlocked(p, cleanAmbient.directional, cleanOccluders)) {
      const scalar = cleanAmbient.directional.strength * 0.45 * surf.reflectance;
      addLitColor(lit, src, cleanAmbient.color, scalar);
      energy += scalar;
    }
    for (const light of cleanLights) {
      if (!lightVisibleAt(p, light, cleanOccluders)) continue;
      const d = Math.hypot(p.x - light.x, p.y - light.y);
      const falloff = (1 - clamp(d / light.radius, 0, 1)) ** 2;
      const scalar = falloff * light.intensity * lightPulse(light, finite(timeMs)) * surf.reflectance;
      if (scalar <= EPS) continue;
      addLitColor(lit, src, light.color, scalar);
      energy += scalar;
    }
  }

  let shadowAlpha = 0;
  if (src.a > 0 && surf.receiveShadow) {
    if (cleanAmbient.shadow > EPS) shadowAlpha += cleanAmbient.shadow * 0.16;
    const directionalHeight = directionalBlockerHeight(p, cleanAmbient.directional, cleanOccluders);
    if (cleanAmbient.directional?.strength && directionalHeight > 0) {
      shadowAlpha += cleanAmbient.directional.strength * 0.55 * clamp(directionalHeight, 0, 4);
    }
    for (const light of cleanLights) {
      if (!light.shadow || lightVisibleAt(p, light, cleanOccluders)) continue;
      const d = Math.hypot(p.x - light.x, p.y - light.y);
      if (d <= light.radius) shadowAlpha += (1 - d / light.radius) * light.shadow * 0.45;
    }
  }

  return {
    light: {
      r: Math.round(clamp(lit.r, 0, 255)),
      g: Math.round(clamp(lit.g, 0, 255)),
      b: Math.round(clamp(lit.b, 0, 255)),
      a: Math.round(clamp(src.a * Math.min(1, energy * 0.75), 0, 255))
    },
    shadow: {
      r: 0,
      g: 0,
      b: 0,
      a: Math.round(clamp(src.a * shadowAlpha, 0, 230))
    },
    visibleLights: includeVisibleLights ? cleanLights.filter(light => lightVisibleAt(p, light, cleanOccluders)).map(light => light.id) : undefined
  };
}

function drawSourceToCanvas(ctx, surface) {
  ctx.clearRect(0, 0, surface.localWidth, surface.localHeight);
  ctx.save();
  if (surface.polygon?.length) {
    ctx.beginPath();
    const first = surface.polygon[0];
    ctx.moveTo((first.x - surface.x) / surface.width * surface.localWidth, (first.y - surface.y) / surface.height * surface.localHeight);
    for (let i = 1; i < surface.polygon.length; i++) {
      const point = surface.polygon[i];
      ctx.lineTo((point.x - surface.x) / surface.width * surface.localWidth, (point.y - surface.y) / surface.height * surface.localHeight);
    }
    ctx.closePath();
    ctx.clip?.();
  }
  ctx.globalAlpha = surface.alpha;
  ctx.drawImage(
    surface.source.image,
    surface.source.sx,
    surface.source.sy,
    surface.source.sw,
    surface.source.sh,
    0,
    0,
    surface.localWidth,
    surface.localHeight
  );
  ctx.restore();
}

function makeTexture(scene, key, width, height) {
  const textures = scene?.textures;
  if (!textures) throw new Error('createLighting requires scene.textures.');
  if (textures.exists?.(key)) textures.remove?.(key);
  let texture = textures.createCanvas?.(key, width, height);
  let canvas = texture?.canvas || texture?.getSourceImage?.() || texture?.source?.[0]?.image || texture?.source?.[0]?.canvas;
  if (!texture || !canvas) {
    canvas = makeCanvas(width, height);
    texture = textures.addCanvas?.(key, canvas);
  }
  if (!texture) throw new Error('createLighting could not create Phaser CanvasTexture.');
  canvas = texture.canvas || texture.getSourceImage?.() || texture.source?.[0]?.image || texture.source?.[0]?.canvas || canvas;
  const ctx = texture.context || getContext(canvas);
  return { key, texture, canvas, ctx };
}

function makeImage(scene, key, surface, depth, mode) {
  const image = scene?.add?.image?.(surface.x, surface.y, key);
  if (!image) throw new Error('createLighting requires scene.add.image.');
  image.setOrigin?.(0, 0);
  image.setScrollFactor?.(1, 1);
  image.setPosition?.(surface.x, surface.y);
  image.setDisplaySize?.(surface.width, surface.height);
  image.setDepth?.(depth);
  image.setBlendMode?.(mode);
  image.setVisible?.(true);
  return image;
}

function putPixels(ctx, width, height, pixels) {
  let imageData;
  if (typeof ImageData !== 'undefined') imageData = new ImageData(pixels, width, height);
  else if (ctx.createImageData) {
    imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
  } else {
    imageData = { data: pixels, width, height };
  }
  ctx.putImageData(imageData, 0, 0);
}

function buildSurfaceEntry(scene, surface, prefix, index, created) {
  const material = makeCanvas(surface.localWidth, surface.localHeight);
  const materialCtx = getContext(material);
  drawSourceToCanvas(materialCtx, surface);
  const sourceData = materialCtx.getImageData(0, 0, surface.localWidth, surface.localHeight).data;
  const light = makeTexture(scene, `${prefix}:light:${index}`, surface.localWidth, surface.localHeight);
  created.keys.push(light.key);
  const shadow = makeTexture(scene, `${prefix}:shadow:${index}`, surface.localWidth, surface.localHeight);
  created.keys.push(shadow.key);
  const lightImage = makeImage(scene, light.key, surface, surface.depth + 0.03, blend(scene, 'ADD', 'ADD'));
  created.images.push(lightImage);
  const shadowImage = makeImage(scene, shadow.key, surface, surface.depth + 0.02, blend(scene, 'MULTIPLY', 'MULTIPLY'));
  created.images.push(shadowImage);
  const entry = {
    surface,
    sourceData,
    light,
    shadow,
    lightPixels: new Uint8ClampedArray(surface.localWidth * surface.localHeight * 4),
    shadowPixels: new Uint8ClampedArray(surface.localWidth * surface.localHeight * 4),
    lightImage,
    shadowImage
  };
  return entry;
}

function renderEntry(entry, cleanLights, cleanOccluders, cleanAmbient, timeMs) {
  const { surface } = entry;
  entry.lightPixels.fill(0);
  entry.shadowPixels.fill(0);
  for (let y = 0; y < surface.localHeight; y++) {
    for (let x = 0; x < surface.localWidth; x++) {
      if (!surfaceContainsLocal(surface, x, y)) continue;
      const offset = (y * surface.localWidth + x) * 4;
      const source = {
        r: entry.sourceData[offset],
        g: entry.sourceData[offset + 1],
        b: entry.sourceData[offset + 2],
        a: entry.sourceData[offset + 3]
      };
      if (!source.a) continue;
      const sample = sampleLightingPixelNormalized({
        source,
        point: localPoint(surface, x, y),
        surface,
        lights: cleanLights,
        occluders: cleanOccluders,
        ambient: cleanAmbient,
        timeMs,
        includeVisibleLights: false
      });
      entry.lightPixels[offset] = sample.light.r;
      entry.lightPixels[offset + 1] = sample.light.g;
      entry.lightPixels[offset + 2] = sample.light.b;
      entry.lightPixels[offset + 3] = sample.light.a;
      entry.shadowPixels[offset] = 0;
      entry.shadowPixels[offset + 1] = 0;
      entry.shadowPixels[offset + 2] = 0;
      entry.shadowPixels[offset + 3] = sample.shadow.a;
    }
  }
  putPixels(entry.light.ctx, surface.localWidth, surface.localHeight, entry.lightPixels);
  putPixels(entry.shadow.ctx, surface.localWidth, surface.localHeight, entry.shadowPixels);
  entry.light.texture.refresh?.();
  entry.shadow.texture.refresh?.();
}

export function createLighting(scene, { surfaces = [], occluders = [], width = 1, height = 1, keyPrefix = DEFAULT_KEY_PREFIX } = {}) {
  const w = Math.max(1, Math.ceil(positive(width)));
  const h = Math.max(1, Math.ceil(positive(height)));
  const prefix = `${keyPrefix}:${++instanceId}`;
  const created = { keys: [], images: [] };
  let entries = [];
  let shutdownHandler = null;
  let enabled = true;
  let destroyed = false;
  let lastSignature = '';

  const cleanup = () => {
    for (const image of created.images.splice(0)) image.destroy?.();
    for (const key of created.keys.splice(0)) scene?.textures?.remove?.(key);
    entries = [];
  };

  try {
    const cleanSurfaces = surfaces.map((surface, index) => sanitizeSurface(scene, surface, index)).filter(Boolean);
    const cleanOccluders = occluders.map((occluder, index) => sanitizeOccluder(occluder, index)).filter(Boolean);
    entries = cleanSurfaces.map((surface, index) => buildSurfaceEntry(scene, surface, prefix, index, created));

    const setImagesVisible = value => {
      for (const entry of entries) {
        entry.lightImage.setVisible?.(value);
        entry.shadowImage.setVisible?.(value);
      }
    };

    const api = {
      update({ timeMs = 0, lights = [], ambient = {} } = {}) {
        if (destroyed) return api;
        const now = finite(timeMs, 0);
        const cleanLights = lights.map((light, index) => sanitizeLight(light, index)).filter(Boolean).slice(0, MAX_LIGHTS);
        const cleanAmbient = sanitizeAmbient(ambient);
        const signature = JSON.stringify({
          enabled,
          now,
          ambient: cleanAmbient,
          lights: cleanLights.map(light => [light.x, light.y, light.radius, light.intensity, light.color.r, light.color.g, light.color.b, light.pulse, light.flickerHz, light.shadow])
        });
        if (signature === lastSignature) return api;
        lastSignature = signature;
        setImagesVisible(enabled);
        if (!enabled) return api;
        for (const entry of entries) renderEntry(entry, cleanLights, cleanOccluders, cleanAmbient, now);
        return api;
      },
      setEnabled(value) {
        if (destroyed) return api;
        enabled = !!value;
        setImagesVisible(enabled);
        lastSignature = '';
        return api;
      },
      setSurfaceOpacity(id, alpha) {
        if (destroyed) return api;
        if (!Number.isFinite(alpha)) throw new RangeError('Surface opacity must be finite');
        const opacity = clamp(alpha, 0, 1);
        for (const entry of entries) {
          if (entry.surface.id !== id) continue;
          entry.opacity = opacity;
          entry.lightImage.setAlpha(opacity);
          entry.shadowImage.setAlpha(opacity);
        }
        return api;
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (shutdownHandler && scene?.events?.off) scene.events.off('shutdown', shutdownHandler);
        cleanup();
      },
      get debug() {
        return Object.freeze({
          rendererType: scene?.game?.renderer?.type ?? scene?.sys?.game?.renderer?.type ?? null,
          width: w,
          height: h,
          surfaces: cleanSurfaces.length,
          occluders: cleanOccluders.length,
          textureKeys: created.keys.slice(),
          entries: entries.map(entry => Object.freeze({
            id: entry.surface.id,
            x: entry.surface.x,
            y: entry.surface.y,
            width: entry.surface.localWidth,
            height: entry.surface.localHeight,
            depth: entry.surface.depth,
            opacity: entry.opacity ?? 1
          })),
          enabled,
          destroyed
        });
      }
    };

    shutdownHandler = () => api.destroy();
    if (scene?.events?.once) scene.events.once('shutdown', shutdownHandler);
    return api;
  } catch (error) {
    cleanup();
    throw error;
  }
}

export const __lightingInternals = Object.freeze({
  MAX_LIGHTS,
  finite,
  normalize,
  parseColor,
  sanitizeLight,
  sanitizeAmbient,
  sanitizeOccluder,
  sanitizeSurface,
  pointInPolygon,
  segmentsIntersect,
  segmentHitsPolygon,
  lightVisibleAt,
  directionalBlocked
});
