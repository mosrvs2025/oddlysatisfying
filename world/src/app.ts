import { World } from './engine/world.ts';
import { M, MATS, MAT_COUNT, PHASE, Phase } from './engine/materials.ts';
import { DISCOVERIES, DISCOVERY_BY_ID, TOOL_UNLOCKS } from './engine/discoveries.ts';
import { paint, erase, heat, wind, rain, bomb, gravityWell, timeWarp, lightning, storm, flushStormBolts } from './engine/tools.ts';
import { snapshot, restore, toCode, fromCode, type Snapshot } from './engine/serialize.ts';
import { Renderer, type Camera, type ViewMode } from './render/renderer.ts';
import { makeScene, sizeFor, type SceneId } from './scenes.ts';
import { pickGlobe } from './render/globe.ts';
import { CSS } from './styles.ts';
import { Sound } from './sound.ts';

type Tool = 'paint' | 'erase' | 'heat' | 'cool' | 'wind' | 'storm' | 'bolt' | 'bomb' | 'rain' | 'gravity' | 'time';
const TOOLS: { id: Tool; name: string; icon: string; tip: string }[] = [
  { id: 'paint', name: 'Paint', icon: '<path d="M4 20c2 0 4-1 4-3.5S10 13 12 13l6-9 2 2-9 6c0 2-3 3.5-3 5.5S6 20 4 20z"/>', tip: 'Paint the chosen material' },
  { id: 'erase', name: 'Erase', icon: '<path d="M8 20h12M5 15l8-8 5 5-6 6H8z"/>', tip: 'Remove anything' },
  { id: 'heat', name: 'Heat', icon: '<path d="M12 3c3 4 5 6 5 10a5 5 0 01-10 0c0-2 1-3.5 2-4.5.5 1.5 1.5 2.5 3 2.5-1-3 0-5 0-8z"/>', tip: 'Warm whatever is under your finger' },
  { id: 'cool', name: 'Freeze', icon: '<path d="M12 2v20M4 7l16 10M4 17l16-10M9 4l3 2 3-2M9 20l3-2 3 2"/>', tip: 'Chill whatever is under your finger' },
  { id: 'wind', name: 'Wind', icon: '<path d="M3 8h11a3 3 0 10-3-3M3 12h15a3 3 0 11-3 3M3 16h7"/>', tip: 'Drag to blow air the way you move' },
  { id: 'storm', name: 'Storm', icon: '<path d="M4 5h16M6 9h12M8 13h8M10 17h4M11.5 21h1"/>', tip: 'Hold to spin up a storm. Small brush: tornado. Keep feeding a big one: hurricane' },
  { id: 'rain', name: 'Rain', icon: '<path d="M7 14a4 4 0 010-8 5 5 0 019.6 1.5A3.3 3.3 0 0117 14z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>', tip: 'Rain falls from the sky above your finger' },
  { id: 'bolt', name: 'Lightning', icon: '<path d="M13 2L5 13h6l-2 9 9-12h-6z"/>', tip: 'Tap to strike' },
  { id: 'bomb', name: 'Blast', icon: '<circle cx="11" cy="14" r="6.5"/><path d="M15.5 9.5L18 7M18 7l1.5-2M18 7l2 1"/>', tip: 'Tap to detonate' },
  { id: 'gravity', name: 'Gravity', icon: '<circle cx="12" cy="12" r="2.5"/><path d="M12 3a9 9 0 019 9M21 12a9 9 0 01-9 9M12 21a9 9 0 01-9-9M3 12a9 9 0 019-9" stroke-dasharray="3 3"/>', tip: 'Pulls loose things toward your finger' },
  { id: 'time', name: 'Time', icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>', tip: 'Everything near your finger runs four times faster' },
];
const LS = 'terrarium.';
const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const rgb = (m: number) => `rgb(${MATS[m].color.join(',')})`;
const svg = (p: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;

export interface MountOptions { onClose?: () => void; closeLabel?: string }

export function mount(host: HTMLElement, opts: MountOptions = {}) {
  if (!document.getElementById('tr-css')) { const s = document.createElement('style'); s.id = 'tr-css'; s.textContent = CSS; document.head.appendChild(s); }
  const root = document.createElement('div'); root.className = 'tr';
  root.innerHTML = `
  <canvas class="tr-cv"></canvas>
  <div class="tr-top">
    <div class="tr-left">
      ${opts.onClose ? `<button class="tr-ib" data-a="close" aria-label="${opts.closeLabel ?? 'Back'}">${svg('<path d="M15 5l-7 7 7 7"/>')}</button>` : ''}
      <button class="tr-title" data-a="codex"><b>Terrarium</b><span class="tr-count"></span></button>
    </div>
    <div class="tr-right">
      <button class="tr-ib" data-a="undo" aria-label="Undo">${svg('<path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2"/>')}</button>
      <button class="tr-ib" data-a="redo" aria-label="Redo">${svg('<path d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h2"/>')}</button>
      <button class="tr-ib" data-a="globe" aria-label="Globe view">${svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>')}</button>
      <button class="tr-ib" data-a="pause" aria-label="Pause"></button>
      <button class="tr-ib tr-speed" data-a="speed" aria-label="Speed">1×</button>
      <button class="tr-ib" data-a="menu" aria-label="Menu">${svg('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>')}</button>
    </div>
  </div>
  <div class="tr-toasts"></div>
  <pre class="tr-debug" hidden></pre>
  <div class="tr-dock">
    <div class="tr-tip"></div>
    <div class="tr-row tr-tools"></div>
    <div class="tr-row tr-mats"></div>
    <div class="tr-size"><span>Brush</span><input type="range" min="0" max="24" step="1" aria-label="Brush size"><output></output></div>
  </div>
  <div class="tr-sheet" hidden><div class="tr-sheet-in"><button class="tr-ib tr-x" data-a="shut" aria-label="Close">${svg('<path d="M6 6l12 12M18 6L6 18"/>')}</button><div class="tr-body"></div></div></div>`;
  host.appendChild(root);
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as unknown as T;
  const canvas = $<HTMLCanvasElement>('.tr-cv'), toastsEl = $('.tr-toasts'), debugEl = $('.tr-debug'), toolsEl = $('.tr-tools'), matsEl = $('.tr-mats');
  const sizeIn = $<HTMLInputElement>('.tr-size input'), sizeOut = $('.tr-size output'), tipEl = $('.tr-tip'), sheet = $('.tr-sheet'), sheetBody = $('.tr-body');

  let R: Renderer;
  try { R = new Renderer(canvas); } catch (e) {
    root.innerHTML = `<div class="tr-fail"><p>Terrarium needs WebGL2, which this browser does not offer.</p>${opts.onClose ? '<button class="tr-btn" data-a="close">Back</button>' : ''}</div>`;
    root.addEventListener('click', ev => { if ((ev.target as HTMLElement).closest('[data-a=close]')) opts.onClose?.(); });
    return { destroy() { root.remove(); } };
  }
  const snd = new Sound();

  // ---------------- state ----------------
  let world!: World;
  const known = new Set<string>(store.get<string[]>('found', []));
  let unlockAll = store.get('unlockAll', false);
  let tool: Tool = store.get<Tool>("tool", "paint"), mat: number = store.get<number>("mat", M.Sand), brush: number = store.get('brush', 4);
  let paused = false, speed = 1, view: ViewMode = 'normal', debug = store.get('debug', false);
  const cam: Camera = { zoom: 1, x: 0, y: 0 };
  // globe view: zoom 1 shows the whole planet; rot is in turns
  const globe = { on: false, zoom: 1, rot: 0 };
  // 3D globe: yaw/tilt in radians, zoom scales the sphere
  const sph = { on: false, zoom: 1, yaw: 0, tilt: .35, idle: 0 };
  function sphGeom() { const cw = canvas.clientWidth, ch = canvas.clientHeight; return { cx: cw / 2, cy: (ch - 110) / 2, r: Math.min(cw, ch - 150) * .42 * sph.zoom }; }
  function globeGeom() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const base = Math.min(cw, ch - 150) * .6, rOut = base * globe.zoom;
    // choose the core size so cells near the surface come out roughly square
    const surf = .38, ratio = 2 * Math.PI / world.w * world.h; // rIn/rOut solving 2π·r_s/W = (rOut-rIn)/H
    let k = (1 - ratio * (1 - surf)) / (1 + ratio * surf);
    k = Math.max(.12, Math.min(.6, k));
    const rIn = rOut * k, rs = rOut - surf * (rOut - rIn);
    return { cx: cw / 2, cy: (ch - 110) / 2 + rs * (1 - 1 / globe.zoom), rOut, rIn, rs };
  }
  /** View cycle: 0 flat, 1 ring (the world wrapped into a planet slice), 2 spinning 3D globe. */
  function setView3(v: number) {
    globe.on = v === 1; sph.on = v === 2; store.set('view3', v);
    $('[data-a=globe]').classList.toggle('on', v > 0);
    $('[data-a=globe]').setAttribute('aria-label', ['Globe view', '3D globe', 'Flat view'][v]);
    paintHeld = null;
    if (v === 1) showTip('Planet slice. Two-finger drag or right-drag spins it, pinch flies down to the surface. Tap the globe button again for 3D');
    if (v === 2) showTip('3D globe, drawn live from your world. Drag to spin, pinch to zoom, tap the planet to use your tool there');
  }
  const view3 = () => sph.on ? 2 : globe.on ? 1 : 0;
  function setGlobe(on: boolean) { setView3(on ? 1 : 0); }
  const undo: Snapshot[] = [], redo: Snapshot[] = [];
  let seed = (Math.random() * 2 ** 31) | 0;

  function fit() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    cam.zoom = Math.min(cw / world.w, ch / world.h); cam.x = world.w / 2; cam.y = world.h / 2;
    minZoom = cam.zoom * .8;
  }
  let minZoom = 1;
  function newWorld(id: SceneId) {
    const { w, h } = id === 'planet' ? { w: 500, h: 132 } : sizeFor(canvas.clientWidth / Math.max(1, canvas.clientHeight));
    if (id === 'planet' && view3() === 0) setView3(2);
    seed = (seed * 1103515245 + 12345) >>> 0;
    setWorld(makeScene(id, w, h, seed));
    undo.length = 0; redo.length = 0;
  }
  function setWorld(w: World) { world = w; R.setWorld(w); fit(); lastBoom = w.stats.explosions; }

  // ---------------- unlocks ----------------
  function matUnlocked(m: number) {
    if (unlockAll || MATS[m].starter) return true;
    for (const id of known) if (DISCOVERY_BY_ID.get(id)?.unlocks?.includes(m)) return true;
    return false;
  }
  function toolUnlocked(t: Tool) {
    const u = TOOL_UNLOCKS[t]; if (!u || unlockAll) return true;
    if (u.after && !known.has(u.after)) return false;
    if (u.count && known.size < u.count) return false;
    return true;
  }
  function toolLock(t: Tool) {
    const u = TOOL_UNLOCKS[t]!;
    return u.after ? `Discover ${DISCOVERY_BY_ID.get(u.after)!.name.toLowerCase()} to unlock` : `Unlocks at ${u.count} discoveries (${known.size} so far)`;
  }

  // ---------------- UI ----------------
  function buildTools() {
    toolsEl.innerHTML = '';
    for (const t of TOOLS) {
      const b = document.createElement('button'), ok = toolUnlocked(t.id);
      b.className = 'tr-tool' + (t.id === tool ? ' on' : '') + (ok ? '' : ' locked');
      b.innerHTML = svg(t.icon) + `<span>${t.name}</span>`; b.title = ok ? t.tip : toolLock(t.id);
      b.onclick = () => { if (!ok) { showTip(toolLock(t.id)); return; } tool = t.id; store.set('tool', tool); buildTools(); buildMats(); showTip(t.tip); };
      toolsEl.appendChild(b);
    }
  }
  function buildMats() {
    matsEl.innerHTML = '';
    matsEl.classList.toggle('dim', tool !== 'paint');
    for (let m = 1; m < MAT_COUNT; m++) {
      if (!matUnlocked(m)) continue;
      const b = document.createElement('button');
      b.className = 'tr-mat' + (m === mat ? ' on' : '');
      b.innerHTML = `<i style="background:${rgb(m)}"></i><span>${MATS[m].name}</span>`;
      b.title = MATS[m].blurb;
      b.onclick = () => { mat = m; tool = 'paint'; store.set('mat', m); store.set('tool', tool); buildTools(); buildMats(); showTip(`${MATS[m].name}: ${MATS[m].blurb}`); };
      matsEl.appendChild(b);
    }
    const locked = MAT_COUNT - 1 - [...Array(MAT_COUNT - 1)].filter((_, k) => matUnlocked(k + 1)).length;
    if (locked) { const s = document.createElement('span'); s.className = 'tr-more'; s.textContent = `+${locked} to discover`; matsEl.appendChild(s); }
  }
  let tipTimer = 0;
  function showTip(s: string) { tipEl.textContent = s; tipEl.classList.add('on'); clearTimeout(tipTimer); tipTimer = window.setTimeout(() => tipEl.classList.remove('on'), 2600); }
  function updateCount() { $('.tr-count').textContent = `${known.size} of ${DISCOVERIES.length} discovered`; }
  function setBrush(v: number) { brush = Math.max(0, Math.min(24, v)); sizeIn.value = String(brush); sizeOut.textContent = String(brush + 1); store.set('brush', brush); }
  function updateTop() {
    $('[data-a=pause]').innerHTML = paused ? svg('<path d="M7 5l12 7-12 7z"/>') : svg('<path d="M8 5v14M16 5v14"/>');
    $('[data-a=pause]').setAttribute('aria-label', paused ? 'Play' : 'Pause');
    $('[data-a=speed]').textContent = speed + '×';
    $('[data-a=undo]').toggleAttribute('disabled', !undo.length); $('[data-a=redo]').toggleAttribute('disabled', !redo.length);
  }
  function toast(id: string) {
    const d = DISCOVERY_BY_ID.get(id); if (!d) return;
    const el = document.createElement('div'); el.className = 'tr-toast';
    const extra: string[] = [];
    for (const m of d.unlocks ?? []) extra.push(MATS[m].name);
    el.innerHTML = `<small>${d.group} · discovered</small><b>${d.name}</b><p>${d.text}</p>${extra.length ? `<em>New: ${extra.join(', ')}</em>` : ''}`;
    toastsEl.prepend(el);
    while (toastsEl.children.length > 2) toastsEl.lastElementChild!.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 4200);
    snd.chime(known.size);
  }
  function openSheet(html: string, bind?: () => void) { sheetBody.innerHTML = html; sheet.hidden = false; paintHeld = null; bind?.(); }
  function codex() {
    const groups = [...new Set(DISCOVERIES.map(d => d.group))];
    openSheet(`<h2>Codex</h2><p class="tr-lead">${known.size} of ${DISCOVERIES.length} phenomena seen. Nothing here is scripted: each one happens only when the materials meet the right conditions.</p>` +
      groups.map(g => `<h3>${g}</h3><ul class="tr-codex">` + DISCOVERIES.filter(d => d.group === g).map(d => known.has(d.id)
        ? `<li class="got"><b>${d.name}</b><span>${d.text}</span></li>` : `<li><b>???</b><span>${hintFor(d.id)}</span></li>`).join('') + '</ul>').join('') +
      `<label class="tr-check"><input type="checkbox" ${unlockAll ? 'checked' : ''}> Unlock every material and tool now</label>`, () => {
      sheetBody.querySelector<HTMLInputElement>('.tr-check input')!.onchange = e => { unlockAll = (e.target as HTMLInputElement).checked; store.set('unlockAll', unlockAll); buildTools(); buildMats(); };
    });
  }
  function hintFor(id: string) {
    const d = DISCOVERY_BY_ID.get(id)!;
    // vague hint: first few words of the explanation with nouns kept, verbs hidden
    const w = d.text.split(' ');
    return w.slice(0, Math.min(3, w.length)).join(' ') + '…';
  }
  async function menu() {
    const slots = [0, 1, 2].map(k => store.get<{ at: number; code: string } | null>('slot' + k, null));
    openSheet(`<h2>World</h2>
      <div class="tr-grid">
        <button class="tr-btn" data-s="valley">New valley</button><button class="tr-btn" data-s="lab">New workshop</button><button class="tr-btn" data-s="planet">New planet</button><button class="tr-btn" data-s="empty">Empty world</button>
      </div>
      <h3>Save slots</h3>
      <div class="tr-slots">${slots.map((s, k) => `<div><span>Slot ${k + 1}${s ? ' · ' + new Date(s.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ' · empty'}</span><button class="tr-btn sm" data-save="${k}">Save</button><button class="tr-btn sm" data-load="${k}" ${s ? '' : 'disabled'}>Load</button></div>`).join('')}</div>
      <h3>Share code</h3>
      <textarea class="tr-code" rows="3" placeholder="Paste a world code here, or copy this one"></textarea>
      <div class="tr-grid"><button class="tr-btn" data-a="copycode">Copy this world</button><button class="tr-btn" data-a="loadcode">Load pasted code</button></div>
      <h3>See the hidden systems</h3>
      <div class="tr-grid">${(['normal', 'heat', 'air', 'charge'] as ViewMode[]).map(v => `<button class="tr-btn ${v === view ? 'on' : ''}" data-v="${v}">${{ normal: 'Normal', heat: 'Temperature', air: 'Air flow', charge: 'Electricity' }[v]}</button>`).join('')}</div>
      <label class="tr-check"><input type="checkbox" data-a="dbg" ${debug ? 'checked' : ''}> Performance readout</label>
      <label class="tr-check"><input type="checkbox" data-a="snd" ${snd.on ? 'checked' : ''}> Sound</label>
      <p class="tr-lead">Keys: G globe view, Space or right-drag pans, wheel zooms, [ and ] resize the brush, Ctrl+Z undo, P pause, 1 to 0 pick tools.</p>`, () => {
      sheetBody.querySelectorAll<HTMLElement>('[data-s]').forEach(b => b.onclick = () => { newWorld(b.dataset.s as SceneId); sheet.hidden = true; updateTop(); });
      sheetBody.querySelectorAll<HTMLElement>('[data-save]').forEach(b => b.onclick = async () => { store.set('slot' + b.dataset.save, { at: Date.now(), code: await toCode(world) }); menu(); });
      sheetBody.querySelectorAll<HTMLElement>('[data-load]').forEach(b => b.onclick = async () => { const s = store.get<{ code: string } | null>('slot' + b.dataset.load, null); if (s) { pushUndo(); setWorld(await fromCode(s.code)); sheet.hidden = true; updateTop(); } });
      sheetBody.querySelectorAll<HTMLElement>('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v as ViewMode; R.view = view; menu(); });
      const ta = sheetBody.querySelector<HTMLTextAreaElement>('.tr-code')!;
      sheetBody.querySelector<HTMLElement>('[data-a=copycode]')!.onclick = async () => { ta.value = await toCode(world); ta.select(); try { await navigator.clipboard.writeText(ta.value); showTip('World code copied'); } catch { showTip('Code is selected, copy it from the box'); } };
      sheetBody.querySelector<HTMLElement>('[data-a=loadcode]')!.onclick = async () => { try { const w = await fromCode(ta.value); pushUndo(); setWorld(w); sheet.hidden = true; updateTop(); } catch { showTip('That code did not load'); } };
      sheetBody.querySelector<HTMLInputElement>('[data-a=dbg]')!.onchange = e => { debug = (e.target as HTMLInputElement).checked; store.set('debug', debug); debugEl.hidden = !debug; };
      sheetBody.querySelector<HTMLInputElement>('[data-a=snd]')!.onchange = e => { snd.set((e.target as HTMLInputElement).checked); };
    });
  }
  function pushUndo() { undo.push(snapshot(world)); if (undo.length > 24) undo.shift(); redo.length = 0; updateTop(); }
  function doUndo() { const s = undo.pop(); if (!s) return; redo.push(snapshot(world)); if (s.mat.length === world.n) restore(world, s); updateTop(); }
  function doRedo() { const s = redo.pop(); if (!s) return; undo.push(snapshot(world)); if (s.mat.length === world.n) restore(world, s); updateTop(); }

  root.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
    if (!a) return;
    snd.unlock();
    if (a === 'close') opts.onClose?.();
    else if (a === 'codex') codex();
    else if (a === 'menu') menu();
    else if (a === 'shut') sheet.hidden = true;
    else if (a === 'undo') doUndo();
    else if (a === 'redo') doRedo();
    else if (a === 'globe') setView3((view3() + 1) % 3);
    else if (a === 'pause') { paused = !paused; updateTop(); }
    else if (a === 'speed') { speed = speed === 1 ? 2 : speed === 2 ? 4 : speed === 4 ? .5 : 1; updateTop(); }
  });
  sheet.addEventListener('pointerdown', e => { if (e.target === sheet) sheet.hidden = true; });
  sizeIn.oninput = () => setBrush(+sizeIn.value);

  // ---------------- input ----------------
  const ptrs = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  let paintHeld: { x: number; y: number; px: number; py: number; vx: number; vy: number; fresh: boolean; hold: number } | null = null;
  let pinch: { d: number; cx: number; cy: number; zoom: number; wx: number; wy: number } | null = null;
  let panning: { x: number; y: number } | null = null, spaceDown = false, hover = { x: -1, y: -1, in: false };
  let sphTap: { x: number; y: number; t: number } | null = null, burst = 0;
  /** A tap on the 3D globe uses the current tool at that spot's surface, for a short burst. */
  function tapSphere(sx: number, sy: number) {
    const r = canvas.getBoundingClientRect(), g = sphGeom();
    const hit = pickGlobe(sx - r.left, sy - r.top, g.cx, g.cy, g.r, sph.yaw, sph.tilt);
    if (!hit) return;
    const x = Math.min(world.w - 1, Math.floor(hit.lon * world.w));
    let y = 0; while (y < world.h - 1 && (world.mat[y * world.w + x] === M.Empty || PHASE[world.mat[y * world.w + x]] === Phase.Gas)) y++;
    const ty = tool === 'storm' || tool === 'rain' ? Math.max(4, y - 30) : Math.max(0, y - brush - 2);
    pushUndo();
    paintHeld = { x, y: ty, px: x, py: ty, vx: 0, vy: 0, fresh: true, hold: 0 };
    burst = tool === 'storm' ? 90 : 24;
  }
  const toWorld = (sx: number, sy: number) => {
    const r = canvas.getBoundingClientRect();
    if (globe.on) {
      const g = globeGeom(), dx = sx - r.left - g.cx, dy = sy - r.top - g.cy, pr = Math.hypot(dx, dy);
      let a = Math.atan2(dx, -dy) / (2 * Math.PI) + globe.rot; a -= Math.floor(a);
      return { x: a * world.w, y: (g.rOut - pr) / (g.rOut - g.rIn) * world.h };
    }
    return { x: (sx - r.left - r.width / 2) / cam.zoom + cam.x, y: (sy - r.top - r.height / 2) / cam.zoom + cam.y };
  };
  function clampCam() {
    cam.zoom = Math.max(minZoom, Math.min(minZoom * 14, cam.zoom));
    const hw = canvas.clientWidth / 2 / cam.zoom, hh = canvas.clientHeight / 2 / cam.zoom;
    cam.x = world.w <= hw * 2 ? world.w / 2 : Math.max(hw, Math.min(world.w - hw, cam.x));
    cam.y = world.h <= hh * 2 ? world.h / 2 : Math.max(hh, Math.min(world.h - hh, cam.y));
  }
  function zoomAt(sx: number, sy: number, z: number) {
    const a = toWorld(sx, sy); cam.zoom = z; clampCam();
    const b = toWorld(sx, sy); cam.x += a.x - b.x; cam.y += a.y - b.y; clampCam();
  }
  function startStroke(sx: number, sy: number) {
    const p = toWorld(sx, sy);
    pushUndo();
    paintHeld = { x: p.x, y: p.y, px: p.x, py: p.y, vx: 0, vy: 0, fresh: true, hold: 0 };
  }
  canvas.addEventListener('pointerdown', e => {
    snd.unlock();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ok */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (e.button === 1 || e.button === 2 || spaceDown) { panning = { x: e.clientX, y: e.clientY }; return; }
    if (ptrs.size === 2) {
      // second finger: this is a pinch, not a stroke; undo the dab the first finger made
      if (paintHeld && paintHeld.hold < 8) doUndo();
      paintHeld = null;
      const [a, b] = [...ptrs.values()], cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, w = toWorld(cx, cy);
      panning = null; sphTap = null;
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx, cy, zoom: sph.on ? sph.zoom : globe.on ? globe.zoom : cam.zoom, wx: w.x, wy: w.y };
      return;
    }
    if (ptrs.size === 1 && sph.on) { panning = { x: e.clientX, y: e.clientY }; sphTap = { x: e.clientX, y: e.clientY, t: performance.now() }; return; }
    if (ptrs.size === 1) startStroke(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    const w = toWorld(e.clientX, e.clientY); hover = { x: w.x, y: w.y, in: true };
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (sph.on) {
      sph.idle = 0;
      if (panning) {
        const R = sphGeom().r;
        sph.yaw += (e.clientX - panning.x) / R; sph.tilt = Math.max(-1.3, Math.min(1.3, sph.tilt + (e.clientY - panning.y) / R));
        panning = { x: e.clientX, y: e.clientY };
        if (sphTap && Math.hypot(e.clientX - sphTap.x, e.clientY - sphTap.y) > 8) sphTap = null;
      } else if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()];
        sph.zoom = Math.max(.6, Math.min(3, pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d)));
      }
      return;
    }
    if (panning && globe.on) { globe.rot -= (e.clientX - panning.x) / (2 * Math.PI * globeGeom().rs); panning = { x: e.clientX, y: e.clientY }; return; }
    if (panning) { cam.x -= (e.clientX - panning.x) / cam.zoom; cam.y -= (e.clientY - panning.y) / cam.zoom; panning = { x: e.clientX, y: e.clientY }; clampCam(); return; }
    if (pinch && ptrs.size >= 2 && globe.on) {
      const [a, b] = [...ptrs.values()], cx = (a.x + b.x) / 2;
      globe.zoom = Math.max(1, Math.min(8, pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d)));
      globe.rot -= (cx - pinch.cx) / (2 * Math.PI * globeGeom().rs); pinch.cx = cx;
      return;
    }
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      cam.zoom = pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d); clampCam();
      const r = canvas.getBoundingClientRect();
      cam.x = pinch.wx - (cx - r.left - r.width / 2) / cam.zoom; cam.y = pinch.wy - (cy - r.top - r.height / 2) / cam.zoom; clampCam();
      return;
    }
    if (paintHeld) { paintHeld.x = w.x; paintHeld.y = w.y; }
  });
  const up = (e: PointerEvent) => {
    if (sph.on && sphTap && ptrs.size === 1 && performance.now() - sphTap.t < 400) tapSphere(sphTap.x, sphTap.y);
    sphTap = null;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!ptrs.size) { panning = null; if (!burst) paintHeld = null; }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { hover.in = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.altKey || e.shiftKey) { setBrush(brush + (e.deltaY > 0 ? -1 : 1)); return; }
    const f = Math.exp(-e.deltaY * (e.deltaMode ? .05 : .0015));
    if (sph.on) { sph.zoom = Math.max(.6, Math.min(3, sph.zoom * f)); return; }
    if (globe.on) { globe.zoom = Math.max(1, Math.min(8, globe.zoom * f)); return; }
    zoomAt(e.clientX, e.clientY, cam.zoom * f);
  }, { passive: false });
  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected || root.hidden || (e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT' && (e.target as HTMLInputElement).type !== 'range') return;
    const down = e.type === 'keydown';
    if (e.code === 'Space') { spaceDown = down; e.preventDefault(); return; }
    if (!down) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
    else if (e.key === '[') setBrush(brush - 1);
    else if (e.key === ']') setBrush(brush + 1);
    else if (e.key === 'p' || e.key === 'P') { paused = !paused; updateTop(); }
    else if (e.key === 'g' || e.key === 'G') setView3((view3() + 1) % 3);
    else if (e.key === 'Escape') { if (!sheet.hidden) sheet.hidden = true; else opts.onClose?.(); }
    else { const k = '1234567890'.indexOf(e.key); if (k >= 0 && TOOLS[k] && toolUnlocked(TOOLS[k].id)) { tool = TOOLS[k].id; buildTools(); buildMats(); } }
    e.stopPropagation();
  };
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);

  // ---------------- applying tools (once per sim step, so held tools scale with speed) ----------------
  function applyTool() {
    const p = paintHeld; if (!p) return;
    const r = brush;
    const dx = p.x - p.px, dy = p.y - p.py;
    p.vx = p.vx * .6 + dx * .4; p.vy = p.vy * .6 + dy * .4;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(1, r * .7)));
    const each = (f: (x: number, y: number) => void) => { for (let k = 1; k <= steps; k++) f(p.px + dx * k / steps, p.py + dy * k / steps); };
    switch (tool) {
      case 'paint': each((x, y) => paint(world, x, y, r, mat, false)); break;
      case 'erase': each((x, y) => erase(world, x, y, r)); break;
      case 'heat': heat(world, p.x, p.y, r + 1, 40); break;
      case 'cool': heat(world, p.x, p.y, r + 1, -40); break;
      case 'wind': { const s = Math.hypot(p.vx, p.vy); if (s > .05) wind(world, p.x, p.y, r, p.vx / s * Math.min(3, s * .8 + .6), p.vy / s * Math.min(3, s * .8 + .6)); break; }
      case 'rain': rain(world, p.x, r); break;
      case 'storm': storm(world, p.x, p.y, r, p.vx < -.05 ? -1 : 1); break;
      case 'gravity': gravityWell(world, p.x, p.y, r); break;
      case 'time': timeWarp(world, p.x, p.y, r); break;
      case 'bolt': if (p.hold % 24 === 0) { lightning(world, p.x, p.y); snd.zap(); } break;
      case 'bomb': if (p.fresh) bomb(world, p.x, p.y, r); break;
    }
    p.px = p.x; p.py = p.y; p.fresh = false; p.hold++;
    if (burst > 0 && --burst === 0) paintHeld = null;
  }

  // ---------------- loop ----------------
  let raf = 0, last = performance.now(), acc = 0, fps = 60, simMs = 0, renderMs = 0, lastBoom = 0, frame = 0, cells = 0, fireN = 0;
  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.1, (now - last) / 1000); last = now; fps = fps * .95 + (1 / Math.max(.001, dt)) * .05;
    if (canvas.width !== Math.round(canvas.clientWidth * dpr()) || canvas.height !== Math.round(canvas.clientHeight * dpr())) resize();
    const t0 = performance.now();
    if (!paused) {
      acc += dt * 60 * speed;
      let n = 0;
      while (acc >= 1 && n < 4) { applyTool(); world.step(); if (world.pendingBolts.length) { flushStormBolts(world); snd.zap(); } acc -= 1; n++; }
      if (acc > 4) acc = 0; // do not spiral when the device cannot keep up
    }
    if (paused && paintHeld) applyTool(); // painting still works while paused
    simMs = simMs * .9 + (performance.now() - t0) * .1;
    // discoveries
    for (const id of world.newFinds) if (!known.has(id)) { known.add(id); toast(id); store.set('found', [...known]); buildTools(); buildMats(); updateCount(); }
    world.newFinds.length = 0;
    if (world.stats.explosions !== lastBoom) { snd.boom(Math.min(1, (world.stats.explosions - lastBoom) * .3)); lastBoom = world.stats.explosions; }
    if (frame % 20 === 0) { fireN = world.count(M.Fire); if (debug) { cells = 0; for (let i = 0; i < world.n; i++) if (world.mat[i]) cells++; } }
    snd.crackle(Math.min(1, fireN / 400), paintHeld && tool === 'paint' ? PHASE[mat] : -1);
    const t1 = performance.now();
    const showBrush = paintHeld || hover.in;
    R.brush = { x: paintHeld ? paintHeld.x : hover.x, y: paintHeld ? paintHeld.y : hover.y, r: brush + .5, on: showBrush && !pinch ? (paintHeld ? .5 : 1) : 0 };
    if (sph.on) {
      const g = sphGeom();
      if (!ptrs.size && ++sph.idle > 120) sph.yaw += .0025; // drifts slowly when left alone
      R.sphere = { on: true, cx: g.cx, cy: g.cy, r: g.r, yaw: sph.yaw, tilt: sph.tilt };
    } else R.sphere.on = false;
    if (globe.on) { const g = globeGeom(); R.planet = { on: true, cx: g.cx, cy: g.cy, rOut: g.rOut, rIn: g.rIn, rot: globe.rot }; }
    else R.planet.on = false;
    R.render(cam, now / 1000);
    renderMs = renderMs * .9 + (performance.now() - t1) * .1;
    if (debug && frame % 10 === 0) debugEl.textContent = `${fps.toFixed(0)} fps   sim ${simMs.toFixed(1)} ms   draw ${renderMs.toFixed(1)} ms\n${world.w}×${world.h} grid   ${cells} cells   ${world.debris.n} debris\ntick ${world.tick}   seed ${world.seed}   view ${view}`;
    frame++;
  }
  const dpr = () => Math.min(2, devicePixelRatio || 1);
  function resize() { canvas.width = Math.round(canvas.clientWidth * dpr()); canvas.height = Math.round(canvas.clientHeight * dpr()); const z = cam.zoom; fit(); if (frame > 0 && z > minZoom) { cam.zoom = z; clampCam(); } }

  // ---------------- start ----------------
  canvas.width = Math.round(canvas.clientWidth * dpr()); canvas.height = Math.round(canvas.clientHeight * dpr());
  newWorld('valley');
  setView3(store.get('view3', 0));
  for (let k = 0; k < 30; k++) world.step(); // settle the scene before the first frame
  world.newFinds.length = 0;
  debugEl.hidden = !debug;
  if (!matUnlocked(mat)) mat = M.Sand;
  if (!toolUnlocked(tool)) tool = 'paint';
  buildTools(); buildMats(); updateCount(); setBrush(brush); updateTop();
  showTip(known.size ? 'Welcome back. What happens if you…' : 'Paint, heat, flood, zap. Everything reacts to everything.');
  raf = requestAnimationFrame(loop);

  // test hook for automated browser checks
  (root as unknown as { terrarium: unknown }).terrarium = { get world() { return world; }, known, cam, setTool(t: Tool) { tool = t; }, setMat(m: number) { mat = m; }, R };

  return {
    root,
    destroy() { cancelAnimationFrame(raf); removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); snd.stop(); root.remove(); },
    hide() { root.hidden = true; cancelAnimationFrame(raf); snd.stop(); ptrs.clear(); paintHeld = null; spaceDown = false; },
    show() { root.hidden = false; cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop); },
  };
}
