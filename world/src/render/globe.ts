import type { World } from '../engine/world.ts';
import { MATS, PHASE, Phase, M } from '../engine/materials.ts';

/**
 * The 3D globe: every column of the world becomes a line of longitude. What the simulation has at the
 * surface of that column (rock, sand, water, plants, snow, fire, lava) paints the ground there; the gas
 * above it (steam, smoke, rain) becomes the clouds. Latitude is not simulated, so the poles are
 * shaped from the column's own surface temperature and the coastlines are meandered with noise.
 */
export const GLOBE_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uCols, uCols2; uniform vec2 uScreen; uniform vec3 uCenter; // cx, cy, radius (device px)
uniform float uYaw, uTilt, uTime; uniform vec4 uStorm[4]; uniform int uStorms;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int k = 0; k < 5; k++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
// noise that wraps around in longitude so there is no seam at lon = 0
float fbmL(float lon, float lat, float sc){ vec2 c = vec2(cos(lon * 6.2831853), sin(lon * 6.2831853)) * sc; return fbm(vec2(c.x + lat * sc * 1.3, c.y - lat * sc * .7) + 5.); }
vec3 rotX(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }
vec3 rotY(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
void main(){
  vec2 px = vUv * uScreen; px.y = uScreen.y - px.y;
  vec2 p = (px - uCenter.xy) / uCenter.z; p.y = -p.y;
  float r2 = dot(p, p);
  vec3 space = vec3(.012, .015, .03);
  float st = hash(floor(px / 2.5)); if (st > .996) space += vec3(.8, .85, 1.) * (.4 + .6 * sin(uTime * 1.7 + st * 80.));
  vec3 sun = normalize(vec3(-.55, .35, .75));
  if (r2 > 1.) {
    float d = sqrt(r2) - 1.;
    float glow = exp(-d * 18.) * .9 + exp(-d * 5.) * .15;
    vec2 pn = normalize(p); float lit = clamp(dot(vec3(pn, 0.), sun) + .35, 0., 1.);
    o = vec4(space + vec3(.3, .55, 1.) * glow * lit, 1.); return;
  }
  vec3 n = vec3(p, sqrt(1. - r2));
  vec3 q = rotY(rotX(n, -uTilt), -uYaw);          // point on the planet in its own frame
  float lat = asin(clamp(q.y, -1., 1.)), lon = fract(atan(q.x, q.z) / 6.2831853 + .5);
  float al = abs(lat) / 1.5708;
  // coastlines wander with latitude so continents are shapes, not stripes
  float u = fract(lon + (fbmL(lon, lat, 3.) - .5) * (.07 + .16 * al) + (fbmL(lon + .3, lat, 9.) - .5) * .025);
  vec4 c1 = texture(uCols, vec2(u, .5)), c2 = texture(uCols2, vec2(u, .5));
  vec3 ground = c1.rgb; float water = c2.a, fire = c2.r, temp = c2.g * 120. - 40., green = c2.b;
  float grain = fbmL(lon, lat, 22.);
  ground *= .85 + .3 * grain;
  ground = mix(ground, vec3(.18, .45, .16) * (.8 + .4 * grain), green * (1. - water));
  // ice caps: the colder the column is at its surface, the further the ice reaches toward the equator
  float ice = smoothstep(.0, .12, al - clamp(.55 + temp / 70., .25, 1.05) + (fbmL(lon, lat, 6.) - .5) * .25);
  float deep = water * (.6 + .4 * fbmL(lon, lat, 4.));
  vec3 sea = mix(vec3(.05, .25, .5), vec3(.02, .09, .25), deep);
  vec3 surf = mix(ground, sea, water);
  surf = mix(surf, vec3(.92, .95, 1.), ice);
  // clouds: the column's own vapour, carried by banded winds and broken up into weather
  float band = sin(lat * 3.) * .018;
  float cu = fract(lon + uTime * (.004 + band));
  float vap = max(.28 + .12 * sin(lat * 5.), texture(uCols, vec2(cu, .5)).a);
  float cl = smoothstep(.55 - vap * .45, .9, fbmL(cu, lat + uTime * .003, 5.) * (.55 + vap * .9));
  // storms from the simulation spin as cyclones at their longitude
  for (int k = 0; k < 4; k++) {
    if (k >= uStorms) break;
    vec4 s = uStorm[k];
    vec3 c = normalize(vec3(sin((s.x - .5) * 6.2831853) * cos(.45), sin(.45), cos((s.x - .5) * 6.2831853) * cos(.45)));
    float d = acos(clamp(dot(q, c), -1., 1.)), R = s.y;
    if (d < R * 2.5) {
      vec3 e1 = normalize(cross(c, vec3(0, 1, 0))), e2 = cross(c, e1);
      float a = atan(dot(q, e2), dot(q, e1));
      float arm = sin(a * 2. + log(d / R + .05) * 5. * s.z - uTime * 3. * s.z) * .5 + .5;
      float eye = smoothstep(R * .12, R * .3, d);
      cl = max(cl, arm * exp(-d / R) * eye * s.w * 1.4);
    }
  }
  cl = clamp(cl, 0., 1.);
  float diff = max(0., dot(n, sun)), night = smoothstep(.05, -.15, dot(n, sun));
  vec3 h = normalize(sun + vec3(0, 0, 1));
  float spec = pow(max(0., dot(n, h)), 60.) * water * (1. - ice) * (1. - cl);
  vec3 col = surf * (.06 + diff * 1.05) + spec * vec3(1., .95, .8) * .8;
  col = mix(col, vec3(1.) * (.1 + diff * 1.1), cl * .9);
  // fire and lava glow through on the night side
  col += vec3(1., .45, .12) * fire * (.25 + night * 1.6) * (1. - cl * .6);
  // lightning inside storm clouds
  col += vec3(.7, .8, 1.) * cl * step(.985, hash(vec2(floor(uTime * 12.), floor(lon * 40.)))) * step(.5, cl) * .8;
  float rim = pow(1. - n.z, 3.);
  col += vec3(.3, .55, 1.) * rim * (.25 + diff * .6);
  o = vec4(1. - exp(-col * 1.3), 1.);
}`;

/** Summarise each world column for the globe. cols: rgb ground colour, a vapour. cols2: r fire, g temperature, b plants, a water. */
export function buildColumns(W: World, cols: Uint8Array, cols2: Uint8Array) {
  const w = W.w, h = W.h, mat = W.mat;
  for (let x = 0; x < w; x++) {
    let vap = 0, y = 0, surf = 0;
    for (; y < h; y++) {
      const m = mat[y * w + x], ph = PHASE[m];
      if (m === M.Empty) continue;
      if (ph === Phase.Gas) { vap += m === M.Steam ? 1 : m === M.Smoke ? .8 : .4; continue; }
      if (m === M.Water && y < h - 1 && mat[(y + 1) * w + x] === M.Empty) { vap += .5; continue; } // falling rain
      surf = m; break;
    }
    let fire = 0, green = 0, water = 0, r = 0, g = 0, b = 0, n = 0;
    for (let k = 0; k < 10 && y + k < h; k++) {
      const i = (y + k) * w + x, m = mat[i];
      if (m === M.Fire || m === M.Lava || (W.flags[i] & 1)) fire += 1;
      if (m === M.Plant || m === M.Fungus) green += 1;
      if (m === M.Water || m === M.SaltWater) water += 1;
      const c = MATS[m].color; if (m !== M.Empty && PHASE[m] !== Phase.Gas) { r += c[0]; g += c[1]; b += c[2]; n++; }
    }
    // ground colour: what lies under any water, so seabeds read as seabeds
    if (n) { r /= n; g /= n; b /= n; } else { const c = MATS[surf].color; r = c[0]; g = c[1]; b = c[2]; }
    const t = W.temp[Math.min(h - 1, y) * w + x];
    const o = x * 4;
    cols[o] = r; cols[o + 1] = g; cols[o + 2] = b; cols[o + 3] = Math.min(255, vap * 18);
    cols2[o] = Math.min(255, fire * 60); cols2[o + 1] = Math.max(0, Math.min(255, (t + 40) / 120 * 255));
    cols2[o + 2] = Math.min(255, green * 90); cols2[o + 3] = (surf === M.Water || surf === M.SaltWater || water >= 3) ? 255 : 0;
  }
}

/** Which column's surface is hit when the globe is touched at screen point p (CSS px). Returns null off-planet. */
export function pickGlobe(px: number, py: number, cx: number, cy: number, R: number, yaw: number, tilt: number) {
  const x = (px - cx) / R, y = -(py - cy) / R, r2 = x * x + y * y;
  if (r2 > 1) return null;
  let v = [x, y, Math.sqrt(1 - r2)];
  // inverse of the shader: rotX(-tilt) then rotY(-yaw)
  let c = Math.cos(-tilt), s = Math.sin(-tilt); v = [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
  c = Math.cos(-yaw); s = Math.sin(-yaw); v = [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
  let lon = Math.atan2(v[0], v[2]) / (2 * Math.PI) + .5; lon -= Math.floor(lon);
  return { lon, lat: Math.asin(Math.max(-1, Math.min(1, v[1]))) };
}
