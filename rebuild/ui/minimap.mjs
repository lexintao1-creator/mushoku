export function mapPoint(point, world, width, height) {
  const scale = Math.min((width - 16) / world.width, (height - 16) / world.height);
  return { x: (width - world.width * scale) / 2 + point.x * scale,
    y: (height - world.height * scale) / 2 + point.y * scale, scale };
}

export function createMinimap(canvas, world) {
  const ctx = canvas.getContext('2d');
  const base = document.createElement('canvas');
  base.width = canvas.width; base.height = canvas.height;
  const g = base.getContext('2d'), point = ([x, y]) => mapPoint({ x, y }, world, base.width, base.height);
  g.fillStyle = '#253d32'; g.fillRect(0, 0, base.width, base.height);
  for (const river of world.water) {
    g.beginPath(); river.points.forEach((p, i) => { const v = point(p); i ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y); });
    g.closePath(); g.fillStyle = '#397783'; g.fill();
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const route of world.routes) {
    if (route.material === 'road-verge') continue;
    g.beginPath(); route.points.forEach((p, i) => { const v = point(p); i ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y); });
    g.strokeStyle = '#8b9683'; g.lineWidth = route.width * point([0, 0]).scale; g.stroke();
  }
  for (const prop of world.props.filter(p => p.asset === 'town')) {
    const v = point([prop.x, prop.y]);
    g.fillStyle = '#c3b992'; g.strokeStyle = '#162820'; g.lineWidth = 2;
    const w = prop.w * .7 * v.scale, h = prop.h * .42 * v.scale;
    g.fillRect(v.x - w / 2, v.y - h, w, h); g.strokeRect(v.x - w / 2, v.y - h, w, h);
  }
  let previous = -Infinity;
  return { update(player, timeMs) {
    if (timeMs - previous < 80) return;
    previous = timeMs;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(base, 0, 0);
    const v = mapPoint(player, world, canvas.width, canvas.height);
    ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(Math.atan2(player.aim.y, player.aim.x));
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -5); ctx.lineTo(-3, 0); ctx.lineTo(-6, 5); ctx.closePath();
    ctx.fillStyle = '#f4f4dc'; ctx.strokeStyle = '#102921'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fill(); ctx.restore();
  } };
}
