import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/engine/world.ts';
import { M, MATS } from '../src/engine/materials.ts';
import { DISCOVERIES } from '../src/engine/discoveries.ts';
import { paint } from '../src/engine/tools.ts';
import { encode, decode, snapshot, restore } from '../src/engine/serialize.ts';
import { SCENARIOS, run } from './scenarios.ts';

function scripted(seed: number) {
  const w = new World(120, 80, seed);
  paint(w, 60, 10, 8, M.Sand); paint(w, 30, 20, 6, M.Water); paint(w, 90, 60, 5, M.Lava);
  paint(w, 20, 70, 10, M.Wood); paint(w, 20, 60, 3, M.Fire); paint(w, 100, 20, 4, M.Gunpowder); paint(w, 100, 30, 3, M.Lava);
  for (let t = 0; t < 400; t++) w.step();
  return w;
}

test('same seed and inputs replay to the identical world', () => {
  assert.equal(scripted(42).hash(), scripted(42).hash());
});
test('different seeds diverge', () => {
  assert.notEqual(scripted(42).hash(), scripted(43).hash());
});
test('at least 20 materials and 50 distinct discoveries exist', () => {
  assert.ok(MATS.filter(Boolean).length - 1 >= 20);
  assert.ok(new Set(DISCOVERIES.map(d => d.id)).size === DISCOVERIES.length);
  assert.ok(DISCOVERIES.length >= 50);
});
test('every discovery has a scenario', () => {
  const have = new Set(SCENARIOS.map(s => s.id));
  const missing = DISCOVERIES.filter(d => !have.has(d.id)).map(d => d.id);
  assert.deepEqual(missing, []);
});
for (const sc of SCENARIOS) {
  test(`reaction emerges: ${sc.id}`, () => {
    const w = run(sc);
    assert.ok(w.found.has(sc.id), `${sc.id} did not happen; saw ${[...w.found].join(', ')}`);
  });
}
test('sand piles instead of stacking in a column', () => {
  const w = new World(40, 40, 3);
  for (let t = 0; t < 400; t++) { if (t < 200) w.spawn(20, M.Sand); w.step(); }
  let width = 0; for (let x = 0; x < 40; x++) if (w.mat[39 * 40 + x] === M.Sand) width++;
  assert.ok(width > 8, `pile base only ${width} wide`);
});
test('water finds its level', () => {
  const w = new World(40, 30, 3);
  for (let y = 5; y < 25; y++) for (let x = 0; x < 6; x++) w.spawn(y * 40 + x, M.Water);
  for (let t = 0; t < 1200; t++) w.step();
  let hl = 0, hr = 0; for (let y = 0; y < 30; y++) { if (w.mat[y * 40 + 2] === M.Water) hl++; if (w.mat[y * 40 + 37] === M.Water) hr++; }
  assert.ok(Math.abs(hl - hr) <= 1, `left ${hl} right ${hr}`);
});
test('oil ends up above water', () => {
  const w = new World(20, 30, 5);
  for (let y = 10; y < 16; y++) for (let x = 0; x < 20; x++) w.spawn(y * 20 + x, M.Water);
  for (let y = 20; y < 26; y++) for (let x = 0; x < 20; x++) w.spawn(y * 20 + x, M.Oil);
  for (let t = 0; t < 600; t++) w.step();
  assert.equal(w.mat[29 * 20 + 10], M.Water);
});
test('save and load round-trips the world', () => {
  const w = scripted(9), bytes = encode(w), a = decode(bytes), b = decode(bytes);
  assert.deepEqual(a.mat, w.mat); assert.deepEqual(a.flags, w.flags); assert.equal(a.rngState, w.rngState);
  // a loaded world replays deterministically
  for (let t = 0; t < 100; t++) { a.step(); b.step(); }
  assert.equal(a.hash(), b.hash());
});
test('undo snapshot restores the exact state', () => {
  const w = scripted(11), s = snapshot(w), h0 = w.hash();
  paint(w, 60, 40, 10, M.Acid); for (let t = 0; t < 30; t++) w.step();
  assert.notEqual(w.hash(), h0);
  restore(w, s); assert.equal(w.hash(), h0);
});
test('a full-size world steps in budget', () => {
  const w = new World(320, 220, 1);
  paint(w, 160, 60, 40, M.Sand); paint(w, 80, 100, 30, M.Water); paint(w, 250, 150, 20, M.Lava); paint(w, 160, 190, 50, M.Dirt);
  for (let t = 0; t < 60; t++) w.step();
  const t0 = performance.now(); for (let t = 0; t < 120; t++) w.step();
  const ms = (performance.now() - t0) / 120;
  assert.ok(ms < 12, `${ms.toFixed(2)} ms per step`);
});
test('oil painted into the bottom of a pond displaces the water and floats to the top', () => {
  const w = new World(30, 40, 7);
  for (let y = 10; y < 40; y++) for (let x = 0; x < 30; x++) w.spawn(y * 30 + x, M.Water);
  const water0 = w.count(M.Water);
  for (let k = 0; k < 12; k++) paint(w, 15, 36, 3, M.Oil);
  const oil = w.count(M.Oil);
  assert.ok(oil > 10, `only ${oil} oil placed`);
  assert.equal(w.count(M.Water), water0, 'water was destroyed instead of displaced');
  for (let t = 0; t < 900; t++) w.step();
  let deepOil = 0; for (let y = 25; y < 40; y++) for (let x = 0; x < 30; x++) if (w.mat[y * 30 + x] === M.Oil) deepOil++;
  assert.ok(deepOil <= 1, `${deepOil} oil cells still deep underwater`);
});
test('natural selection: in the cold only furry bugs survive, and their children inherit the coat', () => {
  const w = new World(60, 30, 5);
  for (let x = 0; x < 60; x++) w.spawn(29 * 60 + x, M.Wall);
  for (let y = 22; y < 29; y++) for (let x = 3; x < 57; x++) w.spawn(y * 60 + x, M.Plant);
  for (let k = 0; k < 48; k++) { const i = 21 * 60 + 5 + k; w.spawn(i, M.Bug); w.aux[i] = k % 16; }
  for (let t = 0; t < 1500; t++) { if (t % 5 === 0) for (let i = 18 * 60; i < w.n; i++) w.temp[i] = -16; w.step(); }
  let n = 0, sum = 0;
  for (let i = 0; i < w.n; i++) if (w.mat[i] === M.Bug) { n++; sum += w.aux[i] & 15; }
  assert.ok(n > 0, 'every bug died');
  assert.ok(sum / n >= 5, `survivors averaged coat ${(sum / n).toFixed(1)}; the unfit should have died`);
});
test('genes are inherited by children, with the odd change', () => {
  const w = new World(10, 10, 3); w.mutation = 4;
  let same = 0, diff = 0;
  for (let k = 0; k < 400; k++) (w.inherit(0x58) === 0x58 ? same++ : diff++);
  assert.ok(same > 100 && diff > 50, `same ${same} diff ${diff}`);
  for (let k = 0; k < 400; k++) { const g = w.inherit(0xf0, true, true); assert.ok((g & 15) <= 15 && (g >> 4) <= 15); }
});
test('the mutate tool changes genes only in living things', async () => {
  const { mutate } = await import('../src/engine/tools.ts');
  const w = new World(30, 30, 2);
  for (let x = 5; x < 25; x++) { w.spawn(10 * 30 + x, M.Bug); w.aux[10 * 30 + x] = 0x33; w.spawn(11 * 30 + x, M.Sand); w.aux[11 * 30 + x] = 0x33; }
  for (let t = 0; t < 40; t++) mutate(w, 15, 10, 12);
  let bugChanged = 0, sandChanged = 0;
  for (let x = 5; x < 25; x++) { if (w.aux[10 * 30 + x] !== 0x33) bugChanged++; if (w.aux[11 * 30 + x] !== 0x33) sandChanged++; }
  assert.ok(bugChanged > 10); assert.equal(sandChanged, 0);
});
test('reshaping keeps the ground on the ground and the sky above it', async () => {
  const { reshape } = await import('../src/engine/serialize.ts');
  const w = new World(100, 200, 4);
  for (let y = 120; y < 200; y++) for (let x = 0; x < 100; x++) w.spawn(y * 100 + x, y > 180 ? M.Stone : M.Dirt);
  for (let x = 40; x < 60; x++) for (let y = 110; y < 120; y++) w.spawn(y * 100 + x, M.Water);
  const r = reshape(w, 220, 90);
  assert.equal(r.w, 220); assert.equal(r.h, 90);
  const surface = (x: number) => { for (let y = 0; y < 90; y++) if (r.mat[y * 220 + x]) return y; return -1; };
  const s = surface(5);
  assert.ok(s > 25 && s < 70, `ground at row ${s} of 90`);
  assert.equal(r.mat[89 * 220 + 110], M.Dirt);
  let water = 0; for (let i = 0; i < r.n; i++) if (r.mat[i] === M.Water) water++;
  assert.ok(water > 0, 'the pond was lost');
  for (let t = 0; t < 30; t++) r.step();   // and it still runs
});
