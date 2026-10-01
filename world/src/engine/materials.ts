// Materials are data. Behaviour comes from a handful of shared physical rules
// (movement by phase + density, heat flow + phase changes, combustion, conduction)
// plus a small optional hook for living things. Adding a material means adding a row here.

export const Phase = { Empty: 0, Static: 1, Powder: 2, Liquid: 3, Gas: 4, Life: 5 } as const;

export const M = {
  Empty: 0, Wall: 1, Stone: 2, Sand: 3, Dirt: 4, Water: 5, SaltWater: 6, Salt: 7, Ice: 8, Snow: 9,
  Steam: 10, Oil: 11, Lava: 12, Obsidian: 13, Acid: 14, Wood: 15, Plant: 16, Seed: 17, Fungus: 18,
  Bug: 19, Fire: 20, Smoke: 21, Metal: 22, Rust: 23, Gunpowder: 24, Methane: 25, Battery: 26,
  Ash: 27, Glass: 28, Hydrogen: 29, Fish: 30, Algae: 31,
} as const;
export const MAT_COUNT = 32;

export interface MaterialDef {
  id: number;
  name: string;
  phase: number;
  color: [number, number, number];
  variance: number;       // per-cell colour jitter 0..1
  density: number;        // heavier sinks through lighter fluids/gases (air = 1)
  conduct: number;        // heat conductivity 0..1
  capacity: number;       // heat capacity multiplier (>= 1)
  startTemp?: number;     // temperature when painted (defaults to ambient)
  emissive?: number;      // self-light 0..1 (independent of temperature glow)
  // phase changes: above `hot` becomes `hotTo`, below `cold` becomes `coldTo`
  hot?: number; hotTo?: number; hotFind?: string;
  cold?: number; coldTo?: number; coldFind?: string;
  // combustion
  ignite?: number; fuel?: number; burnTemp?: number; burnTo?: number; burnFind?: string; explosive?: number; smoky?: number;
  // electricity: probability a charge front passes into this cell
  conductive?: number;
  dispersion?: number;    // liquids: how far they spread sideways per tick
  blowable?: number;      // powders: how easily wind lifts them (0..1)
  acidProof?: boolean;
  indestructible?: boolean;
  starter?: boolean;      // available from the start; the rest are discovered
  blurb: string;
}

const D: MaterialDef[] = [];
function def(d: MaterialDef) { D[d.id] = d; }

def({ id: M.Empty, name: 'Air', phase: Phase.Empty, color: [0, 0, 0], variance: 0, density: 1, conduct: .06, capacity: 1, blurb: '' });
def({ id: M.Wall, name: 'Wall', phase: Phase.Static, color: [92, 96, 110], variance: .08, density: 99, conduct: .25, capacity: 4, indestructible: true, acidProof: true, starter: true, blurb: 'Indestructible. Takes heat slowly.' });
def({ id: M.Stone, name: 'Stone', phase: Phase.Static, color: [120, 116, 112], variance: .16, density: 30, conduct: .35, capacity: 2, hot: 1150, hotTo: M.Lava, hotFind: 'stone-melts', starter: true, blurb: 'Solid rock. Melts into lava; shatters in a blast.' });
def({ id: M.Sand, name: 'Sand', phase: Phase.Powder, color: [226, 196, 128], variance: .14, density: 16, conduct: .25, capacity: 1.5, hot: 1400, hotTo: M.Glass, hotFind: 'sand-glass', blowable: .05, starter: true, blurb: 'Piles up. Fuses into glass in extreme heat.' });
def({ id: M.Dirt, name: 'Soil', phase: Phase.Powder, color: [112, 78, 52], variance: .18, density: 14, conduct: .2, capacity: 2, starter: true, blurb: 'Soaks up water. Seeds sprout in wet soil.' });
def({ id: M.Water, name: 'Water', phase: Phase.Liquid, color: [48, 120, 220], variance: .06, density: 10, conduct: .45, capacity: 4, hot: 100, hotTo: M.Steam, hotFind: 'boil', cold: 0, coldTo: M.Ice, coldFind: 'freeze', conductive: .45, dispersion: 5, starter: true, blurb: 'Flows, boils, freezes, conducts. Life needs it.' });
def({ id: M.SaltWater, name: 'Brine', phase: Phase.Liquid, color: [74, 150, 200], variance: .06, density: 11, conduct: .45, capacity: 4, hot: 102, hotTo: M.Salt, hotFind: 'desalinate', cold: -21, coldTo: M.Ice, coldFind: 'brine-freeze', conductive: 1, dispersion: 5, blurb: 'Salty water. Heavier than fresh water, freezes colder, conducts well.' });
def({ id: M.Salt, name: 'Salt', phase: Phase.Powder, color: [236, 236, 240], variance: .05, density: 15, conduct: .2, capacity: 1.5, blowable: .04, starter: true, blurb: 'Dissolves in water. Melts ice.' });
def({ id: M.Ice, name: 'Ice', phase: Phase.Static, color: [170, 214, 245], variance: .06, density: 9, conduct: .5, capacity: 4, startTemp: -30, hot: 0, hotTo: M.Water, hotFind: 'melt', starter: true, blurb: 'Frozen water, painted at -30 C.' });
def({ id: M.Snow, name: 'Snow', phase: Phase.Powder, color: [240, 246, 255], variance: .04, density: 5, conduct: .1, capacity: 2, startTemp: -10, hot: 1, hotTo: M.Water, hotFind: 'snow-melt', blowable: .5, blurb: 'Light and cold. Forms when vapour freezes high up.' });
def({ id: M.Steam, name: 'Steam', phase: Phase.Gas, color: [200, 210, 225], variance: .1, density: .5, conduct: .08, capacity: 1, startTemp: 130, cold: 55, coldTo: M.Water, coldFind: 'condense', blurb: 'Rises, cools, and falls again as rain or snow.' });
def({ id: M.Oil, name: 'Oil', phase: Phase.Liquid, color: [70, 52, 30], variance: .08, density: 8, conduct: .15, capacity: 2, ignite: 240, fuel: 90, burnTemp: 820, burnTo: M.Empty, smoky: .5, dispersion: 3, starter: true, burnFind: 'oil-burn', blurb: 'Floats on water. Burns long and dirty.' });
def({ id: M.Lava, name: 'Lava', phase: Phase.Liquid, color: [255, 96, 20], variance: .15, density: 25, conduct: .5, capacity: 3, startTemp: 1500, cold: 850, coldTo: M.Stone, coldFind: 'lava-cools', emissive: .9, dispersion: 1, acidProof: true, starter: true, blurb: 'Molten rock at 1500 C. Lights and burns everything.' });
def({ id: M.Obsidian, name: 'Obsidian', phase: Phase.Static, color: [38, 30, 52], variance: .12, density: 30, conduct: .3, capacity: 2, hot: 1300, hotTo: M.Lava, acidProof: true, blurb: 'Volcanic glass from lava quenched by water.' });
def({ id: M.Acid, name: 'Acid', phase: Phase.Liquid, color: [150, 240, 60], variance: .08, density: 12, conduct: .3, capacity: 3, emissive: .15, dispersion: 3, acidProof: true, hot: 180, hotTo: M.Smoke, hotFind: 'acid-fumes', starter: true, blurb: 'Eats most things. Glass, obsidian and walls resist it.' });
def({ id: M.Wood, name: 'Wood', phase: Phase.Static, color: [156, 100, 54], variance: .15, density: 7, conduct: .12, capacity: 2, ignite: 300, fuel: 180, burnTemp: 700, burnTo: M.Ash, smoky: .2, burnFind: 'wood-burn', starter: true, blurb: 'Burns slowly into ash. Fungus decomposes it.' });
def({ id: M.Plant, name: 'Plant', phase: Phase.Life, color: [60, 170, 70], variance: .18, density: 7, conduct: .15, capacity: 3, ignite: 230, fuel: 30, burnTemp: 600, burnTo: M.Ash, smoky: .3, burnFind: 'plant-burn', blurb: 'Grows toward light, drinks water, flowers and drops seeds.' });
def({ id: M.Seed, name: 'Seed', phase: Phase.Powder, color: [196, 160, 80], variance: .12, density: 7, conduct: .15, capacity: 1.5, ignite: 160, fuel: 6, burnTemp: 500, burnTo: M.Ash, blowable: .35, starter: true, blurb: 'Floats on water. Sprouts on wet soil.' });
def({ id: M.Fungus, name: 'Fungus', phase: Phase.Life, color: [196, 150, 190], variance: .2, density: 7, conduct: .1, capacity: 2, ignite: 210, fuel: 25, burnTemp: 500, burnTo: M.Ash, blurb: 'Spreads in damp darkness and digests wood.' });
def({ id: M.Bug, name: 'Bugs', phase: Phase.Life, color: [230, 60, 60], variance: .2, density: 11, conduct: .2, capacity: 1.5, ignite: 120, fuel: 4, burnTemp: 400, burnTo: M.Ash, starter: true, blurb: 'Walk, climb, eat plants, breed when fed, starve into soil.' });
def({ id: M.Fish, name: 'Fish', phase: Phase.Life, color: [250, 150, 60], variance: .25, density: 10, conduct: .2, capacity: 3, ignite: 200, fuel: 4, burnTemp: 400, burnTo: M.Ash, starter: true, blurb: 'Swim, eat algae and anything that falls in, breed when fed. Need water to breathe.' });
def({ id: M.Algae, name: 'Algae', phase: Phase.Life, color: [70, 150, 90], variance: .25, density: 10, conduct: .3, capacity: 3, blurb: 'Grows through sunlit water, faster where soil is rich. Dries out of water.' });
def({ id: M.Fire, name: 'Fire', phase: Phase.Gas, color: [255, 150, 40], variance: .3, density: .3, conduct: .6, capacity: 1, startTemp: 900, emissive: 1, blurb: 'Hot rising flame. Needs fuel to keep going.' });
def({ id: M.Smoke, name: 'Smoke', phase: Phase.Gas, color: [70, 70, 76], variance: .2, density: .7, conduct: .05, capacity: 1, blurb: 'Drifts on the wind and fades.' });
def({ id: M.Metal, name: 'Metal', phase: Phase.Static, color: [150, 160, 176], variance: .06, density: 40, conduct: 1, capacity: 1.2, hot: 1500, hotTo: M.Lava, conductive: 1, starter: true, blurb: 'Conducts heat and electricity. Rusts when wet.' });
def({ id: M.Rust, name: 'Rust', phase: Phase.Powder, color: [150, 72, 40], variance: .15, density: 18, conduct: .2, capacity: 1.5, blowable: .05, blurb: 'Crumbly oxidised metal. Does not conduct.' });
def({ id: M.Gunpowder, name: 'Gunpowder', phase: Phase.Powder, color: [58, 58, 64], variance: .2, density: 12, conduct: .2, capacity: 1, ignite: 170, fuel: 1, burnTemp: 900, burnTo: M.Smoke, explosive: 5, starter: true, burnFind: 'explosion', blurb: 'Explodes when it gets hot or sparked.' });
def({ id: M.Methane, name: 'Methane', phase: Phase.Gas, color: [120, 190, 140], variance: .1, density: .6, conduct: .05, capacity: 1, ignite: 520, fuel: 1, burnTemp: 1200, burnTo: M.Fire, explosive: 2, burnFind: 'methane-burn', blurb: 'Swamp gas from rot. Burns in a flash.' });
def({ id: M.Battery, name: 'Battery', phase: Phase.Static, color: [230, 190, 40], variance: .04, density: 40, conduct: .3, capacity: 2, conductive: 1, starter: true, blurb: 'Sends pulses of electricity into anything conductive it touches.' });
def({ id: M.Ash, name: 'Ash', phase: Phase.Powder, color: [150, 146, 140], variance: .15, density: 6, conduct: .1, capacity: 1, blowable: .6, blurb: 'What fire leaves. Enriches soil, neutralises acid.' });
def({ id: M.Glass, name: 'Glass', phase: Phase.Static, color: [190, 230, 235], variance: .05, density: 25, conduct: .2, capacity: 2, hot: 1700, hotTo: M.Lava, acidProof: true, blurb: 'Clear and acid-proof. Shatters in a blast.' });
def({ id: M.Hydrogen, name: 'Hydrogen', phase: Phase.Gas, color: [210, 170, 240], variance: .08, density: .1, conduct: .1, capacity: 1, ignite: 500, fuel: 1, burnTemp: 1300, burnTo: M.Steam, explosive: 2, burnFind: 'hydrogen-burn', blurb: 'Lightest gas. Burns into water vapour.' });

export const MATS: readonly MaterialDef[] = D;

// Flat lookup tables so the hot loops never touch objects.
function table(f: (d: MaterialDef) => number) { const t = new Float32Array(MAT_COUNT); for (let i = 0; i < MAT_COUNT; i++) t[i] = f(D[i]); return t; }
export const PHASE = Uint8Array.from(D.map(d => d.phase));
export const DENSITY = table(d => d.density);
export const CONDUCT = table(d => d.conduct);
export const CAPACITY = table(d => d.capacity);
export const HOT = table(d => d.hot ?? 1e9);
export const HOT_TO = Uint8Array.from(D.map(d => d.hotTo ?? d.id));
export const COLD = table(d => d.cold ?? -1e9);
export const COLD_TO = Uint8Array.from(D.map(d => d.coldTo ?? d.id));
export const IGNITE = table(d => d.ignite ?? 1e9);
export const FUEL = Uint8Array.from(D.map(d => d.fuel ?? 0));
export const BURN_TEMP = table(d => d.burnTemp ?? 0);
export const BURN_TO = Uint8Array.from(D.map(d => d.burnTo ?? M.Empty));
export const EXPLOSIVE = table(d => d.explosive ?? 0);
export const SMOKY = table(d => d.smoky ?? 0);
export const CONDUCTIVE = table(d => d.conductive ?? 0);
export const DISPERSION = Uint8Array.from(D.map(d => d.dispersion ?? 0));
export const BLOWABLE = table(d => d.blowable ?? 0);
export const ACIDPROOF = Uint8Array.from(D.map(d => (d.acidProof || d.indestructible) ? 1 : 0));
export const MOVABLE = Uint8Array.from(D.map(d => (d.phase === Phase.Powder || d.phase === Phase.Liquid || d.phase === Phase.Gas) ? 1 : 0));
export const FLUIDISH = Uint8Array.from(D.map(d => (d.phase === Phase.Empty || d.phase === Phase.Liquid || d.phase === Phase.Gas) ? 1 : 0));
export const OPAQUE = Uint8Array.from(D.map(d => (d.phase === Phase.Static || d.phase === Phase.Powder || d.phase === Phase.Life) && d.id !== M.Glass ? 1 : 0));
