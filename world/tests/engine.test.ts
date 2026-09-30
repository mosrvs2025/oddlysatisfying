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
