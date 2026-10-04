// Rectangles are the Meowa segmentation output, including its transparent padding.
export const ATLASES = Object.freeze({
  panels: { path: '../assets/ui13/panels.png', width: 2048, height: 2048 },
  icons: { path: '../assets/ui13/icons.png', width: 1024, height: 1024 }
});
export const PARTS = Object.freeze({
  panel: { atlas: 'panels', rect: [80, 80, 1970, 771], inset: 100 },
  button: { atlas: 'panels', rect: [98, 877, 491, 1265], inset: 70 },
  bar: { atlas: 'panels', rect: [613, 927, 1972, 1072], inset: 50 },
  fill: { atlas: 'panels', rect: [613, 1124, 1956, 1251] },
  ring: { atlas: 'panels', rect: [75, 1330, 681, 1934] },
  thumb: { atlas: 'panels', rect: [743, 1482, 1061, 1799] },
  backpack: { atlas: 'icons', rect: [20, 215, 256, 475] },
  hammer: { atlas: 'icons', rect: [277, 216, 508, 481] },
  character: { atlas: 'icons', rect: [516, 211, 753, 485] },
  settings: { atlas: 'icons', rect: [764, 222, 1014, 471] },
  water: { atlas: 'icons', rect: [36, 535, 230, 801] },
  fire: { atlas: 'icons', rect: [283, 530, 487, 803] },
  wind: { atlas: 'icons', rect: [514, 574, 761, 788] },
  earth: { atlas: 'icons', rect: [771, 556, 1003, 802] }
});
export const LIVE_IDS = Object.freeze(['loading-progress', 'loading-percent', 'minimap-canvas', 'hp', 'mp', 'ready', 'charging', 'charging-progress']);
export const LABEL_SAMPLES = Object.freeze({ zh: ['水弹', '原创咏唱演出', '继续旅途'], ja: ['ウォーターボール', 'オリジナル詠唱演出', '旅に戻る'] });

export function waterCastLabels(locale) {
  return locale.startsWith('ja')
    ? { label: '水魔術をチャージ', title: '成形して保持' }
    : { label: '水术蓄力', title: '塑形并保持' };
}

export function nineSlice(rect, inset, width, height, corner = 9) {
  if (!(width > 0 && height > 0 && inset > 0)) throw new RangeError('Invalid slice size');
  const [x, y, right, bottom] = rect;
  const sw = right - x, sh = bottom - y;
  if (2 * inset >= Math.min(sw, sh)) throw new RangeError('Invalid source inset');
  const edge = Math.min(corner, width / 2, height / 2);
  const sx = [x, x + inset, right - inset], sy = [y, y + inset, bottom - inset];
  const ssx = [inset, sw - 2 * inset, inset], ssy = [inset, sh - 2 * inset, inset];
  const dx = [0, edge, width - edge], dy = [0, edge, height - edge];
  const dsx = [edge, width - 2 * edge, edge], dsy = [edge, height - 2 * edge, edge];
  return sy.flatMap((_, row) => sx.map((_, col) => ({
    source: [sx[col], sy[row], ssx[col], ssy[row]],
    target: [dx[col], dy[row], dsx[col], dsy[row]]
  })));
}

// These CSS geometry tokens are tested without importing the game or a DOM.
export function layoutForViewport(width, height, expanded = false, touch = width <= 600 || height <= 480) {
  const compact = width <= 600 || height <= 480;
  const portrait = width <= 600 && height > width;
  const landscape = height <= 480;
  const narrow = width <= 350;
  const dockWidth = 52, dockHeight = 196;
  const dockBottom = compact ? 132 : 12;
  const dockRight = compact ? (portrait ? 12 : 68) : (touch ? 132 : 12);
  const mapDiameter = compact ? 104 : 112;
  const box = (x, y, w, h) => ({ x, y, width: w, height: h });
  return {
    ...(touch ? { stick: box(12, height - 120, 108, 108), aim: box(width - 120, height - 120, 108, 108) } : {}),
    vitals: box(12, 12, compact ? 112 : 160, compact ? 64 : 66),
    map: box(12, 88, mapDiameter, mapDiameter),
    skills: box(width - dockRight - dockWidth, height - dockBottom - dockHeight, dockWidth, dockHeight),
    utilities: box(width - 56, landscape && !portrait ? 58 : 64, 44, landscape && !portrait ? 136 : 144),
    ...(expanded ? { major: box(width - dockRight - dockWidth - 48, height - dockBottom - 48, 44, 44) } : {}),
    ...(touch ? {
      dodge: box(narrow ? width / 2 - 22 : width / 2 - 64, height - (narrow ? 104 : 60), narrow ? 44 : 60, 44),
      interact: box(narrow ? width / 2 - 22 : width / 2 + 4, height - (narrow ? 56 : 60), narrow ? 44 : 60, 44)
    } : {})
  };
}

const FRAMES = {
  '.loading-inner,.vitals,.place,#skill-dock,.menu-inner,#dialog>div,#message,#charging': 'panel',
  'button,select,input[type="checkbox"]': 'button',
  '.meter,.loading-track,#charging>div,input[type="range"]': 'bar'
};
const SPRITES = {
  '#loading-progress,#hp,#mp,#ready,#charging-progress': 'fill',
  '#stick,#aim-pad,#minimap': 'ring', '#stick>i': 'thumb'
};

async function mountSkin() {
  const images = {};
  await Promise.all(Object.entries(ATLASES).map(async ([id, atlas]) => {
    const image = new Image();
    image.src = new URL(atlas.path, import.meta.url).href;
    await image.decode();
    if (image.naturalWidth !== atlas.width || image.naturalHeight !== atlas.height) throw new Error('Atlas dimensions: ' + id);
    images[id] = image;
  }));
  const sprites = new Map();
  function sprite(name) {
    if (sprites.has(name)) return sprites.get(name);
    const part = PARTS[name], [x, y, r, b] = part.rect;
    const canvas = document.createElement('canvas');
    canvas.width = r - x; canvas.height = b - y;
    canvas.getContext('2d').drawImage(images[part.atlas], x, y, r - x, b - y, 0, 0, r - x, b - y);
    const url = `url("${canvas.toDataURL()}")`;
    sprites.set(name, url);
    return url;
  }
  for (const [selector, name] of Object.entries(SPRITES)) {
    document.querySelectorAll(selector).forEach(el => el.style.setProperty('--meowa-sprite', sprite(name)));
  }
  const iconTargets = [['#menu', 'settings'], ['#water-cast', 'water'], ['#aim-pad', 'water']];
  ['backpack', 'hammer', 'character'].forEach((name, i) => iconTargets.push([`#utility-rail button:nth-child(${i + 1})`, name]));
  ['fire', 'wind', 'earth'].forEach((name, i) => iconTargets.push([`#skill-reserve button:nth-child(${i + 1})`, name]));
  for (const [selector, name] of iconTargets) {
    const host = document.querySelector(selector);
    if (!host) continue;
    const old = host.querySelector('[data-lucide],svg');
    const icon = document.createElement('span');
    icon.className = 'meowa-icon'; icon.setAttribute('aria-hidden', 'true');
    icon.dataset.meowaIcon = name;
    icon.style.setProperty('--meowa-sprite', sprite(name));
    if (old) old.replaceWith(icon); else host.prepend(icon);
  }
  const labels = [];
  const waterHost = document.querySelector('#water-cast');
  const shortWaterLabel = document.createElement('span');
  shortWaterLabel.className = 'portrait-water-label';
  shortWaterLabel.setAttribute('aria-hidden', 'true');
  waterHost?.append(shortWaterLabel);
  document.querySelectorAll('#skill-reserve button').forEach(button => {
    const label = document.createElement('span');
    label.className = 'reserve-label'; button.append(label); labels.push([button, label]);
  });
  const localize = () => {
    const ja = document.documentElement.lang.startsWith('ja');
    shortWaterLabel.textContent = ja ? '水魔術' : '水术';
    const water = document.querySelector('#water-cast');
    if (water) {
      const text = waterCastLabels(document.documentElement.lang);
      water.setAttribute('aria-label', text.label); water.title = text.title;
    }
    labels.forEach(([button, label]) => { label.textContent = button.dataset[ja ? 'uiJa' : 'uiZh']; });
    for (const [selector, zh, jp] of [['#skill-dock', '魔术', '魔術'], ['#skill-reserve', '技能栏', 'スキル'], ['#utility-rail', '角色菜单', 'キャラクターメニュー'], ['#menu', '设置', '設定']]) {
      const el = document.querySelector(selector);
      if (el) { el.setAttribute('aria-label', ja ? jp : zh); if (el.tagName === 'BUTTON') el.title = ja ? jp : zh; }
    }
    const chapter = document.querySelector('.loading-inner p');
    if (chapter) chapter.textContent = ja ? '初旅の章' : '初行之章';
  };
  localize();
  new MutationObserver(localize).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // Backgrounds survive the game's textContent updates; never observe live meter widths.
  const frames = new Map(), sizes = new WeakMap();
  for (const [selector, name] of Object.entries(FRAMES)) {
    document.querySelectorAll(selector).forEach(el => {
      frames.set(el, name); el.classList.add('meowa-surface');
      el.style.backgroundImage = 'var(--meowa-surface)';
      el.style.backgroundSize = '100% 100%'; el.style.backgroundRepeat = 'no-repeat';
    });
  }
  const paint = el => {
    const bounds = el.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const width = Math.round(bounds.width), height = Math.round(bounds.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${width}:${height}:${dpr}`;
    if (sizes.get(el) === key) return;
    const part = PARTS[frames.get(el)];
    const canvas = document.createElement('canvas');
    canvas.width = width * dpr; canvas.height = height * dpr;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    for (const slice of nineSlice(part.rect, part.inset, width, height, frames.get(el) === 'bar' ? Math.min(5, height / 2) : 9)) {
      if (slice.target[2] && slice.target[3]) ctx.drawImage(images[part.atlas], ...slice.source, ...slice.target);
    }
    el.style.setProperty('--meowa-surface', `url("${canvas.toDataURL()}")`);
    sizes.set(el, key);
  };
  const observer = new ResizeObserver(entries => entries.forEach(({ target }) => paint(target)));
  frames.forEach((_, el) => { observer.observe(el); paint(el); });
  document.documentElement.dataset.meowaSkin = 'ready';
}

if (typeof document !== 'undefined') {
  mountSkin().catch(error => {
    document.documentElement.dataset.meowaSkin = 'error';
    console.warn('Meowa UI skin unavailable:', error.message);
  });
}
