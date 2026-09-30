import type { World } from './world.ts';
import { M, PHASE, Phase } from './materials.ts';

/**
 * Cells thrown by explosions or pulled by the gravity well leave the grid and fly ballistically,
 * then settle back into the first free cell where they land. Deterministic: stepped by the world.
 */
export class Debris {
  static MAX = 4000;
  n = 0;
  x = new Float32Array(Debris.MAX); y = new Float32Array(Debris.MAX); vx = new Float32Array(Debris.MAX); vy = new Float32Array(Debris.MAX);
  mat = new Uint8Array(Debris.MAX); aux = new Uint8Array(Debris.MAX); temp = new Float32Array(Debris.MAX); age = new Uint16Array(Debris.MAX);

  launch(world: World, i: number, vx: number, vy: number): boolean {
    if (this.n >= Debris.MAX) return false;
    const k = this.n++;
    this.x[k] = i % world.w + .5; this.y[k] = ((i / world.w) | 0) + .5; this.vx[k] = vx; this.vy[k] = vy;
    this.mat[k] = world.mat[i]; this.aux[k] = world.aux[i]; this.temp[k] = world.temp[i]; this.age[k] = 0;
    world.clear(i);
    return true;
  }
  step(world: World) {
    const w = world.w, h = world.h;
    for (let k = 0; k < this.n; k++) {
      let vx = this.vx[k], vy = this.vy[k] + .12;
      for (const g of world.wells) {
        const dx = g.x - this.x[k], dy = g.y - this.y[k], d2 = dx * dx + dy * dy + 4, d = Math.sqrt(d2);
        if (d < g.r * 3) { const f = Math.min(.6, 40 / d2); vx += dx / d * f - dy / d * f * .35; vy += dy / d * f + dx / d * f * .35 - .12; }
      }
      vx *= .995; vy *= .995;
      const sp = Math.max(Math.abs(vx), Math.abs(vy)), steps = Math.max(1, Math.ceil(sp));
      let x = this.x[k], y = this.y[k], landed = false;
      for (let s = 0; s < steps; s++) {
        const nx = x + vx / steps, ny = y + vy / steps;
        const cx = nx | 0, cy = ny | 0;
        if (cx < 0 || cx >= w || ny < 0) { vx = -vx * .3; break; }
        if (cy >= h) { landed = true; break; }
        const t = world.mat[cy * w + cx];
        if (t !== M.Empty && PHASE[t] !== Phase.Gas) { landed = true; break; }
        x = nx; y = ny;
      }
      this.x[k] = x; this.y[k] = y; this.vx[k] = vx; this.vy[k] = vy; this.age[k]++;
      const inWell = world.wells.length > 0;
      if ((landed && (!inWell || this.age[k] > 400)) || this.age[k] > 900) {
        const cx = Math.min(w - 1, Math.max(0, x | 0)), cy = Math.min(h - 1, Math.max(0, y | 0)), i = cy * w + cx;
        if (world.mat[i] === M.Empty || PHASE[world.mat[i]] === Phase.Gas) {
          world.mat[i] = this.mat[k]; world.aux[i] = this.aux[k]; world.temp[i] = this.temp[k];
          world.flags[i] = 0; world.life[i] = world.initLife(this.mat[k]); world.vel[i] = 2; world.clk[i] = world.gen;
        }
        this.remove(k); k--;
      } else if (landed) { this.vx[k] *= -.2; this.vy[k] = -Math.abs(this.vy[k]) * .2; }
    }
  }
  remove(k: number) {
    const l = --this.n;
    this.x[k] = this.x[l]; this.y[k] = this.y[l]; this.vx[k] = this.vx[l]; this.vy[k] = this.vy[l];
    this.mat[k] = this.mat[l]; this.aux[k] = this.aux[l]; this.temp[k] = this.temp[l]; this.age[k] = this.age[l];
  }
}
