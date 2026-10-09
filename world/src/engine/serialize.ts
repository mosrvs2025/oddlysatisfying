import { World } from './world.ts';
import { M, PHASE, Phase } from './materials.ts';

export interface Snapshot { mat: Uint8Array; aux: Uint8Array; life: Uint8Array; flags: Uint8Array; vel: Int8Array; temp: Float32Array; charge: Uint8Array; rng: number; tick: number }

export function snapshot(w: World): Snapshot {
  return { mat: w.mat.slice(), aux: w.aux.slice(), life: w.life.slice(), flags: w.flags.slice(), vel: w.vel.slice(), temp: w.temp.slice(), charge: w.charge.slice(), rng: w.rngState, tick: w.tick };
}
export function restore(w: World, s: Snapshot) {
  w.mat.set(s.mat); w.aux.set(s.aux); w.life.set(s.life); w.flags.set(s.flags); w.vel.set(s.vel); w.temp.set(s.temp); w.charge.set(s.charge);
  w.rngState = s.rng; w.tick = s.tick; w.debris.n = 0; w.eLive = true;
}

const MAGIC = 0x54455231; // "TER1"

/** Binary save: header, then per-cell arrays (temperature quantised to 1 C in an Int16). */
export function encode(w: World): Uint8Array {
  const n = w.n, head = 24;
  const buf = new Uint8Array(head + n * 7);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, MAGIC); dv.setUint16(4, w.w); dv.setUint16(6, w.h); dv.setUint32(8, w.rngState); dv.setUint32(12, w.tick); dv.setUint32(16, w.seed);
  let o = head;
  buf.set(w.mat, o); o += n; buf.set(w.aux, o); o += n; buf.set(w.life, o); o += n; buf.set(w.flags, o); o += n;
  buf.set(new Uint8Array(w.vel.buffer, w.vel.byteOffset, n), o); o += n;
  for (let i = 0; i < n; i++, o += 2) dv.setInt16(o, Math.max(-32768, Math.min(32767, Math.round(w.temp[i]))));
  return buf;
}
export function decode(buf: Uint8Array): World {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0) !== MAGIC) throw new Error('This is not a Terrarium world.');
  const W = dv.getUint16(4), H = dv.getUint16(6);
  const w = new World(W, H, dv.getUint32(16));
  w.rngState = dv.getUint32(8); w.tick = dv.getUint32(12);
  const n = W * H; let o = 24;
  w.mat.set(buf.subarray(o, o + n)); o += n; w.aux.set(buf.subarray(o, o + n)); o += n; w.life.set(buf.subarray(o, o + n)); o += n;
  w.flags.set(buf.subarray(o, o + n)); o += n; new Uint8Array(w.vel.buffer).set(buf.subarray(o, o + n)); o += n;
  for (let i = 0; i < n; i++, o += 2) w.temp[i] = dv.getInt16(o);
  return w;
}

// Deflate + base64 for share codes and local slots (CompressionStream exists in browsers and Node 18+).
async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const res = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}
export async function toCode(w: World) {
  const z = await pipe(encode(w), new CompressionStream('deflate-raw'));
  let s = ''; for (let i = 0; i < z.length; i += 0x8000) s += String.fromCharCode(...z.subarray(i, i + 0x8000));
  return btoa(s);
}
export async function fromCode(code: string) {
  const bin = atob(code.trim()), z = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) z[i] = bin.charCodeAt(i);
  return decode(await pipe(z, new DecompressionStream('deflate-raw')));
}

/**
 * Re-cut a world to a new grid size, e.g. when a phone is turned from portrait to landscape.
 * The ground stays on the ground (the typical surface row lands about 58% of the way down), columns are centred,
 * and anything beyond the old edges is a mirror image so rivers and hills carry on naturally.
 */
export function reshape(src: World, w: number, h: number): World {
  const out = new World(w, h, src.seed);
  out.rngState = src.rngState; out.tick = src.tick;
  const tops: number[] = [];
  for (let x = 0; x < src.w; x++) for (let y = 0; y < src.h; y++) { const m = src.mat[y * src.w + x]; if (m !== M.Empty && PHASE[m] !== Phase.Gas) { tops.push(y); break; } }
  tops.sort((a, b) => a - b);
  const dy = tops.length ? Math.round(h * .58 - tops[tops.length >> 1]) : h - src.h;
  const dx = Math.floor((w - src.w) / 2), period = src.w * 2;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.h - 1, y - dy);
    if (sy < 0) continue;
    for (let x = 0; x < w; x++) {
      let sx = (((x - dx) % period) + period) % period; if (sx >= src.w) sx = period - 1 - sx;
      const i = y * w + x, j = sy * src.w + sx;
      out.mat[i] = src.mat[j]; out.aux[i] = src.aux[j]; out.life[i] = src.life[j]; out.flags[i] = src.flags[j]; out.vel[i] = src.vel[j]; out.temp[i] = src.temp[j];
    }
  }
  return out;
}
