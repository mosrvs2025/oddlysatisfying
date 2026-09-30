import type { World } from './world.ts';
import { M, PHASE, Phase } from './materials.ts';

/**
 * A coarse incompressible air field (one air cell per S x S world cells): semi-Lagrangian advection,
 * Jacobi pressure projection, buoyancy from the average temperature of each block, and solid blocks
 * as obstacles. Gases and light powders read it to drift; explosions and the wind tool write to it.
 */
export class Air {
  static S = 4;
  cw: number; ch: number;
  vx: Float32Array; vy: Float32Array; p: Float32Array; div: Float32Array; tx: Float32Array; ty: Float32Array;
  heat: Float32Array; solid: Uint8Array;
  constructor(w: number, h: number) {
    const S = Air.S;
    this.cw = Math.ceil(w / S); this.ch = Math.ceil(h / S);
    const n = this.cw * this.ch;
    this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.p = new Float32Array(n); this.div = new Float32Array(n);
    this.tx = new Float32Array(n); this.ty = new Float32Array(n); this.heat = new Float32Array(n); this.solid = new Uint8Array(n);
  }
  vxAt(x: number, y: number) { return this.vx[((y >> 2) * this.cw) + (x >> 2)]; }
  vyAt(x: number, y: number) { return this.vy[((y >> 2) * this.cw) + (x >> 2)]; }

  sample(world: World) {
    const { cw, ch } = this, S = Air.S, w = world.w, h = world.h;
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      let t = 0, s = 0, k = 0;
      for (let oy = 1; oy < S; oy += 2) for (let ox = 1; ox < S; ox += 2) {
        const x = Math.min(w - 1, cx * S + ox), y = Math.min(h - 1, cy * S + oy), i = y * w + x, m = world.mat[i];
        t += world.temp[i] - world.ambient[y]; k++;
        if (PHASE[m] === Phase.Static || PHASE[m] === Phase.Powder || PHASE[m] === Phase.Life || PHASE[m] === Phase.Liquid) s++;
        if (m === M.Empty && world.temp[i] - world.ambient[y] > 10) t += 0; // counted above
      }
      const c = cy * cw + cx;
      this.heat[c] = t / k; this.solid[c] = s >= 3 ? 1 : 0;
    }
  }

  step(world: World) {
    const { cw, ch, vx, vy, p, div, tx, ty } = this, n = cw * ch;
    if ((world.tick & 1) === 0) this.sample(world);
    // buoyancy: warm blocks rise
    for (let c = 0; c < n; c++) {
      const b = this.heat[c];
      if (b > 3) vy[c] -= Math.min(b, 800) * .00035;
    }
    // advect
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const c = y * cw + x;
      const sx = Math.min(cw - 1.001, Math.max(0, x - vx[c] * .25)), sy = Math.min(ch - 1.001, Math.max(0, y - vy[c] * .25));
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, a = y0 * cw + x0;
      tx[c] = (vx[a] * (1 - fx) + vx[a + 1] * fx) * (1 - fy) + (vx[a + cw] * (1 - fx) + vx[a + cw + 1] * fx) * fy;
      ty[c] = (vy[a] * (1 - fx) + vy[a + 1] * fx) * (1 - fy) + (vy[a + cw] * (1 - fx) + vy[a + cw + 1] * fx) * fy;
    }
    for (let c = 0; c < n; c++) { const s = this.solid[c] ? 0 : .985; vx[c] = tx[c] * s; vy[c] = ty[c] * s; }
    // project
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const c = y * cw + x;
      const r = x < cw - 1 ? vx[c + 1] : 0, l = x > 0 ? vx[c - 1] : 0, d = y < ch - 1 ? vy[c + cw] : 0, u = y > 0 ? vy[c - cw] : 0;
      div[c] = .5 * (r - l + d - u); p[c] *= .6;
    }
    for (let it = 0; it < 10; it++) for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const c = y * cw + x;
      const l = x > 0 ? p[c - 1] : p[c], r = x < cw - 1 ? p[c + 1] : p[c], u = y > 0 ? p[c - cw] : p[c], d = y < ch - 1 ? p[c + cw] : p[c];
      p[c] = (l + r + u + d - div[c]) * .25;
    }
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const c = y * cw + x;
      if (this.solid[c]) { vx[c] = 0; vy[c] = 0; continue; }
      const l = x > 0 ? p[c - 1] : p[c], r = x < cw - 1 ? p[c + 1] : p[c], u = y > 0 ? p[c - cw] : p[c], d = y < ch - 1 ? p[c + cw] : p[c];
      vx[c] -= .5 * (r - l); vy[c] -= .5 * (d - u);
      if (vx[c] > 6) vx[c] = 6; else if (vx[c] < -6) vx[c] = -6;
      if (vy[c] > 6) vy[c] = 6; else if (vy[c] < -6) vy[c] = -6;
    }
  }

  /** Radial push, as from an explosion. x, y, r in world cells. */
  impulse(x: number, y: number, r: number, s: number) {
    const S = Air.S, cx = x / S, cy = y / S, R = r / S;
    for (let j = Math.max(0, (cy - R) | 0); j <= Math.min(this.ch - 1, (cy + R) | 0); j++)
      for (let i = Math.max(0, (cx - R) | 0); i <= Math.min(this.cw - 1, (cx + R) | 0); i++) {
        const dx = i + .5 - cx, dy = j + .5 - cy, d = Math.hypot(dx, dy);
        if (d > R || d < 1e-3) continue;
        const f = s * (1 - d / R), c = j * this.cw + i;
        this.vx[c] += dx / d * f; this.vy[c] += dy / d * f;
      }
  }
  /** Directional push, as from the wind tool. */
  push(x: number, y: number, r: number, dx: number, dy: number) {
    const S = Air.S, cx = x / S, cy = y / S, R = Math.max(1, r / S);
    for (let j = Math.max(0, (cy - R) | 0); j <= Math.min(this.ch - 1, (cy + R) | 0); j++)
      for (let i = Math.max(0, (cx - R) | 0); i <= Math.min(this.cw - 1, (cx + R) | 0); i++) {
        const d = Math.hypot(i + .5 - cx, j + .5 - cy); if (d > R) continue;
        const f = 1 - d / R, c = j * this.cw + i;
        this.vx[c] += dx * f; this.vy[c] += dy * f;
      }
  }
}
