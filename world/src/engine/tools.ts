import { World } from './world.ts';
import { M, MATS, PHASE, Phase, CONDUCTIVE } from './materials.ts';

/** Every way a player can touch the world. All of them go through the same deterministic RNG. */
export type ToolId = 'paint' | 'erase' | 'heat' | 'cool' | 'wind' | 'bolt' | 'bomb' | 'rain' | 'gravity' | 'time';

export function disc(world: World, cx: number, cy: number, r: number, f: (i: number, x: number, y: number, d: number) => void) {
  const R = Math.max(0, r), r2 = (R + .5) * (R + .5);
  for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(world.h - 1, Math.ceil(cy + R)); y++)
    for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(world.w - 1, Math.ceil(cx + R)); x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2; if (d2 <= r2) f(y * world.w + x, x, y, Math.sqrt(d2));
    }
}

export function paint(world: World, x: number, y: number, r: number, m: number, overwrite = false) {
  const sparse = PHASE[m] === Phase.Powder || PHASE[m] === Phase.Liquid || PHASE[m] === Phase.Gas || m === M.Bug || m === M.Seed;
  disc(world, x, y, r, (i) => {
    const t = world.mat[i];
    if (t === m) return;
    if (t !== M.Empty && !overwrite) return;
    if (MATS[t].indestructible && m !== M.Empty && !overwrite) return;
    if (sparse && r > 0 && world.rnd() % (m === M.Bug || m === M.Seed ? 9 : 3) !== 0) return;
    world.spawn(i, m);
  });
}
export function erase(world: World, x: number, y: number, r: number) {
  disc(world, x, y, r, (i) => { world.clear(i); world.charge[i] = 0; world.temp[i] = world.ambient[(i / world.w) | 0]; });
}
export function heat(world: World, x: number, y: number, r: number, amount: number) {
  disc(world, x, y, r, (i, _x, _y, d) => { world.temp[i] += amount * (1 - d / (r + 1)); });
}
export function wind(world: World, x: number, y: number, r: number, dx: number, dy: number) {
  world.air.push(x, y, r * 1.5 + 4, dx, dy);
}
export function rain(world: World, x: number, r: number) {
  const y = 1, spread = r * 2 + 6;
  for (let k = 0; k < 2 + (r >> 1); k++) {
    const rx = Math.round(x + (world.rf() - .5) * spread);
    if (rx < 0 || rx >= world.w) continue;
    const i = y * world.w + rx;
    if (world.mat[i] === M.Empty) world.spawn(i, M.Water, 8);
  }
}
export function bomb(world: World, x: number, y: number, r: number) {
  world.explode(Math.round(x), Math.round(y), Math.max(4, r + 3), 900);
}
export function gravityWell(world: World, x: number, y: number, r: number) {
  const R = r * 2 + 10;
  world.wells.push({ x, y, r: R });
  for (let k = 0; k < 40; k++) {
    const a = world.rf() * Math.PI * 2, d = Math.sqrt(world.rf()) * R * 2;
    const px = Math.round(x + Math.cos(a) * d), py = Math.round(y + Math.sin(a) * d);
    if (!world.inside(px, py)) continue;
    const i = py * world.w + px, ph = PHASE[world.mat[i]];
    if (ph === Phase.Powder || ph === Phase.Liquid || world.mat[i] === M.Bug) world.debris.launch(world, i, 0, -.5);
  }
}
export function timeWarp(world: World, x: number, y: number, r: number) {
  world.timeZones.push({ x: Math.round(x), y: Math.round(y), r: r * 2 + 6 });
}
/** A jagged bolt from the sky to (x, y). Conductors along the way carry the charge on. */
export function lightning(world: World, x: number, y: number) {
  const pts: number[] = [];
  let cx = x + (world.rf() - .5) * 30, cy = 0;
  const tx = Math.round(x), ty = Math.round(y);
  let hitY = ty;
  while (cy < ty) {
    pts.push(cx, cy);
    const k = ty - cy, step = Math.max(2, Math.min(6, k));
    cy += step; cx += (tx - cx) * (step / Math.max(1, k)) + (world.rf() - .5) * 5;
    const ix = Math.round(cx), iy = Math.round(cy);
    if (world.inside(ix, iy)) {
      const m = world.mat[iy * world.w + ix];
      if (m !== M.Empty && PHASE[m] !== Phase.Gas) { hitY = iy; cx = ix; break; }
    }
  }
  pts.push(cx, hitY);
  world.bolts.push({ pts, t: 0 });
  world.find('lightning');
  const hx = Math.round(cx), hy = Math.min(world.h - 1, hitY);
  disc(world, hx, hy, 3, (i, _x, _y, d) => {
    world.temp[i] += 2600 * (1 - d / 4);
    const m = world.mat[i];
    if (m === M.Sand && d < 3) { world.become(i, M.Glass); world.find('fulgurite'); }
    if (CONDUCTIVE[m] > 0) world.charge[i] = 1;
  });
  world.explode(hx, hy, 3, 300);
}
