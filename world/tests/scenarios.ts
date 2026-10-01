import { World, F } from '../src/engine/world.ts';
import { M } from '../src/engine/materials.ts';
import { lightning, bomb, wind, storm } from '../src/engine/tools.ts';

// One small, hand-built world per discovery. Each proves the reaction emerges from the rules:
// nothing here calls world.find() directly.
type Setup = (w: World) => void;
export interface Scenario { id: string; size?: [number, number]; ticks: number; setup: Setup; each?: Setup }

function rect(w: World, x0: number, y0: number, x1: number, y1: number, m: number, t?: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.spawn(y * w.w + x, m, t);
}
function floor(w: World, m: number = M.Wall) { rect(w, 0, w.h - 1, w.w - 1, w.h - 1, m); }
function set(w: World, x: number, y: number, m: number, t?: number) { w.spawn(y * w.w + x, m, t); }

export const SCENARIOS: Scenario[] = [
  { id: 'boil', ticks: 60, setup: w => { floor(w); rect(w, 10, 25, 20, 28, M.Water, 150); } },
  { id: 'condense', ticks: 400, setup: w => { rect(w, 10, 20, 20, 22, M.Steam, 70); } },
  { id: 'freeze', ticks: 200, setup: w => { floor(w); rect(w, 9, 24, 9, 28, M.Wall); rect(w, 21, 24, 21, 28, M.Wall); rect(w, 10, 26, 20, 28, M.Water, -6); set(w, 15, 25, M.Ice); } },
  { id: 'melt', ticks: 60, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Ice, 30); } },
  { id: 'snowfall', ticks: 200, setup: w => { rect(w, 10, 3, 20, 4, M.Steam, -5); } },
  { id: 'snow-melt', ticks: 200, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Snow, 30); } },
  { id: 'stone-melts', ticks: 30, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Stone, 1300); } },
  { id: 'lava-cools', ticks: 60, setup: w => { floor(w); rect(w, 10, 27, 20, 28, M.Lava, 700); } },
  { id: 'sand-glass', ticks: 30, setup: w => { floor(w); rect(w, 10, 27, 20, 28, M.Sand, 1500); } },
  { id: 'red-hot', ticks: 30, setup: w => { floor(w); rect(w, 10, 27, 20, 28, M.Metal, 800); } },
  { id: 'metal-melts', ticks: 30, setup: w => { floor(w); rect(w, 10, 27, 20, 28, M.Metal, 1600); } },
  { id: 'dry-out', ticks: 300, setup: w => { floor(w); rect(w, 10, 27, 20, 28, M.Dirt); rect(w, 10, 26, 20, 26, M.Water); }, each: w => { if (w.tick === 150) for (let x = 10; x <= 20; x++) for (let y = 20; y <= 28; y++) w.temp[y * w.w + x] = 200; } },
  { id: 'acid-fumes', ticks: 30, setup: w => { floor(w); rect(w, 10, 27, 20, 28, M.Acid, 250); } },
  { id: 'heat-rises', ticks: 60, setup: w => { floor(w); rect(w, 14, 27, 16, 28, M.Lava); } },
  { id: 'cold-top', ticks: 300, setup: w => { rect(w, 10, 3, 20, 4, M.Steam, -5); } },
  { id: 'wood-burn', ticks: 120, setup: w => { floor(w); rect(w, 10, 22, 20, 28, M.Wood); rect(w, 12, 21, 18, 21, M.Fire); } },
  { id: 'oil-burn', ticks: 120, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Oil); rect(w, 12, 24, 18, 25, M.Fire); } },
  { id: 'plant-burn', ticks: 120, setup: w => { floor(w); rect(w, 14, 20, 15, 28, M.Plant); rect(w, 13, 27, 13, 28, M.Fire); } },
  { id: 'fungus-burn', ticks: 150, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Fungus, 400); } },
  { id: 'bug-burn', ticks: 60, setup: w => { floor(w); rect(w, 10, 28 - 1, 12, 27, M.Bug, 90); } },
  { id: 'seed-burn', ticks: 60, setup: w => { floor(w); rect(w, 10, 27, 20, 27, M.Seed, 300); } },
  { id: 'douse', ticks: 200, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Wood); rect(w, 10, 24, 20, 25, M.Fire); rect(w, 10, 5, 20, 8, M.Water); } },
  { id: 'smother', ticks: 400, setup: w => { floor(w); rect(w, 5, 26, 25, 28, M.Wood, 400); }, each: w => { if (w.tick === 10) rect(w, 3, 18, 27, 25, M.Sand); } },
  { id: 'fire-ice', ticks: 120, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Ice); rect(w, 10, 24, 20, 25, M.Fire); } },
  { id: 'explosion', ticks: 150, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Gunpowder); rect(w, 14, 25, 16, 25, M.Fire); } },
  { id: 'methane-burn', ticks: 60, setup: w => { rect(w, 10, 10, 20, 14, M.Methane); rect(w, 10, 15, 20, 15, M.Fire); } },
  { id: 'hydrogen-burn', ticks: 60, setup: w => { rect(w, 10, 10, 20, 14, M.Hydrogen); rect(w, 10, 15, 20, 15, M.Fire); } },
  { id: 'shatter', ticks: 5, setup: w => { floor(w); rect(w, 10, 20, 20, 28, M.Glass); }, each: w => { if (w.tick === 1) bomb(w, 15, 24, 3); } },
  { id: 'crumble', ticks: 5, setup: w => { floor(w); rect(w, 10, 20, 20, 28, M.Stone); }, each: w => { if (w.tick === 1) bomb(w, 15, 24, 3); } },
  { id: 'fireball', ticks: 5, setup: w => { floor(w); }, each: w => { if (w.tick === 1) bomb(w, 15, 15, 3); } },
  { id: 'shockwave', ticks: 5, setup: w => { floor(w); rect(w, 5, 24, 25, 28, M.Sand); }, each: w => { if (w.tick === 1) bomb(w, 15, 24, 2); } },
  { id: 'dissolve', ticks: 120, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Water); rect(w, 12, 24, 18, 25, M.Salt); } },
  { id: 'salt-ice', ticks: 200, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Ice, -10); rect(w, 12, 25, 18, 25, M.Salt); }, each: w => { for (let x = 10; x <= 20; x++) for (let y = 25; y <= 28; y++) if (w.mat[y * w.w + x] === M.Ice) w.temp[y * w.w + x] = -10; } },
  { id: 'desalinate', ticks: 60, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.SaltWater, 150); } },
  { id: 'brine-freeze', ticks: 30, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.SaltWater, -40); } },
  { id: 'halocline', ticks: 60, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Water); rect(w, 10, 20, 20, 22, M.SaltWater); } },
  { id: 'float', ticks: 60, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Oil); rect(w, 10, 20, 20, 22, M.Water); } },
  { id: 'obsidian', ticks: 60, setup: w => { floor(w); rect(w, 10, 26, 20, 28, M.Water); rect(w, 12, 22, 18, 24, M.Lava); } },
  { id: 'acid-metal', ticks: 120, setup: w => { floor(w); rect(w, 10, 27, 20, 28, M.Metal); rect(w, 10, 25, 20, 26, M.Acid); } },
  { id: 'acid-stone', ticks: 120, setup: w => { floor(w); rect(w, 10, 27, 20, 28, M.Stone); rect(w, 10, 25, 20, 26, M.Acid); } },
  { id: 'corrode', ticks: 120, setup: w => { floor(w); rect(w, 10, 27, 20, 28, M.Wood); rect(w, 10, 25, 20, 26, M.Acid); } },
  { id: 'dilute', ticks: 200, setup: w => { floor(w); rect(w, 10, 27, 20, 28, M.Water); rect(w, 10, 25, 20, 26, M.Acid); } },
  { id: 'neutralize', ticks: 200, setup: w => { floor(w); rect(w, 10, 27, 20, 28, M.Acid); rect(w, 10, 25, 20, 26, M.Ash); } },
  { id: 'acid-glass', ticks: 120, setup: w => { floor(w, M.Glass); rect(w, 10, 27, 20, 28, M.Acid); } },
  { id: 'rust', ticks: 3000, setup: w => { floor(w); rect(w, 5, 27, 25, 28, M.Metal); rect(w, 5, 24, 25, 26, M.Water); } },
  { id: 'rust-salt', ticks: 600, setup: w => { floor(w); rect(w, 5, 27, 25, 28, M.Metal); rect(w, 5, 24, 25, 26, M.SaltWater); } },
  { id: 'current', ticks: 40, setup: w => { floor(w); rect(w, 5, 27, 25, 27, M.Metal); set(w, 4, 27, M.Battery); } },
  { id: 'wet-current', ticks: 40, setup: w => { floor(w); rect(w, 5, 27, 25, 28, M.Water); set(w, 4, 27, M.Battery); } },
  { id: 'electrolysis', ticks: 300, setup: w => { floor(w); rect(w, 5, 24, 25, 28, M.Water); rect(w, 4, 24, 4, 28, M.Battery); } },
  { id: 'spark-ignite', ticks: 40, setup: w => { floor(w); rect(w, 5, 27, 25, 27, M.Metal); set(w, 4, 27, M.Battery); rect(w, 5, 26, 25, 26, M.Gunpowder); } },
  { id: 'electrocute', ticks: 200, setup: w => { floor(w); rect(w, 3, 28, 28, 28, M.Metal); set(w, 2, 28, M.Battery); rect(w, 8, 27, 20, 27, M.Bug); } },
  { id: 'resist-heat', ticks: 400, setup: w => { floor(w); rect(w, 5, 27, 8, 27, M.Metal); set(w, 4, 27, M.Battery); set(w, 9, 27, M.Battery); } },
  { id: 'lightning', ticks: 5, setup: w => { floor(w); }, each: w => { if (w.tick === 1) lightning(w, 15, 27); } },
  { id: 'fulgurite', ticks: 5, setup: w => { floor(w); rect(w, 5, 25, 25, 28, M.Sand); }, each: w => { if (w.tick === 1) lightning(w, 15, 25); } },
  { id: 'soak', ticks: 60, setup: w => { floor(w); rect(w, 5, 27, 25, 28, M.Dirt); rect(w, 5, 25, 25, 26, M.Water); } },
  { id: 'sprout', ticks: 120, setup: w => { floor(w); rect(w, 5, 27, 25, 28, M.Dirt); rect(w, 5, 25, 25, 26, M.Water); set(w, 15, 10, M.Seed); } },
  { id: 'plant-drinks', ticks: 200, setup: w => { floor(w); rect(w, 5, 27, 25, 28, M.Stone); rect(w, 15, 22, 15, 26, M.Plant); rect(w, 16, 26, 25, 26, M.Water); } },
  { id: 'phototropism', ticks: 200, setup: w => { floor(w); rect(w, 5, 10, 25, 10, M.Stone); set(w, 15, 27, M.Plant); }, each: w => { const i = 27 * w.w + 15; if (w.tick === 1) { w.flags[i] = F.TIP; w.life[i] = 200; } } },
  { id: 'bloom', ticks: 3000, size: [30, 90], setup: w => { floor(w); set(w, 15, 88, M.Plant); }, each: w => { const i = 88 * w.w + 15; if (w.tick === 1) { w.flags[i] = F.TIP; w.aux[i] = 0; } if (w.mat[i] === M.Plant) w.life[i] = 255; } },
  { id: 'reproduce', ticks: 2000, setup: w => { floor(w); set(w, 15, 20, M.Plant); }, each: w => { const i = 20 * w.w + 15; if (w.tick === 1) w.flags[i] = F.FLOWER; if (w.mat[i] === M.Plant) w.life[i] = 200; } },
  { id: 'frostbite', ticks: 30, setup: w => { floor(w); rect(w, 15, 22, 15, 28, M.Plant, -20); } },
  { id: 'salted-earth', ticks: 200, setup: w => { floor(w); rect(w, 15, 22, 15, 28, M.Plant); rect(w, 16, 26, 25, 28, M.SaltWater); } },
  { id: 'bug-eats', ticks: 400, setup: w => { floor(w); rect(w, 5, 26, 25, 28, M.Plant); rect(w, 10, 25, 12, 25, M.Bug); } },
  { id: 'bug-breeds', ticks: 1500, setup: w => { floor(w); rect(w, 3, 22, 27, 28, M.Plant); rect(w, 10, 21, 12, 21, M.Bug); } },
  { id: 'starve', ticks: 4000, setup: w => { floor(w); rect(w, 10, 28, 12, 28, M.Bug); } },
  { id: 'bug-drown', ticks: 600, setup: w => { floor(w); rect(w, 3, 18, 27, 28, M.Water); rect(w, 10, 5, 12, 5, M.Bug); } },
  { id: 'bug-cold', ticks: 20, setup: w => { floor(w); rect(w, 10, 28, 12, 28, M.Bug, -20); } },
  { id: 'fertilize', ticks: 400, setup: w => { floor(w); rect(w, 5, 27, 25, 28, M.Dirt); rect(w, 5, 25, 25, 26, M.Ash); } },
  { id: 'fungus-appears', ticks: 6000, setup: w => { floor(w); rect(w, 0, 5, 29, 5, M.Stone); rect(w, 5, 24, 25, 28, M.Dirt); rect(w, 5, 23, 25, 23, M.Wood); for (let x = 5; x <= 25; x++) for (let y = 24; y <= 28; y++) w.flags[y * w.w + x] |= F.WET; }, each: w => { if (w.tick % 50 === 0) for (let x = 5; x <= 25; x++) for (let y = 24; y <= 28; y++) if (w.mat[y * w.w + x] === M.Dirt) w.flags[y * w.w + x] |= F.WET; } },
  { id: 'decompose', ticks: 600, setup: w => { floor(w); rect(w, 0, 5, 29, 5, M.Stone); rect(w, 5, 24, 25, 28, M.Wood); rect(w, 14, 23, 16, 23, M.Fungus); } },
  { id: 'fungus-light', ticks: 1500, setup: w => { floor(w); rect(w, 10, 28, 20, 28, M.Fungus); } },
  { id: 'swamp-gas', ticks: 2000, setup: w => { floor(w); rect(w, 0, 5, 29, 5, M.Stone); rect(w, 5, 26, 25, 28, M.Fungus); } },
  { id: 'wind-blown', ticks: 60, setup: w => { floor(w); rect(w, 5, 26, 25, 28, M.Ash); }, each: w => wind(w, 10, 26, 6, 1.2, -.4) },
  { id: 'tornado', ticks: 120, setup: w => { floor(w); rect(w, 3, 25, 27, 28, M.Sand); storm(w, 15, 14, 6); } },
  { id: 'waterspout', ticks: 120, setup: w => { floor(w); rect(w, 3, 25, 27, 28, M.Water); storm(w, 15, 14, 6); } },
  { id: 'hurricane', size: [80, 60], ticks: 60, setup: w => { floor(w); storm(w, 40, 20, 14); } },
  { id: 'algae-appears', ticks: 3000, setup: w => { floor(w); rect(w, 0, 26, 29, 28, M.Dirt); for (let x = 0; x < 30; x++) for (let y = 26; y < 29; y++) w.flags[y * 30 + x] |= F.FERT; rect(w, 0, 22, 29, 25, M.Water); } },
  { id: 'algae-bloom', ticks: 600, setup: w => { floor(w); rect(w, 0, 20, 29, 28, M.Water); set(w, 15, 22, M.Algae); } },
  { id: 'algae-dries', ticks: 1200, setup: w => { floor(w); rect(w, 10, 28, 20, 28, M.Algae); } },
  { id: 'fish-eats', ticks: 600, setup: w => { floor(w); rect(w, 0, 20, 29, 28, M.Water); set(w, 15, 24, M.Fish); rect(w, 13, 22, 17, 26, M.Algae); set(w, 15, 24, M.Fish); } },
  { id: 'fish-breeds', ticks: 3000, setup: w => { floor(w); rect(w, 0, 18, 29, 28, M.Water); rect(w, 0, 18, 29, 28, M.Algae); for (let y = 18; y < 29; y += 2) for (let x = 0; x < 30; x += 2) set(w, x, y, M.Water); set(w, 15, 24, M.Fish); } },
  { id: 'food-chain', ticks: 600, setup: w => { floor(w); rect(w, 5, 24, 25, 28, M.Water); set(w, 15, 27, M.Fish); set(w, 14, 26, M.Bug); set(w, 16, 26, M.Bug); set(w, 15, 25, M.Bug); } },
  { id: 'fish-suffocate', ticks: 600, setup: w => { floor(w); set(w, 15, 27, M.Fish); } },
  { id: 'fish-cooked', ticks: 60, setup: w => { floor(w); rect(w, 5, 24, 25, 28, M.Water, 80); set(w, 15, 26, M.Fish); } },
  { id: 'fish-starve', ticks: 4000, setup: w => { floor(w); rect(w, 5, 20, 25, 28, M.Water); set(w, 15, 26, M.Fish); } },
  { id: 'waves', ticks: 60, setup: w => { floor(w); rect(w, 3, 24, 27, 28, M.Water); }, each: w => wind(w, 10, 23, 6, 1.5, 0) },
];

export function run(sc: Scenario, seed = 1) {
  const [W, H] = sc.size ?? [30, 30];
  const w = new World(W, H, seed);
  sc.setup(w);
  for (let t = 0; t < sc.ticks && !w.found.has(sc.id); t++) { sc.each?.(w); w.step(); }
  return w;
}
