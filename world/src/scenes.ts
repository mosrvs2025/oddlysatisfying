import { World } from './engine/world.ts';
import { M } from './engine/materials.ts';

export type SceneId = 'valley' | 'empty' | 'lab';

/** Pick a grid that fills the screen with about `cells` cells. */
export function sizeFor(aspect: number, cells = 64000) {
  const w = Math.round(Math.sqrt(cells * aspect)), h = Math.round(cells / Math.max(1, w));
  return { w: Math.max(96, Math.min(420, w)), h: Math.max(96, Math.min(420, h)) };
}

export function makeScene(id: SceneId, w: number, h: number, seed: number): World {
  const W = new World(w, h, seed);
  const set = (x: number, y: number, m: number) => { if (W.inside(x, y)) W.spawn(y * w + x, m); };
  const r = () => W.rf();
  if (id === 'empty') return W;
  if (id === 'lab') {
    // a floor and a few things to wire up
    for (let x = 0; x < w; x++) for (let y = h - 6; y < h; y++) set(x, y, M.Stone);
    for (let x = 12; x < w - 12; x++) set(x, h - 20, M.Metal);
    for (let y = h - 26; y < h - 20; y++) { set(10, y, M.Battery); set(11, y, M.Battery); }
    for (let x = w - 40; x < w - 14; x++) for (let y = h - 12; y < h - 6; y++) set(x, y, M.Water);
    for (let x = 30; x < 50; x++) for (let y = h - 30; y < h - 21; y++) set(x, y, M.Gunpowder);
    return W;
  }
  // valley: bedrock, rolling soil, a pond, a beach, a log, seeds, and a warm vent deep down
  const p1 = r() * 6, p2 = r() * 6, pond = w * (.3 + r() * .4);
  const ground: number[] = [];
  for (let x = 0; x < w; x++) {
    const u = x / w;
    let g = h * (h > w * 1.3 ? .5 : .6) + Math.sin(u * 5.1 + p1) * h * .06 + Math.sin(u * 13 + p2) * h * .02;
    const d = (x - pond) / (w * .14);
    if (Math.abs(d) < 1) g += (1 - d * d) * h * .14;           // the pond basin
    ground.push(Math.round(g));
  }
  const rock = (x: number) => Math.round(h * (h > w * 1.3 ? .7 : .8) + Math.sin(x * .07 + p1) * 4);
  for (let x = 0; x < w; x++) {
    const g = ground[x], rk = rock(x);
    for (let y = g; y < h; y++) {
      if (y >= rk) set(x, y, M.Stone);
      else if (Math.abs(x - pond) < w * .16 && y < g + 3) set(x, y, M.Sand);
      else if (Math.abs(x - pond) < w * .16 && y < g + 6) set(x, y, M.Stone); // a clay-like bed so the pond does not drain into the soil
      else set(x, y, M.Dirt);
    }
  }
  // water fills the basin up to its lower lip
  const b0 = Math.max(0, Math.round(pond - w * .14)), b1 = Math.min(w - 1, Math.round(pond + w * .14));
  const lip = Math.max(ground[b0], ground[b1]) + 2;
  for (let x = b0; x <= b1; x++) for (let y = lip; y < ground[x]; y++) set(x, y, M.Water);
  // a lava pocket under the rock, sealed by stone
  const lx = Math.round(w * (r() < .5 ? .15 : .8));
  const ly = rock(lx) + 8;
  for (let y = ly - 4; y <= ly + 4; y++) for (let x = lx - 9; x <= lx + 9; x++) if ((x - lx) ** 2 / 81 + (y - ly) ** 2 / 12 < 1) set(x, y, M.Lava);
  // a fallen log on the far bank and seeds on the soil
  const logX = Math.round(pond < w / 2 ? w * .78 : w * .12);
  const logY = Math.min(...ground.slice(logX, logX + 22)) - 1;
  for (let x = logX; x < logX + 22; x++) for (let y = logY - 4; y <= logY; y++) set(x, y, M.Wood);
  for (let x = logX; x < logX + 22; x++) for (let y = logY + 1; y < ground[Math.min(w - 1, x)]; y++) set(x, y, M.Stone);
  for (let k = 0; k < 5; k++) { const x = logX + 4 + k * 3; set(x, logY - 5, M.Bug); }
  for (let k = 0; k < 7; k++) {
    const x = Math.round(w * (.05 + r() * .9));
    if (Math.abs(x - pond) < w * .17 || Math.abs(x - logX - 8) < 10) continue;
    set(x, ground[x] - 1, M.Seed);
    for (let y = ground[x]; y < ground[x] + 5; y++) if (W.mat[y * w + x] === M.Dirt) W.flags[y * w + x] |= 2; // damp soil
  }
  return W;
}
