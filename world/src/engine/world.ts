import {
  M, MATS, MAT_COUNT, Phase, PHASE, DENSITY, CONDUCT, CAPACITY, HOT, HOT_TO, COLD, COLD_TO, IGNITE, FUEL, BURN_TEMP, BURN_TO,
  EXPLOSIVE, SMOKY, CONDUCTIVE, DISPERSION, BLOWABLE, ACIDPROOF, OPAQUE,
} from './materials.ts';
import { Air } from './air.ts';
import { Debris } from './debris.ts';

// Per-cell flag bits
export const F = { BURN: 1, WET: 2, TIP: 4, DIR: 8, FERT: 16, FLOWER: 32, LEAF: 64 } as const;

export interface Shock { x: number; y: number; r: number; t: number }
export interface Bolt { pts: number[]; t: number }

const N8X = [-1, 0, 1, -1, 1, -1, 0, 1], N8Y = [-1, -1, -1, 0, 0, 1, 1, 1];
const N4X = [0, -1, 1, 0], N4Y = [-1, 0, 0, 1];

export const GENETIC = new Uint8Array(MAT_COUNT);
for (const g of [M.Bug, M.Fish, M.Plant, M.Seed, M.Algae]) GENETIC[g] = 1;
const BURN_FIND: Record<number, string> = { [M.Plant]: 'plant-burn', [M.Fungus]: 'fungus-burn', [M.Bug]: 'bug-burn', [M.Seed]: 'seed-burn' };

/**
 * The whole simulation state lives in flat typed arrays (structure of arrays), one entry per cell.
 * A step is: air -> cells (movement, reactions, life, combustion) -> heat -> electricity -> debris.
 * All randomness comes from one seeded xorshift generator, so a world plus a list of inputs replays exactly.
 */
export class World {
  readonly w: number; readonly h: number; readonly n: number;
  mat: Uint8Array; aux: Uint8Array; life: Uint8Array; flags: Uint8Array; vel: Int8Array;
  temp: Float32Array; charge: Uint8Array; clk: Uint8Array;
  ambient: Float32Array;
  air: Air; debris: Debris;
  gen = 0; tick = 0; seed: number; private s: number;
  found = new Set<string>(); newFinds: string[] = [];
  shocks: Shock[] = []; bolts: Bolt[] = []; sparks: number[] = [];
  wells: { x: number; y: number; r: number }[] = [];
  timeZones: { x: number; y: number; r: number }[] = [];
  /** Spinning storms. They live on their own once started: drift with the wind, lift what they pass over, and spin down. */
  storms: { x: number; y: number; r: number; life: number; spin: number }[] = [];
  stats = { explosions: 0 };
  /** Evolution: chance of a random gene change is 1 in this per trait per birth. Radiation (the Mutate tool) acts directly. */
  mutation = 10;
  /** Cells where a gene just changed, for the renderer to flash. */
  gleams: number[] = [];

  constructor(w: number, h: number, seed = 1) {
    this.w = w; this.h = h; this.n = w * h;
    this.mat = new Uint8Array(this.n); this.aux = new Uint8Array(this.n); this.life = new Uint8Array(this.n);
    this.flags = new Uint8Array(this.n); this.vel = new Int8Array(this.n); this.temp = new Float32Array(this.n);
    this.charge = new Uint8Array(this.n); this.clk = new Uint8Array(this.n);
    this.ambient = new Float32Array(h);
    for (let y = 0; y < h; y++) { const up = 1 - y / (h - 1); this.ambient[y] = 22 - 34 * up * up; } // ~22 C at the floor, ~-12 C at the ceiling
    for (let i = 0; i < this.n; i++) this.temp[i] = this.ambient[(i / w) | 0];
    this.seed = seed >>> 0 || 1; this.s = this.seed;
    this.air = new Air(w, h); this.debris = new Debris();
  }

  // ---------- randomness ----------
  rnd(): number { let x = this.s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.s = x >>> 0; return this.s; }
  one(n: number) { return this.rnd() % n === 0; }
  rf() { return this.rnd() / 4294967296; }
  get rngState() { return this.s; } set rngState(v: number) { this.s = v >>> 0 || 1; }

  /** Report a newborn whose genes have crossed into a new adaptation. */
  evolved(m: number, g: number) {
    const a = g & 15, b = g >> 4;
    switch (m) {
      case M.Bug: if (a >= 8) this.find('evo-coat'); if (b >= 8) this.find('evo-swim'); break;
      case M.Fish: if (a >= 8) this.find('evo-heat'); if (b >= 8) this.find('evo-lungs'); if (b >= 12) this.find('evo-walk'); break;
      case M.Plant: if (a >= 11) this.find('evo-giant'); if (b >= 8) this.find('evo-hardy'); break;
      case M.Algae: if (a >= 8) this.find('evo-fast'); if (b >= 8) this.find('evo-deep'); break;
    }
  }
  find(id: string) { if (!this.found.has(id)) { this.found.add(id); this.newFinds.push(id); } }

  // ---------- cell helpers ----------
  idx(x: number, y: number) { return y * this.w + x; }
  inside(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  /** Put a fresh cell of material m at i (painting, spawning). */
  spawn(i: number, m: number, t?: number) {
    this.mat[i] = m; this.aux[i] = GENETIC[m] ? this.baseGenome(m) : this.rnd() & 255; this.flags[i] = 0; this.vel[i] = 0; this.charge[i] = 0;
    this.life[i] = this.initLife(m);
    const d = MATS[m];
    this.temp[i] = t ?? d.startTemp ?? this.ambient[(i / this.w) | 0];
    this.clk[i] = this.gen;
  }
  /**
   * Genes live in the aux byte of living cells: two 4-bit traits (low nibble, high nibble), see genes.ts.
   * A fresh founder gets a small random genome; children copy a parent's with the odd mutation.
   */
  baseGenome(m: number) {
    const r = () => this.rnd() % 4;
    return m === M.Plant || m === M.Seed ? (2 + (this.rnd() % 3)) | (r() << 4) : r() | (r() << 4);
  }
  mutNibble(v: number, pressure: boolean) {
    if (this.rnd() % (pressure ? 4 : this.mutation) !== 0) return v;
    const d = pressure ? 1 : (this.rnd() & 1) ? 1 : -1, big = this.rnd() % 12 === 0 ? 2 : 1;
    return Math.max(0, Math.min(15, v + d * big));
  }
  /** Genome for a child. `pa` / `pb` say the environment is pushing that trait up (cold for a coat, shade for light-hunger). */
  inherit(parent: number, pa = false, pb = false) {
    return this.mutNibble(parent & 15, pa) | (this.mutNibble(parent >> 4, pb) << 4);
  }
  /** Turn the cell at i into material m, keeping its heat. */
  become(i: number, m: number) {
    this.mat[i] = m; this.flags[i] = 0; this.vel[i] = 0; this.life[i] = this.initLife(m); this.clk[i] = this.gen;
  }
  clear(i: number) { this.mat[i] = M.Empty; this.flags[i] = 0; this.vel[i] = 0; this.life[i] = 0; }
  initLife(m: number) {
    switch (m) {
      case M.Fire: return 18 + (this.rnd() % 26);
      case M.Smoke: return 60 + (this.rnd() % 140);
      case M.Bug: return 220;
      case M.Fish: return 230;
      case M.Plant: return 0;
      default: return 0;
    }
  }
  swap(i: number, j: number) {
    const a = this.mat, b = this.aux, l = this.life, f = this.flags, v = this.vel, t = this.temp;
    let x: number;
    x = a[i]; a[i] = a[j]; a[j] = x; x = b[i]; b[i] = b[j]; b[j] = x; x = l[i]; l[i] = l[j]; l[j] = x;
    x = f[i]; f[i] = f[j]; f[j] = x; x = v[i]; v[i] = v[j]; v[j] = x; x = t[i]; t[i] = t[j]; t[j] = x;
    this.clk[i] = this.gen; this.clk[j] = this.gen;
  }
  /** Light reaches i if nothing opaque sits in the 18 cells above it. */
  lit(i: number) {
    const w = this.w; let j = i - w;
    for (let k = 0; k < 18 && j >= 0; k++, j -= w) if (OPAQUE[this.mat[j]] && this.mat[j] !== M.Plant) return false;
    return true;
  }
  randNeighbor(x: number, y: number): number {
    const k = this.rnd() & 7, nx = x + N8X[k], ny = y + N8Y[k];
    return nx >= 0 && ny >= 0 && nx < this.w && ny < this.h ? ny * this.w + nx : -1;
  }

  // ---------- the step ----------
  step() {
    this.tick++; this.gen = (this.gen + 1) & 255;
    this.air.step(this);
    this.updateCells(0, 0, this.w, this.h);
    this.thermal(0, 0, this.w, this.h);
    this.electric();
    this.debris.step(this);
    if (this.storms.length) this.stepStorms();
    for (const z of this.timeZones) {
      const x0 = Math.max(0, z.x - z.r), y0 = Math.max(0, z.y - z.r), x1 = Math.min(this.w, z.x + z.r), y1 = Math.min(this.h, z.y + z.r);
      for (let k = 0; k < 3; k++) { this.gen = (this.gen + 1) & 255; this.updateCells(x0, y0, x1, y1); this.thermal(x0, y0, x1, y1); }
    }
    this.timeZones.length = 0; this.wells.length = 0;
    for (const s of this.shocks) s.t++;
    this.shocks = this.shocks.filter(s => s.t < 40);
    for (const b of this.bolts) b.t++;
    this.bolts = this.bolts.filter(b => b.t < 14);
  }

  updateCells(x0: number, y0: number, x1: number, y1: number) {
    const w = this.w, mat = this.mat, clk = this.clk, gen = this.gen;
    for (let y = y1 - 1; y >= y0; y--) {
      const ltr = ((this.tick + y) & 1) === 0, row = y * w;
      for (let k = x0; k < x1; k++) {
        const x = ltr ? k : x1 - 1 - (k - x0), i = row + x, m = mat[i];
        if (m === M.Empty || m === M.Wall || clk[i] === gen) continue;
        clk[i] = gen;
        this.updateCell(i, x, y, m);
      }
    }
  }

  updateCell(i: number, x: number, y: number, m: number) {
    // 1. material-specific chemistry & life
    switch (m) {
      case M.Fire: if (this.fire(i, x, y)) return; break;
      case M.Smoke: if (this.life[i] > 0) { if (this.one(2)) this.life[i]--; } else { this.clear(i); return; } break;
      case M.Water: if (this.water(i, x, y)) return; break;
      case M.SaltWater: this.brine(i, x, y); break;
      case M.Salt: if (this.salt(i, x, y)) return; break;
      case M.Lava: this.lava(i, x, y); break;
      case M.Acid: if (this.acid(i, x, y)) return; break;
      case M.Dirt: this.dirt(i, x, y); break;
      case M.Ash: if (this.ash(i, x, y)) return; break;
      case M.Seed: if (this.seedHook(i, x, y)) return; break;
      case M.Plant: this.plant(i, x, y); return;
      case M.Fungus: if (this.fungus(i, x, y)) return; break;
      case M.Bug: this.bug(i, x, y); return;
      case M.Fish: this.fish(i, x, y); return;
      case M.Algae: this.algae(i, x, y); return;
      case M.Metal: this.metal(i, x, y); break;
    }
    if (this.mat[i] !== m) return;
    // 2. combustion, shared by everything with an ignition point
    if (IGNITE[m] < 1e8 && this.combust(i, x, y, m)) return;
    // 3. movement by phase
    const ph = PHASE[m];
    if (ph === Phase.Powder) this.movePowder(i, x, y, m);
    else if (ph === Phase.Liquid) this.moveLiquid(i, x, y, m);
    else if (ph === Phase.Gas) this.moveGas(i, x, y, m);
  }

  // ---------- movement ----------
  /** Can a falling cell of material m move into cell j? */
  sinkInto(m: number, j: number) {
    const t = this.mat[j];
    if (t === M.Empty) return true;
    const ph = PHASE[t];
    return (ph === Phase.Liquid || ph === Phase.Gas) && DENSITY[m] > DENSITY[t];
  }
  /** Anything lighter than the liquid above it bobs up through it (oil in water, seeds and ash in a pond). */
  rise(i: number, y: number, m: number) {
    if (y === 0) return false;
    const a = i - this.w, t = this.mat[a];
    if (PHASE[t] !== Phase.Liquid || DENSITY[t] <= DENSITY[m] || !this.one(2)) return false;
    if (m === M.Oil && t === M.Water) this.find('float');
    this.swap(i, a); return true;
  }
  movePowder(i: number, x: number, y: number, m: number) {
    const w = this.w, h = this.h;
    if (this.rise(i, y, m)) return;
    // wind lifts light powders
    const bl = BLOWABLE[m];
    if (bl > 0) {
      const ax = this.air.vxAt(x, y), ay = this.air.vyAt(x, y), sp = Math.abs(ax) + Math.abs(ay);
      if (sp * bl > .35 && this.rf() < sp * bl * .6) {
        const dx = Math.abs(ax) > .15 ? Math.sign(ax) : 0, dy = ay < -.2 ? -1 : 0, nx = x + dx, ny = y + dy;
        if ((dx || dy) && nx >= 0 && nx < w && ny >= 0 && ny < h && this.mat[ny * w + nx] === M.Empty) { this.swap(i, ny * w + nx); this.find('wind-blown'); return; }
      }
    }
    let cur = i, cy = y;
    const steps = 1 + (this.vel[i] >> 1);
    let moved = false;
    for (let s = 0; s < steps; s++) {
      if (cy + 1 >= h) break;
      const b = cur + w;
      if (this.sinkInto(m, b)) {
        if (this.mat[b] !== M.Empty && PHASE[this.mat[b]] === Phase.Liquid && this.one(2)) break; // sinking through liquid is slower
        this.swap(cur, b); cur = b; cy++; moved = true; continue;
      }
      break;
    }
    if (moved) { this.vel[cur] = Math.min(this.vel[cur] + 1, 6); return; }
    this.vel[cur] = 0;
    if (cy + 1 >= h) return;
    if ((m === M.Dirt || m === M.Snow) && !this.one(3)) return; // cohesive powders pile steeply
    const d = (this.rnd() & 1) ? 1 : -1;
    for (let k = 0; k < 2; k++) {
      const dx = k ? -d : d, nx = x + dx;
      if (nx < 0 || nx >= w) continue;
      const side = cur + dx, diag = side + w;
      if (this.sinkInto(m, diag) && (this.mat[side] === M.Empty || PHASE[this.mat[side]] >= Phase.Liquid && PHASE[this.mat[side]] <= Phase.Gas)) { this.swap(cur, diag); return; }
    }
  }
  moveLiquid(i: number, x: number, y: number, m: number) {
    const w = this.w, h = this.h, mat = this.mat;
    if (m === M.Lava && !this.one(3)) return; // viscous
    if (this.rise(i, y, m)) return;
    let cur = i, cy = y, moved = false;
    const steps = 1 + (this.vel[i] >> 1);
    for (let s = 0; s < steps; s++) {
      if (cy + 1 >= h) break;
      const b = cur + w;
      if (this.sinkInto(m, b)) {
        const t = mat[b];
        if (t === M.Oil && m === M.Water) this.find('float');
        if (t === M.Water && m === M.SaltWater) this.find('halocline');
        if (t !== M.Empty && PHASE[t] === Phase.Liquid && this.one(3)) break;
        this.swap(cur, b); cur = b; cy++; moved = true; continue;
      }
      break;
    }
    if (moved) { this.vel[cur] = Math.min(this.vel[cur] + 1, 5); return; }
    this.vel[cur] = 0;
    const d = (this.rnd() & 1) ? 1 : -1;
    if (cy + 1 < h) for (let k = 0; k < 2; k++) {
      const dx = k ? -d : d, nx = x + dx;
      if (nx < 0 || nx >= w) continue;
      if (this.sinkInto(m, cur + w + dx) && mat[cur + dx] === M.Empty) { this.swap(cur, cur + w + dx); return; }
    }
    // spread sideways; wind biases the direction
    let dir = d;
    const ax = this.air.vxAt(x, y);
    if (Math.abs(ax) > .5 && this.rf() < .6) { dir = ax > 0 ? 1 : -1; if (Math.abs(ax) > 1) this.find('waves'); }
    const disp = DISPERSION[m];
    let best = -1;
    for (let k = 1; k <= disp; k++) {
      const nx = x + dir * k; if (nx < 0 || nx >= w) break;
      const j = cur + dir * k, t = mat[j];
      if (t === M.Empty || (PHASE[t] === Phase.Gas)) { best = j; if (cy + 1 < h && this.sinkInto(m, j + w)) break; }
      else break;
    }
    if (best >= 0) this.swap(cur, best);
  }
  moveGas(i: number, x: number, y: number, m: number) {
    const w = this.w, h = this.h;
    const ax = this.air.vxAt(x, y), ay = this.air.vyAt(x, y);
    const lift = m === M.Hydrogen ? .95 : m === M.Fire ? .5 : m === M.Smoke ? .45 : .6;
    let dy = this.rf() < lift ? -1 : (this.one(5) ? 1 : 0);
    if (ay > .6 && this.rf() < ay * .5) dy = 1; else if (ay < -.4) dy = -1;
    let dx = (this.rnd() % 3) - 1;
    if (Math.abs(ax) > .2 && this.rf() < Math.min(.9, Math.abs(ax))) dx = ax > 0 ? 1 : -1;
    const tries = [[dx, dy], [dx, 0], [-dx, dy]];
    for (const [tx, ty] of tries) {
      if (!tx && !ty) continue;
      const nx = x + tx, ny = y + ty;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const j = ny * w + nx, t = this.mat[j];
      if (t === M.Empty) { this.swap(i, j); return; }
      const ph = PHASE[t];
      if (ty < 0 && ph === Phase.Gas && DENSITY[t] > DENSITY[m]) { this.swap(i, j); return; }
      if (ty < 0 && ph === Phase.Liquid && this.one(2)) { this.swap(i, j); return; } // bubbles rise through liquid
    }
  }

  stepStorms() {
    const w = this.w, h = this.h;
    for (const s of this.storms) {
      s.life--;
      const k = Math.min(1, s.life / 120), R = s.r;
      this.air.swirl(s.x, s.y, R * 2.2, s.spin * 1.4 * k);
      // drift with the mean wind, and wander a little
      s.x += this.air.vxAt(Math.max(0, Math.min(w - 1, s.x | 0)), Math.max(0, Math.min(h - 1, s.y | 0))) * .15 + (this.rf() - .5) * .4;
      s.x = Math.max(2, Math.min(w - 3, s.x));
      // the funnel reaches down to the ground and lifts loose things up into the spin
      const n = 6 + (R >> 1);
      for (let q = 0; q < n; q++) {
        const px = Math.round(s.x + (this.rf() - .5) * R * .8);
        let py = Math.round(s.y);
        if (px < 0 || px >= w) continue;
        while (py < h - 1 && (this.mat[py * w + px] === M.Empty || PHASE[this.mat[py * w + px]] === Phase.Gas)) py++;
        if (py - s.y > R * 4) continue;
        const i = py * w + px, t = this.mat[i], ph = PHASE[t];
        if ((ph === Phase.Powder || ph === Phase.Liquid || t === M.Bug || t === M.Plant) && t !== M.Lava && this.rf() < .6 * k) {
          if (this.debris.launch(this, i, s.spin * (1.2 + this.rf()), -1.6 - this.rf() * 2.2 * k)) {
            this.find('tornado');
            if (ph === Phase.Liquid) this.find('waterspout');
          }
        }
      }
      // big storms pull up moisture and dump it as rain bands that spiral out of the eye
      if (R >= 14) {
        for (let q = 0; q < 3; q++) {
          const a = this.rf() * Math.PI * 2, d = R * (1 + this.rf() * 1.6);
          const rx = Math.round(s.x + Math.cos(a) * d), ry = Math.max(1, Math.round(s.y - R * .6 + Math.sin(a) * d * .3));
          if (rx >= 0 && rx < w && ry < h && this.mat[ry * w + rx] === M.Empty && this.one(2)) { this.spawn(ry * w + rx, M.Water, 8); this.find('hurricane'); }
        }
        if (this.one(90)) {
          // lightning from the eyewall
          const bx = Math.round(s.x + (this.rf() - .5) * R * 3);
          if (bx >= 0 && bx < w) this.pendingBolts.push(bx);
        }
      }
    }
    this.storms = this.storms.filter(s => s.life > 0);
  }
  pendingBolts: number[] = [];

  // ---------- combustion ----------
  hasAir(x: number, y: number) {
    for (let k = 0; k < 8; k++) {
      const nx = x + N8X[k], ny = y + N8Y[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const t = this.mat[ny * this.w + nx];
      if (t === M.Empty || t === M.Fire || t === M.Smoke) return true;
    }
    return false;
  }
  combust(i: number, x: number, y: number, m: number): boolean {
    const burning = this.flags[i] & F.BURN;
    if (!burning) {
      if (this.temp[i] < IGNITE[m]) return false;
      if (EXPLOSIVE[m] > 0) {
        const find = MATS[m].burnFind; if (find) this.find(find);
        this.become(i, BURN_TO[m]); this.temp[i] = BURN_TEMP[m];
        if (BURN_TO[m] === M.Fire) this.life[i] = 12 + (this.rnd() % 10);
        this.explode(x, y, EXPLOSIVE[m], BURN_TEMP[m]);
        return true;
      }
      if (!this.hasAir(x, y)) return false;
      this.flags[i] |= F.BURN; this.life[i] = FUEL[m];
      const find = MATS[m].burnFind ?? BURN_FIND[m]; if (find) this.find(find);
      return false;
    }
    this.temp[i] = Math.max(this.temp[i], BURN_TEMP[m]);
    const n = this.randNeighbor(x, y);
    if (n >= 0) {
      const t = this.mat[n];
      if (t === M.Water || t === M.SaltWater) {
        this.flags[i] &= ~F.BURN; this.temp[i] = IGNITE[m] - 60; this.become(n, M.Steam); this.temp[n] = 120; this.find('douse');
        return true;
      }
      if (t === M.Empty && (n < i || this.one(3))) {
        if (this.rf() < SMOKY[m]) { this.spawn(n, M.Smoke, BURN_TEMP[m] * .5); }
        else { this.spawn(n, M.Fire, BURN_TEMP[m]); this.life[n] = 8 + (this.rnd() % 14); }
      }
    }
    if (this.one(4) && !this.hasAir(x, y)) { this.flags[i] &= ~F.BURN; this.temp[i] = IGNITE[m] - 40; this.find('smother'); return true; }
    if (this.one(m === M.Wood ? 3 : 2)) {
      if (this.life[i] > 0) this.life[i]--;
      else {
        const to = BURN_TO[m];
        if (to === M.Ash && this.one(2)) this.clear(i); else { this.become(i, to); }
        return true;
      }
    }
    return m !== M.Oil && PHASE[m] !== Phase.Powder; // static fuels stay put; burning liquids and powders keep moving
  }
  explode(x: number, y: number, r: number, power: number) {
    const w = this.w, R = Math.max(2, r);
    this.stats.explosions++;
    if (this.shocks.length < 24) this.shocks.push({ x, y, r: R, t: 0 });
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy); if (d > R) continue;
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= this.h) continue;
      const i = ny * w + nx, m = this.mat[i], fall = 1 - d / R;
      if (MATS[m].indestructible) continue;
      this.temp[i] += power * fall * .8;
      const ph = PHASE[m];
      if (ph === Phase.Static && d < R * .7) {
        if (m === M.Glass) { this.become(i, M.Sand); this.find('shatter'); }
        else if (m === M.Stone || m === M.Obsidian) { if (this.one(2)) { this.become(i, M.Sand); this.find('crumble'); } }
        else if (m === M.Ice) this.become(i, M.Snow);
      }
      if ((ph === Phase.Powder || ph === Phase.Liquid || ph === Phase.Life || m === M.Sand) && d > 0 && d < R && m !== M.Gunpowder) {
        const sp = (2.2 + this.rf()) * fall * Math.min(3, R / 2);
        if (this.debris.launch(this, i, dx / d * sp, dy / d * sp - 1.2 * fall)) this.find('shockwave');
      } else if (m === M.Empty && d < R * .6 && this.one(3)) {
        this.spawn(i, M.Fire, power); if (R >= 5) this.find('fireball');
      }
    }
    this.air.impulse(x, y, R * 2.2, 2.2 + R * .25);
  }

  // ---------- chemistry & life hooks (return true if the cell is gone or moved) ----------
  fire(i: number, x: number, y: number): boolean {
    if (this.life[i] === 0) { if (this.one(3)) { this.become(i, M.Smoke); this.temp[i] = 200; } else this.clear(i); return true; }
    this.life[i]--;
    this.temp[i] = Math.max(this.temp[i], 450 + this.life[i] * 18);
    if (this.one(9)) this.sparks.push(x, y);
    const n = this.randNeighbor(x, y);
    if (n >= 0) {
      const t = this.mat[n];
      if (t === M.Water || t === M.SaltWater) { this.become(n, M.Steam); this.temp[n] = 110; this.clear(i); this.find('douse'); return true; }
      if (t === M.Ice || t === M.Snow) { this.temp[n] += 60; this.find('fire-ice'); }
    }
    // flames lick every fuel they touch, and cling to it instead of floating away
    let fuel = false;
    for (let k = 0; k < 8; k++) {
      const nx = x + N8X[k], ny = y + N8Y[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const j = ny * this.w + nx;
      if (IGNITE[this.mat[j]] < 1e8) { this.temp[j] += 45; fuel = true; }
    }
    return fuel && !this.one(8);
  }
  water(i: number, x: number, y: number): boolean {
    if (this.charge[i] === 1 && this.one(30)) { this.become(i, M.Hydrogen); this.find('electrolysis'); return true; }
    // life starts on its own: sunlit water touching rich soil grows algae
    if (this.one(300)) {
      const n = this.randNeighbor(x, y);
      if (n >= 0 && this.mat[n] === M.Dirt && (this.flags[n] & F.FERT) && this.lit(i)) { this.become(i, M.Algae); this.find('algae-appears'); return true; }
    }
    return false;
  }
  brine(i: number, x: number, y: number) { /* reactions live on the other side (salt, metal, plant) */ }
  salt(i: number, x: number, y: number): boolean {
    const n = this.randNeighbor(x, y); if (n < 0) return false;
    const t = this.mat[n];
    if (t === M.Water && this.one(6)) { this.become(n, M.SaltWater); this.clear(i); this.find('dissolve'); return true; }
    if ((t === M.Ice || t === M.Snow) && this.one(10)) { this.become(n, M.SaltWater); this.clear(i); this.find('salt-ice'); return true; }
    return false;
  }
  lava(i: number, x: number, y: number) {
    const n = this.randNeighbor(x, y); if (n < 0) return;
    const t = this.mat[n];
    if (t === M.Water || t === M.SaltWater) {
      this.become(i, M.Obsidian); this.temp[i] = 700;
      this.become(n, M.Steam); this.temp[n] = 180;
      this.find('obsidian');
    }
  }
  acid(i: number, x: number, y: number): boolean {
    if (!this.one(3)) return false;
    const n = this.randNeighbor(x, y); if (n < 0) return false;
    const t = this.mat[n];
    if (t === M.Empty || t === M.Acid) return false;
    if (ACIDPROOF[t]) { if (t === M.Glass) this.find('acid-glass'); return false; }
    this.temp[i] += 25;
    switch (t) {
      case M.Metal: this.become(n, M.Hydrogen); this.find('acid-metal'); if (this.one(3)) { this.clear(i); return true; } return false;
      case M.Stone: this.clear(n); if (this.one(2)) this.spawn(n, M.Smoke, 60); this.find('acid-stone'); if (this.one(4)) { this.clear(i); return true; } return false;
      case M.Water: if (this.one(8)) { this.become(i, M.Water); this.temp[i] += 20; this.find('dilute'); return true; } return false;
      case M.Ash: this.become(n, M.Water); this.become(i, M.Water); this.find('neutralize'); return true;
      case M.Ice: case M.Snow: this.become(n, M.Water); return false;
      default:
        if (PHASE[t] === Phase.Gas) return false;
        this.clear(n); if (this.one(3)) this.spawn(n, M.Smoke, 40);
        this.find('corrode');
        if (this.one(4)) { this.clear(i); return true; }
        return false;
    }
  }
  dirt(i: number, x: number, y: number) {
    const f = this.flags[i];
    if (!(f & F.WET)) {
      const n = this.randNeighbor(x, y);
      if (n >= 0 && this.mat[n] === M.Water && this.one(3)) { this.clear(n); this.flags[i] |= F.WET; this.find('soak'); }
      return;
    }
    if (this.temp[i] > 100) {
      this.flags[i] &= ~F.WET; this.find('dry-out');
      if (y > 0 && this.mat[i - this.w] === M.Empty) this.spawn(i - this.w, M.Steam, 110);
      return;
    }
    // capillary spread and mould
    if (this.one(12)) {
      const n = this.randNeighbor(x, y);
      if (n < 0) return;
      const t = this.mat[n];
      if (t === M.Dirt && !(this.flags[n] & F.WET) && n > i - 1) { this.flags[n] |= F.WET; this.flags[i] &= ~F.WET; }
      else if (t === M.Wood && this.one(120) && !this.lit(i)) { this.become(i, M.Fungus); this.find('fungus-appears'); }
    }
  }
  ash(i: number, x: number, y: number): boolean {
    if (y + 1 < this.h) {
      const b = i + this.w;
      if (this.mat[b] === M.Dirt && this.one(40)) { this.flags[b] |= F.FERT; this.clear(i); this.find('fertilize'); return true; }
    }
    return false;
  }
  seedHook(i: number, x: number, y: number): boolean {
    if (y + 1 >= this.h) return false;
    const b = i + this.w;
    if (this.mat[b] === M.Dirt && (this.flags[b] & F.WET)) {
      const fert = this.flags[b] & F.FERT;
      this.flags[b] &= ~F.WET;
      this.become(i, M.Plant); this.flags[i] = F.TIP; this.life[i] = fert ? 160 : 90; this.vel[i] = 0;
      if (fert) this.aux[i] = (this.aux[i] & 0xf0) | Math.min(15, (this.aux[i] & 15) + 4); // rich soil: a taller start
      this.find('sprout');
      return true;
    }
    return false;
  }
  plant(i: number, x: number, y: number) {
    const f = this.flags[i], w = this.w;
    const hardy = this.aux[i] >> 4;
    if (this.temp[i] < -4 - hardy * 3) { this.become(i, M.Dirt); this.find('frostbite'); return; }
    if (IGNITE[M.Plant] < 1e8 && this.combust(i, x, y, M.Plant)) return;
    if (f & F.BURN) return;
    // drink from neighbours
    const n = this.randNeighbor(x, y);
    if (n >= 0) {
      const t = this.mat[n];
      if (t === M.Water && this.life[i] < 200 && this.one(4)) { this.clear(n); this.life[i] = Math.min(255, this.life[i] + 45); this.find('plant-drinks'); }
      else if (t === M.SaltWater && this.one(6)) { this.become(i, M.Ash); this.find('salted-earth'); return; }
      else if (t === M.Dirt && (this.flags[n] & F.WET) && this.life[i] < 200 && this.one(3)) { this.flags[n] &= ~F.WET; this.life[i] = Math.min(255, this.life[i] + 30); }
      // sap flows up and sideways toward the growing tips
      else if (t === M.Plant && n < i + 2 && this.life[i] > this.life[n] + 2) { const d = (this.life[i] - this.life[n]) >> 1; this.life[i] -= d; this.life[n] += d; }
    }
    if (f & F.TIP) {
      if (!this.one(6 + (hardy >> 1))) return;   // a hardy plant grows slower
      if (this.life[i] < 10) return;
      if (!this.lit(i)) { this.find('phototropism'); return; }
      const maxH = 10 + (this.aux[i] & 15) * 4;
      if (this.vel[i] >= maxH) { this.flags[i] = F.FLOWER; this.find('bloom'); return; }
      const r = this.rnd() % 10, dx = r < 6 ? 0 : r < 8 ? -1 : 1;
      const nx = x + dx, ny = y - 1;
      if (ny < 0 || nx < 0 || nx >= w) { this.flags[i] = F.FLOWER; return; }
      const j = ny * w + nx;
      if (this.mat[j] !== M.Empty) return;
      this.spawn(j, M.Plant, this.temp[i]);
      this.flags[j] = F.TIP; this.vel[j] = this.vel[i] + 1; this.aux[j] = this.aux[i];
      this.life[j] = this.life[i] - 6; this.life[i] = 4; this.flags[i] = 0;
      if (this.one(3)) { // a leaf
        const lx = x + ((this.rnd() & 1) ? 1 : -1);
        if (lx >= 0 && lx < w && this.mat[i - x + lx] === M.Empty) { const k = i - x + lx; this.spawn(k, M.Plant, this.temp[i]); this.flags[k] = F.LEAF; this.aux[k] = this.aux[i]; }
      }
      return;
    }
    if ((f & F.FLOWER) && this.life[i] >= 16 && this.one(90)) {
      const k = this.rnd() & 7, nx = x + N8X[k], ny = y + N8Y[k];
      if (nx >= 0 && ny >= 0 && nx < w && ny < this.h && this.mat[ny * w + nx] === M.Empty) {
        const k = ny * w + nx;
        this.spawn(k, M.Seed); this.life[i] -= 16; this.find('reproduce');
        this.aux[k] = this.inherit(this.aux[i], false, this.temp[i] < 2);  // a cold season favours hardier seed
        this.evolved(M.Plant, this.aux[k]);
      }
    }
  }
  fungus(i: number, x: number, y: number): boolean {
    if (!this.one(10)) return false;
    if (this.lit(i)) { if (this.one(12)) { this.become(i, M.Dirt); this.find('fungus-light'); return true; } return false; }
    const n = this.randNeighbor(x, y); if (n < 0) return false;
    const t = this.mat[n];
    if (t === M.Wood && this.one(3)) { this.become(n, M.Fungus); this.find('decompose'); }
    else if (t === M.Dirt && (this.flags[n] & F.WET) && this.one(6)) this.become(n, M.Fungus);
    else if (t === M.Empty && this.one(40)) { this.spawn(n, M.Methane); this.find('swamp-gas'); }
    return false;
  }
  bug(i: number, x: number, y: number) {
    const w = this.w, h = this.h;
    const T = this.temp[i];
    if (T > 60 && !(this.flags[i] & F.BURN)) { this.become(i, M.Ash); this.find('bug-burn'); return; }
    const coat = this.aux[i] & 15, swim = this.aux[i] >> 4;
    if (T < -5 - coat * 3) { this.become(i, M.Dirt); this.flags[i] |= F.FERT; this.find('bug-cold'); return; }
    if (this.combust(i, x, y, M.Bug)) return;
    if (!this.one(2)) return;
    // submerged bugs run out of air, unless they have evolved to swim
    if (y > 0 && PHASE[this.mat[i - w]] === Phase.Liquid) {
      const loss = Math.max(0, 5 - (swim >> 1));
      if (loss === 0) { /* breathes through its skin */ }
      else if (this.life[i] > loss) this.life[i] -= loss; else { this.become(i, M.Dirt); this.flags[i] |= F.FERT; this.find('bug-drown'); return; }
    }
    // swimmers paddle about in the water instead of sinking
    if (swim >= 8 && (PHASE[this.mat[i + w < this.n ? i + w : i]] === Phase.Liquid || (y > 0 && PHASE[this.mat[i - w]] === Phase.Liquid))) {
      const k = this.randNeighbor(x, y);
      if (k >= 0 && PHASE[this.mat[k]] === Phase.Liquid && !this.one(3)) { const f = this.flags[i]; this.swap(i, k); this.flags[k] = f; return; }
    }
    // gravity
    if (y + 1 < h) {
      const b = i + w, t = this.mat[b];
      if (t === M.Empty || PHASE[t] === Phase.Gas) { this.swap(i, b); return; }
      if (PHASE[t] === Phase.Liquid) {
        if (this.one(2)) this.swap(i, b);
        return;
      }
    }
    // hunger
    if (this.one(coat > 7 ? 2 : 3)) { if (this.life[i] > 0) this.life[i]--; else { this.become(i, M.Dirt); this.flags[i] |= F.FERT; this.find('starve'); return; } }  // a thick coat burns more food
    // eat
    const n = this.randNeighbor(x, y);
    if (n >= 0) {
      const t = this.mat[n];
      if (t === M.Plant || t === M.Seed || t === M.Fungus) {
        this.clear(n); this.life[i] = 255; this.vel[i]++; this.find('bug-eats');
        if (this.vel[i] >= 3) {
          const k = this.randNeighbor(x, y);
          if (k >= 0 && this.mat[k] === M.Empty) {
            this.spawn(k, M.Bug); this.life[k] = 160; this.vel[i] = 0; this.find('bug-breeds');
            this.aux[k] = this.inherit(this.aux[i], T < 8, y + 1 < h && PHASE[this.mat[i + w]] === Phase.Liquid);
            this.evolved(M.Bug, this.aux[k]);
          }
        }
        return;
      }
    }
    // walk and climb (water-adapted bugs are clumsy on land)
    if (swim >= 8 && !this.one(2)) return;
    const dir = (this.flags[i] & F.DIR) ? 1 : -1, nx = x + dir;
    if (nx < 0 || nx >= w) { this.flags[i] ^= F.DIR; return; }
    const f = i + dir;
    if (this.mat[f] === M.Empty) { this.swap(i, f); return; }
    if (y > 0 && this.mat[f - w] === M.Empty && this.mat[i - w] === M.Empty) { this.swap(i, f - w); return; }
    this.flags[i] ^= F.DIR;
  }
  /** Algae: lives only in water, spreads through sunlit water, faster near rich soil or ash. */
  algae(i: number, x: number, y: number) {
    const T = this.temp[i], grow = this.aux[i] & 15, dark = this.aux[i] >> 4;
    if (T > 70) { this.become(i, M.Water); return; }
    if (!this.one(4)) return;
    let wet = 0, rich = 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + N4X[k], ny = y + N4Y[k]; if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const t = this.mat[ny * this.w + nx];
      if (t === M.Water) wet++;
      else if ((t === M.Dirt && (this.flags[ny * this.w + nx] & F.FERT)) || t === M.Ash) rich++;
    }
    const sub = y > 0 && (this.mat[i - this.w] === M.Water || this.mat[i - this.w] === M.Algae);
    if (!wet && !sub) { if (this.one(30)) { this.become(i, M.Dirt); this.flags[i] |= F.FERT; this.find('algae-dries'); } return; }
    const n = this.randNeighbor(x, y);
    if (n >= 0 && this.mat[n] === M.Water && (this.lit(n) || (dark >= 8 && this.one(3))) && this.one(Math.max(2, Math.round((rich ? 6 : 40) * (1 - grow / 18)) + (dark >= 8 ? 4 : 0)))) {
      this.become(n, M.Algae); this.find('algae-bloom');
      this.aux[n] = this.inherit(this.aux[i], false, !this.lit(i));  // shade pushes toward low-light algae
      this.evolved(M.Algae, this.aux[n]);
      return;
    }
    // drift in the water
    if (n >= 0 && this.mat[n] === M.Water && this.one(3)) this.swap(i, n);
  }
  /** Fish: swim through water, eat algae and whatever falls in, breed when fed, suffocate in air. */
  fish(i: number, x: number, y: number) {
    const w = this.w, h = this.h, T = this.temp[i];
    const heatTol = this.aux[i] & 15, lungs = this.aux[i] >> 4;
    if (T > 45 + heatTol * 4 && !(this.flags[i] & F.BURN)) { this.become(i, M.Dirt); this.flags[i] |= F.FERT; this.find('fish-cooked'); return; }
    if (this.combust(i, x, y, M.Fish)) return;
    if (!this.one(2)) return;
    let wet = 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + N8X[k], ny = y + N8Y[k]; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const t = this.mat[ny * w + nx]; if (t === M.Water || t === M.SaltWater || t === M.Algae) wet++;
    }
    if (!wet) {
      // out of water: flop, fall, gasp
      if (y + 1 < h && (this.mat[i + w] === M.Empty || PHASE[this.mat[i + w]] === Phase.Gas)) { this.swap(i, i + w); return; }
      const loss = Math.max(1, 6 - (lungs >> 1));
      if (lungs >= 12 || this.life[i] > loss) { if (lungs < 12) this.life[i] -= loss; } else { this.become(i, M.Dirt); this.flags[i] |= F.FERT; this.find('fish-suffocate'); return; }
      if (lungs >= 12) {
        // a fish that has learned to walk: it crawls along the ground and eats what it finds
        const n = this.randNeighbor(x, y);
        if (n >= 0 && (this.mat[n] === M.Bug || this.mat[n] === M.Plant || this.mat[n] === M.Seed || this.mat[n] === M.Algae)) {
          this.clear(n); this.life[i] = 255; this.vel[i]++; this.find('fish-eats');
          if (this.vel[i] >= 4) {
            const k = this.randNeighbor(x, y);
            if (k >= 0 && this.mat[k] === M.Empty) { this.spawn(k, M.Fish); this.life[k] = 180; this.vel[i] = 0; this.aux[k] = this.inherit(this.aux[i]); this.find('fish-breeds'); }
          }
          return;
        }
        const f = i + ((this.flags[i] & F.DIR) ? 1 : -1);
        if (Math.abs((f % w) - x) === 1 && this.mat[f] === M.Empty) { const fl = this.flags[i]; this.swap(i, f); this.flags[f] = fl; }
        else if (this.one(3)) this.flags[i] ^= F.DIR;
        return;
      }
      if (this.one(3)) { const f = i + ((this.rnd() & 1) ? 1 : -1); const fx = f % w; if (Math.abs(fx - x) === 1 && this.mat[f] === M.Water) this.swap(i, f); }
      return;
    }
    if (this.one(4)) { if (this.life[i] > 0) this.life[i]--; else { this.become(i, M.Dirt); this.flags[i] |= F.FERT; this.find('fish-starve'); return; } }
    // eat
    const n = this.randNeighbor(x, y);
    if (n >= 0) {
      const t = this.mat[n];
      if (t === M.Algae || t === M.Bug || t === M.Seed || t === M.Plant) {
        this.become(n, M.Water); this.life[i] = 255; this.vel[i]++;
        this.find(t === M.Bug ? 'food-chain' : 'fish-eats');
        if (this.vel[i] >= 4) {
          const k = this.randNeighbor(x, y);
          if (k >= 0 && this.mat[k] === M.Water) {
            this.spawn(k, M.Fish); this.life[k] = 180; this.vel[i] = 0; this.find('fish-breeds');
            this.aux[k] = this.inherit(this.aux[i], T > 26, y > 0 && this.mat[i - w] === M.Empty);  // warm water favours heat tolerance, a surface dweller gets lungs
            this.evolved(M.Fish, this.aux[k]);
          }
        }
        return;
      }
    }
    // swim: keep heading one way, wander up and down, turn at walls
    const dir = (this.flags[i] & F.DIR) ? 1 : -1, dy = (this.rnd() % 3) - 1;
    const nx = x + dir, ny = y + dy;
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) { this.flags[i] ^= F.DIR; return; }
    const j = ny * w + nx, t = this.mat[j];
    if (t === M.Water || t === M.SaltWater) { const f = this.flags[i]; this.swap(i, j); this.flags[j] = f; return; }
    if (this.one(2)) this.flags[i] ^= F.DIR;
  }
  metal(i: number, x: number, y: number) {
    if (this.temp[i] > 600) this.find('red-hot');
    if (!this.one(16)) return;
    const n = this.randNeighbor(x, y); if (n < 0) return;
    const t = this.mat[n];
    if (t === M.Water && this.one(160)) { this.become(i, M.Rust); this.find('rust'); }
    else if (t === M.SaltWater && this.one(14)) { this.become(i, M.Rust); this.find('rust-salt'); }
  }

  // ---------- heat ----------
  thermal(x0: number, y0: number, x1: number, y1: number) {
    const w = this.w, T = this.temp, mat = this.mat, amb = this.ambient;
    for (let y = y0; y < y1; y++) {
      const a = amb[y], row = y * w;
      for (let x = x0; x < x1; x++) {
        const i = row + x, m = mat[i];
        let t = T[i];
        const k = CONDUCT[m], c = CAPACITY[m];
        if (x + 1 < x1) {
          const j = i + 1, mj = mat[j], kk = Math.min(k, CONDUCT[mj]) * .22, q = (T[j] - t) * kk;
          if (q > .001 || q < -.001) { t += q / c; T[j] -= q / CAPACITY[mj]; }
        }
        if (y + 1 < y1) {
          const j = i + w, mj = mat[j], kk = Math.min(k, CONDUCT[mj]) * .22, q = (T[j] - t) * kk;
          if (q > .001 || q < -.001) { t += q / c; T[j] -= q / CAPACITY[mj]; }
          // hot air rises: empty cells hand heat upward
        }
        if (m === M.Empty && y > 0 && mat[i - w] === M.Empty) {
          const q = (t - T[i - w]) * .3;
          if (q > 0) { t -= q; T[i - w] += q; if (q > 12) this.find('heat-rises'); }
        }
        const ph = PHASE[m];
        t += (a - t) * (m === M.Empty ? .03 : ph === Phase.Gas ? .006 : .0015);
        T[i] = t;
        if (t > HOT[m]) this.phaseUp(i, m, x, y);
        else if (t < COLD[m]) this.phaseDown(i, m, x, y);
      }
    }
  }
  phaseUp(i: number, m: number, x: number, y: number) {
    const d = MATS[m];
    if (m === M.Water && !this.one(3)) return;
    if (m === M.Snow && !this.one(4)) return;
    if (m === M.SaltWater) {
      // brine boils off as steam and leaves its salt behind
      this.become(i, M.Salt); this.find('desalinate');
      if (y > 0 && this.mat[i - this.w] === M.Empty) this.spawn(i - this.w, M.Steam, 120);
      return;
    }
    this.become(i, d.hotTo!);
    if (d.hotFind) this.find(d.hotFind);
    if (m === M.Metal) this.find('metal-melts');
    if (m === M.Water) this.temp[i] = Math.max(this.temp[i], 112);
    if (m === M.Ice) this.temp[i] = Math.max(this.temp[i], 1);
  }
  phaseDown(i: number, m: number, x: number, y: number) {
    if (m === M.Water) {
      // freezing needs a seed crystal or deep cold
      let seeded = this.temp[i] < -8;
      if (!seeded) for (let k = 0; k < 4; k++) { const nx = x + N4X[k], ny = y + N4Y[k]; if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h && this.mat[ny * this.w + nx] === M.Ice) { seeded = true; break; } }
      if (!seeded || !this.one(4)) return;
      this.become(i, M.Ice); this.find('freeze');
      if (y < this.h / 3) this.find('cold-top');
      return;
    }
    if (m === M.Steam) {
      if (this.temp[i] < 0) { this.become(i, M.Snow); this.find('snowfall'); this.find('cold-top'); }
      else { this.become(i, M.Water); this.find('condense'); }
      return;
    }
    const d = MATS[m];
    this.become(i, d.coldTo!);
    if (d.coldFind) this.find(d.coldFind);
  }

  // ---------- electricity ----------
  electric() {
    const w = this.w, h = this.h, ch = this.charge, mat = this.mat;
    // batteries fire a pulse on a fixed beat
    const beat = this.tick % 12 === 0;
    if (!beat && !this.eLive) return; // nothing is charged, so nothing can change until the next battery beat
    const next = this.nextCharge ?? (this.nextCharge = new Uint8Array(this.n));
    next.fill(0);
    let any = false;
    for (let i = 0; i < this.n; i++) {
      const m = mat[i], c = ch[i];
      if (c === 1) { next[i] = 2; any = true; continue; }
      if (c === 2) { continue; }
      if (m === M.Battery) { if (beat) { next[i] = 1; any = true; } continue; }
      const cond = CONDUCTIVE[m];
      if (cond === 0) continue;
      const x = i % w, y = (i / w) | 0;
      if ((x > 0 && ch[i - 1] === 1) || (x < w - 1 && ch[i + 1] === 1) || (y > 0 && ch[i - w] === 1) || (y < h - 1 && ch[i + w] === 1)) {
        if (cond >= 1 || this.rf() < cond) { next[i] = 1; any = true; }
      }
    }
    this.charge = next; this.nextCharge = ch; this.eLive = any;
    if (!any) return;
    // effects of live current
    for (let i = 0; i < this.n; i++) {
      if (this.charge[i] !== 1) continue;
      const m = mat[i];
      if (m === M.Metal) { this.temp[i] += 12; if (this.temp[i] > 50) this.find('resist-heat'); this.find('current'); }
      else if (m === M.Water || m === M.SaltWater) this.find('wet-current');
      if (this.one(24)) this.sparks.push(i % w, (i / w) | 0);
      const x = i % w, y = (i / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + N4X[k], ny = y + N4Y[k]; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx, t = mat[j];
        if (t === M.Bug || t === M.Fish) { this.become(j, M.Ash); this.find('electrocute'); }
        else if (IGNITE[t] < 1e8 && (PHASE[t] === Phase.Gas || t === M.Gunpowder || t === M.Oil)) { this.temp[j] += 600; this.find('spark-ignite'); }
      }
    }
  }
  nextCharge: Uint8Array | null = null;
  eLive = true;

  // ---------- inspection ----------
  count(m: number) { let c = 0; for (let i = 0; i < this.n; i++) if (this.mat[i] === m) c++; return c; }
  hash() {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < this.n; i++) { h ^= this.mat[i]; h = Math.imul(h, 16777619); h ^= (this.temp[i] | 0) & 255; h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
}

export { MAT_COUNT };
