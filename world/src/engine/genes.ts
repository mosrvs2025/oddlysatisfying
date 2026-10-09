import { World, GENETIC } from './world.ts';
import { M, MATS } from './materials.ts';

/** What each of the two 4-bit traits (low nibble, high nibble) means for every living species. */
export interface Trait { name: string; blurb: string }
export interface Species { mat: number; name: string; traits: [Trait, Trait] }

export const SPECIES: Species[] = [
  { mat: M.Bug, name: 'Bugs', traits: [
    { name: 'Coat', blurb: 'Thick fur survives deeper cold, but burns more food. Breed bugs in the cold.' },
    { name: 'Swimming', blurb: 'Swimmers breathe through their skin and paddle in water, but are clumsy on land.' }] },
  { mat: M.Fish, name: 'Fish', traits: [
    { name: 'Heat tolerance', blurb: 'Survives warmer water. Breed fish in warm water.' },
    { name: 'Lungs', blurb: 'Breathes air for longer. At the top end, fish crawl onto land.' }] },
  { mat: M.Plant, name: 'Plants', traits: [
    { name: 'Height', blurb: 'Taller stems reach more light, but need more water to get there.' },
    { name: 'Frost hardiness', blurb: 'Survives deeper frost, but grows slower. Seeds that fall in the cold lean this way.' }] },
  { mat: M.Algae, name: 'Algae', traits: [
    { name: 'Growth', blurb: 'Spreads faster through the water.' },
    { name: 'Low light', blurb: 'Grows in the dark, deep water, but spreads more slowly. Shade pushes this up.' }] },
];

export interface Census { species: Species; count: number; hist: [number[], number[]]; mean: [number, number] }

/** Count each species and the spread of each of its traits. Scans the whole grid, so call it a couple of times a second at most. */
export function census(w: World): Census[] {
  const out: Census[] = SPECIES.map(species => ({ species, count: 0, hist: [new Array(16).fill(0), new Array(16).fill(0)], mean: [0, 0] }));
  const at = new Map(out.map(c => [c.species.mat, c]));
  for (let i = 0; i < w.n; i++) {
    const m = w.mat[i]; if (!GENETIC[m]) continue;
    const c = at.get(m); if (!c) continue;   // seeds are not counted
    const g = w.aux[i];
    c.count++; c.hist[0][g & 15]++; c.hist[1][g >> 4]++; c.mean[0] += g & 15; c.mean[1] += g >> 4;
  }
  for (const c of out) if (c.count) { c.mean[0] /= c.count; c.mean[1] /= c.count; }
  return out;
}
export const speciesColor = (m: number) => `rgb(${MATS[m].color.join(',')})`;
