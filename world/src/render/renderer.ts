import type { World } from '../engine/world.ts';

import { MATS, MAT_COUNT } from '../engine/materials.ts';

export type ViewMode = 'normal' | 'heat' | 'air' | 'charge';
export interface Camera { zoom: number; x: number; y: number } // x, y: world cell at the screen centre

// Temperature is packed into one byte: 0..20 covers -60..0 C, 20..255 covers 0..3000 C on a square-root curve.
export function packTemp(t: number) {
  if (t <= 0) return Math.max(0, Math.round(20 + t / 3));
  return Math.min(255, Math.round(20 + Math.sqrt(t / 3000) * 235));
}

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`;

const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
in vec2 vUv;
float tempOf(float b){ b *= 255.; return b < 20. ? (b - 20.) * 3. : pow((b - 20.) / 235., 2.) * 3000.; }
vec3 blackbody(float t){ // rough incandescence colour, 0 below ~450 C
  float k = clamp((t - 450.) / 1400., 0., 1.);
  return vec3(1., .25 + .6 * k, .05 + .5 * k * k) * smoothstep(0., .25, k) * (0.4 + 1.6 * k);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`;

// Pass 1: one texel per cell. Colour (alpha = coverage) and emissive light (alpha = heat haze).
const WORLD_FS = HEAD + `
uniform sampler2D uState, uPal, uProp; uniform vec2 uSize; uniform float uTime; uniform int uView;
uniform sampler2D uAir;
layout(location = 0) out vec4 oColor; layout(location = 1) out vec4 oGlow;
vec4 cell(vec2 c){ return texture(uState, (c + .5) / uSize); }
void main(){
  vec2 c = floor(vUv * uSize);
  vec4 s = cell(c);
  int m = int(s.r * 255. + .5);
  float aux = s.g, T = tempOf(s.b); int fl = int(s.a * 255. + .5);
  vec4 pal = texelFetch(uPal, ivec2(m, 0), 0), prop = texelFetch(uProp, ivec2(m, 0), 0);
  int phase = int(prop.r * 255. + .5); float variance = prop.g, emis = prop.b;
  vec3 col = pal.rgb; float a = m == 0 ? 0. : 1.;
  vec3 glow = vec3(0.);
  float up = cell(c + vec2(0., -1.)).r * 255., dn = cell(c + vec2(0., 1.)).r * 255.;
  if (phase == 1 || phase == 2 || phase == 5) {
    col *= 1. + (aux - .5) * variance * 2.;
    if (up < .5) col *= 1.14;           // lit top edge
    if (dn < .5 && phase != 2) col *= .8;
    if (m == 15) col *= .86 + .14 * sin(c.y * 1.7 + sin(c.x * .3) * 2.);   // wood grain
  } else if (phase == 3) {              // liquids shimmer and catch light at the surface
    float w = sin(uTime * 2.2 + aux * 30. + c.x * .35) * .5 + .5;
    col *= .88 + .18 * w + (aux - .5) * variance;
    if (up < .5) col = mix(col, vec3(1.), .22);
    a = .92;
  }
  // gases are drawn as a soft density field so smoke and steam read as clouds, not static
  if (phase == 4 || m == 0) {
    vec3 gc = vec3(0.); float ga = 0., tot = 0.;
    for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
      vec4 q = cell(c + vec2(i, j)); int qm = int(q.r * 255. + .5);
      vec4 qp = texelFetch(uProp, ivec2(qm, 0), 0);
      float wgt = 1. / (1. + float(i * i + j * j));
      tot += wgt;
      if (int(qp.r * 255. + .5) == 4) {
        float qa = qm == 20 ? .95 : qm == 21 ? .5 + .3 * q.g : qm == 10 ? .38 : .45;
        gc += texelFetch(uPal, ivec2(qm, 0), 0).rgb * qa * wgt; ga += qa * wgt;
      }
    }
    if (ga > 0.) {
      float dens = ga / tot;
      col = gc / ga * (.92 + .1 * hash(floor(c / 3.) + floor(uTime * 3.)));
      a = clamp(dens * 1.6, 0., m == 20 ? 1. : .85);
    }
  }
  // materials with their own light (lava, fire, acid)
  if (emis > 0.) {
    float fl2 = .75 + .25 * sin(uTime * 13. + aux * 40.);
    glow += pal.rgb * emis * (m == 20 ? fl2 * 1.4 : 1.);
    if (m == 20) col = mix(vec3(1., .9, .5), vec3(1., .3, .05), clamp(1. - T / 1100., 0., 1.));
  }
  // incandescence from temperature
  vec3 bb = blackbody(T);
  if (m != 0) { glow += bb; col = mix(col, col + bb, .6); }
  if ((fl & 1) != 0) { // burning
    float f = .6 + .4 * sin(uTime * 18. + aux * 50. + c.y);
    glow += vec3(1., .45, .1) * f * 1.2; col = mix(col, vec3(1., .5, .15), .5 * f);
  }
  if ((fl & 128) != 0) { glow += vec3(.4, .9, 1.6); col = mix(col, vec3(.7, .95, 1.), .7); } // live current
  if (m == 4 && (fl & 2) != 0) col *= .62;                     // wet soil
  if (m == 4 && (fl & 16) != 0) col = mix(col, vec3(.22, .16, .1), .35);
  if (m == 16) {
    if ((fl & 64) != 0) col = mix(col, vec3(.45, .85, .35), .35);        // leaf
    if ((fl & 4) != 0) col = mix(col, vec3(.7, 1., .5), .4);              // growing tip
    if ((fl & 32) != 0) { float h = aux * 6.283; col = .6 + .4 * cos(h + vec3(0., 2.1, 4.2)); glow += col * .08; } // flower
  }
  if (m != 0 && T < -5.) col = mix(col, vec3(.8, .9, 1.), clamp(-T / 60., 0., .35));
  float haze = clamp((T - 120.) / 700., 0., 1.) * (m == 0 || phase == 4 ? 1. : .3);
  if (uView == 1) { // heat map
    float k = clamp((T + 30.) / 1200., 0., 1.);
    col = mix(vec3(.1, .2, .9), vec3(.1, .9, .4), smoothstep(0., .08, k)); col = mix(col, vec3(1., .9, .1), smoothstep(.06, .3, k)); col = mix(col, vec3(1., .15, .05), smoothstep(.3, 1., k));
    a = 1.; glow = vec3(0.); haze = 0.;
    if (m != 0) col *= .75 + .25 * float(phase != 4);
  } else if (uView == 2) {
    vec2 v = texture(uAir, vUv).rg * 2. - 1.;
    float sp = length(v);
    col = mix(col * .35, .5 + .5 * vec3(v.x, v.y, -v.x), clamp(sp * 1.5, 0., 1.)); a = 1.; glow = vec3(0.); haze = 0.;
  } else if (uView == 3) {
    col *= .25; a = max(a, .0) ; if ((fl & 128) != 0) { col = vec3(.6, 1., 1.); a = 1.; }
  }
  oColor = vec4(col, a);
  oGlow = vec4(glow, haze);
}`;

const DOWN_FS = HEAD + `uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ o = (texture(uTex, vUv + uTexel * vec2(-.5,-.5)) + texture(uTex, vUv + uTexel * vec2(.5,-.5)) + texture(uTex, vUv + uTexel * vec2(-.5,.5)) + texture(uTex, vUv + uTexel * vec2(.5,.5))) * .25; }`;
const BLUR_FS = HEAD + `uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main(){ o = texture(uTex, vUv) * .227 + (texture(uTex, vUv + uDir * 1.385) + texture(uTex, vUv - uDir * 1.385)) * .316 + (texture(uTex, vUv + uDir * 3.231) + texture(uTex, vUv - uDir * 3.231)) * .07; }`;

const COMP_FS = HEAD + `
uniform sampler2D uColor, uGlow, uBloom, uLight; uniform vec2 uWorld, uScreen; uniform vec3 uCam; uniform float uTime;
uniform vec4 uShock[8]; uniform int uShocks; uniform vec3 uBrush; uniform float uBrushOn; uniform float uAmbient;
uniform vec4 uPlanet; uniform vec2 uPlanet2; // (on, cx, cy, rOut) and (rIn, rotation) in device pixels
out vec4 o;
void main(){
  vec2 px = vUv * uScreen; px.y = uScreen.y - px.y;
  vec2 w = (px - uScreen * .5) / uCam.z + uCam.xy;           // world cell coords
  float pr = 0.;
  if (uPlanet.x > .5) {
    // globe view: the world is wrapped around a planet, sky outward, bedrock toward the core
    vec2 d = px - uPlanet.yz; pr = length(d);
    float ang = atan(d.x, -d.y) / 6.2831853;
    w = vec2(fract(ang + uPlanet2.y) * uWorld.x, (uPlanet.w - pr) / (uPlanet.w - uPlanet2.x) * uWorld.y);
  }
  // shockwaves bend space
  for (int k = 0; k < 8; k++) { if (k >= uShocks) break; vec4 s = uShock[k]; vec2 d = w - s.xy; float r = length(d); float ring = exp(-pow((r - s.z) / 3., 2.)) * s.w; w -= normalize(d + 1e-4) * ring * 3.; }
  vec2 uv = w / uWorld;
  // heat shimmer above hot things
  float haze = texture(uBloom, uv).a;
  uv += vec2(sin(uv.y * 180. + uTime * 9.) , cos(uv.x * 150. + uTime * 7.)) * haze * .0022;
  vec3 sky = mix(vec3(.04, .05, .1), vec3(.12, .1, .15), clamp(uv.y, 0., 1.));
  vec2 sc = floor(w * .5); float st = hash(sc);
  if (st > .992) sky += vec3(.5, .55, .7) * (1. - uv.y) * (.5 + .5 * sin(uTime * (1. + st * 3.) + st * 50.)) * smoothstep(.7, .0, length(fract(w * .5) - .5) * 2.);
  vec4 c = texture(uColor, uv);
  bool inside = uv.x >= 0. && uv.y >= 0. && uv.x <= 1. && uv.y <= 1.;
  vec3 light = texture(uLight, uv).rgb, bloom = texture(uBloom, uv).rgb;
  vec3 lit = c.rgb * (uAmbient + light * 1.6);
  vec3 col = mix(sky + light * .35, lit, c.a) + bloom * .9 + texture(uGlow, uv).rgb * .25;
  if (!inside) col = vec3(.03, .03, .05);
  if (uPlanet.x > .5) {
    float k = clamp(uv.y, 0., 1.);
    vec3 space = vec3(.015, .018, .035);
    vec2 sp = floor(px / 3.); float s2 = hash(sp);
    if (s2 > .995) space += vec3(.7, .75, .9) * (.5 + .5 * sin(uTime * 2. + s2 * 90.));
    float rimR = uPlanet.w - .3 * (uPlanet.w - uPlanet2.x), rim = exp(-pow((pr - rimR) / (uPlanet.w * .03), 2.));
    if (pr > uPlanet.w) col = space + vec3(.25, .45, 1.) * rim * .8;
    else if (uv.y < 1.) { float air = clamp(pow(k / .34, 3.), 0., 1.) * (1. - c.a); col = mix(space + light * .35 + bloom * .9, col, max(c.a, air * .8)) + vec3(.25, .45, 1.) * rim * .35 * (1. - c.a) + vec3(.03, .07, .18) * air; }
    if (pr < uPlanet2.x) { float q = pr / uPlanet2.x; col = mix(vec3(1., .85, .4), vec3(.9, .25, .05), q) * (1.2 - q * .5) + vec3(.4, .1, 0.) * sin(uTime + q * 12.) * .1; }
  }
  // brush ring
  if (uBrushOn > 0.) { float d = abs(length(w - uBrush.xy) - uBrush.z); col = mix(col, vec3(1.), (1. - smoothstep(0., 1.2 / uCam.z * 1.5, d)) * .55 * uBrushOn); }
  col = 1. - exp(-col * 1.25);
  o = vec4(pow(col, vec3(.95)), 1.);
}`;

const PT_VS = `#version 300 es
in vec2 aPos; in vec4 aCol; uniform vec2 uWorld, uScreen; uniform vec3 uCam; uniform float uSize; uniform vec4 uPlanet; uniform vec2 uPlanet2; out vec4 vCol;
void main(){ vec2 p = (aPos - uCam.xy) * uCam.z + uScreen * .5;
  float sz = uSize * uCam.z;
  if (uPlanet.x > .5) {
    float a = (aPos.x / uWorld.x - uPlanet2.y) * 6.2831853, r = uPlanet.w - aPos.y / uWorld.y * (uPlanet.w - uPlanet2.x);
    p = uPlanet.yz + r * vec2(sin(a), -cos(a)); sz = uSize * (uPlanet.w - uPlanet2.x) / uWorld.y;
  } vec2 ndc = p / uScreen * 2. - 1.; ndc.y = -ndc.y; gl_Position = vec4(ndc, 0., 1.); gl_PointSize = max(1., sz); vCol = aCol; }`;
const PT_FS = `#version 300 es
precision highp float; in vec4 vCol; out vec4 o; uniform float uRound;
void main(){ float d = length(gl_PointCoord - .5); if (uRound > .5 && d > .5) discard; o = vec4(vCol.rgb * (uRound > .5 ? (1. - d * 1.6) : 1.), vCol.a); }`;

interface Target { fb: WebGLFramebuffer; tex: WebGLTexture[]; w: number; h: number }

export class Renderer {
  gl: WebGL2RenderingContext; canvas: HTMLCanvasElement;
  world!: World; view: ViewMode = 'normal';
  private prog: Record<string, { p: WebGLProgram; u: Record<string, WebGLUniformLocation> }> = {};
  private quad: WebGLVertexArrayObject; private state!: WebGLTexture; private airTex!: WebGLTexture; private pal: WebGLTexture; private prop: WebGLTexture;
  private scene!: Target; private half!: Target; private halfB!: Target; private quarter!: Target; private quarterB!: Target;
  private stateBuf!: Uint8Array; private airBuf!: Uint8Array;
  private ptVao: WebGLVertexArrayObject; private ptBuf: WebGLBuffer; private ptData = new Float32Array(8000 * 6);
  embers: { x: number; y: number; vx: number; vy: number; life: number; r: number; g: number; b: number }[] = [];
  brush = { x: 0, y: 0, r: 0, on: 0 };
  /** Globe view geometry in CSS pixels; rot is in turns. */
  planet = { on: false, cx: 0, cy: 0, rOut: 1, rIn: 0, rot: 0 };
  ambient = .82;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    const q = gl.createVertexArray()!; gl.bindVertexArray(q);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.quad = q;
    this.prog.world = this.link(VS, WORLD_FS); this.prog.down = this.link(VS, DOWN_FS); this.prog.blur = this.link(VS, BLUR_FS); this.prog.comp = this.link(VS, COMP_FS);
    this.prog.pts = this.link(PT_VS, PT_FS, { aPos: 0, aCol: 1 });
    this.ptVao = gl.createVertexArray()!; gl.bindVertexArray(this.ptVao);
    this.ptBuf = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.ptBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.ptData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
    gl.bindVertexArray(null);
    // palette and material properties as 1-row lookup textures
    const pal = new Uint8Array(64 * 4), prop = new Uint8Array(64 * 4);
    for (let i = 0; i < MAT_COUNT; i++) {
      const d = MATS[i]; pal.set([d.color[0], d.color[1], d.color[2], 255], i * 4);
      prop.set([d.phase, Math.round(d.variance * 255), Math.round((d.emissive ?? 0) * 255), 255], i * 4);
    }
    this.pal = this.tex(64, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST, pal);
    this.prop = this.tex(64, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST, prop);
  }

  private link(vs: string, fs: string, attribs: Record<string, number> = { aPos: 0 }) {
    const gl = this.gl;
    const sh = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) ?? 'shader'); return o; };
    const p = gl.createProgram()!; gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    for (const k in attribs) gl.bindAttribLocation(p, attribs[k], k);
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    const u: Record<string, WebGLUniformLocation> = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i)!; u[a.name.replace('[0]', '')] = gl.getUniformLocation(p, a.name)!; }
    return { p, u };
  }
  private tex(w: number, h: number, internal: number, fmt: number, type: number, filter: number, data: ArrayBufferView | null = null) {
    const gl = this.gl, t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, fmt, type, data);
    return t;
  }
  private target(w: number, h: number, count: number, filter: number): Target {
    const gl = this.gl, fb = gl.createFramebuffer()!, tex: WebGLTexture[] = [];
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    for (let k = 0; k < count; k++) { const t = this.tex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, filter); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, t, 0); tex.push(t); }
    gl.drawBuffers(tex.map((_, k) => gl.COLOR_ATTACHMENT0 + k));
    return { fb, tex, w, h };
  }

  setWorld(world: World) {
    const gl = this.gl; this.world = world;
    const w = world.w, h = world.h;
    this.stateBuf = new Uint8Array(w * h * 4);
    this.state = this.tex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
    this.airBuf = new Uint8Array(world.air.cw * world.air.ch * 4);
    this.airTex = this.tex(world.air.cw, world.air.ch, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    this.scene = this.target(w, h, 2, gl.NEAREST);
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1), qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    this.half = this.target(hw, hh, 1, gl.LINEAR); this.halfB = this.target(hw, hh, 1, gl.LINEAR);
    this.quarter = this.target(qw, qh, 1, gl.LINEAR); this.quarterB = this.target(qw, qh, 1, gl.LINEAR);
  }

  private upload() {
    const W = this.world, b = this.stateBuf, n = W.n, gl = this.gl;
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      b[o] = W.mat[i]; b[o + 1] = W.aux[i]; b[o + 2] = packTemp(W.temp[i]);
      b[o + 3] = (W.flags[i] & 127) | (W.charge[i] === 1 ? 128 : 0);
    }
    gl.bindTexture(gl.TEXTURE_2D, this.state);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W.w, W.h, gl.RGBA, gl.UNSIGNED_BYTE, b);
    if (this.view === 'air') {
      const a = W.air, ab = this.airBuf;
      for (let i = 0; i < a.vx.length; i++) { ab[i * 4] = Math.max(0, Math.min(255, 128 + a.vx[i] * 40)); ab[i * 4 + 1] = Math.max(0, Math.min(255, 128 + a.vy[i] * 40)); ab[i * 4 + 3] = 255; }
      gl.bindTexture(gl.TEXTURE_2D, this.airTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, a.cw, a.ch, gl.RGBA, gl.UNSIGNED_BYTE, ab);
    }
  }
  private bind(t: Target | null) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
    gl.viewport(0, 0, t ? t.w : this.canvas.width, t ? t.h : this.canvas.height);
  }
  private draw() { const gl = this.gl; gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
  private use(k: string) { this.gl.useProgram(this.prog[k].p); return this.prog[k].u; }
  private texUnit(u: WebGLUniformLocation, unit: number, t: WebGLTexture) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(u, unit); }
  private blurInto(src: Target, tmp: Target, passes: number) {
    const gl = this.gl, u = this.use('blur');
    for (let i = 0; i < passes; i++) {
      this.bind(tmp); this.texUnit(u.uTex, 0, src.tex[0]); gl.uniform2f(u.uDir, (1 + i) / src.w, 0); this.draw();
      this.bind(src); this.texUnit(u.uTex, 0, tmp.tex[0]); gl.uniform2f(u.uDir, 0, (1 + i) / src.h); this.draw();
    }
  }

  spawnEmbers(time: number) {
    const W = this.world, sp = W.sparks;
    for (let k = 0; k < sp.length && this.embers.length < 700; k += 2) {
      const i = sp[k + 1] * W.w + sp[k], hot = W.charge[i] === 1;
      this.embers.push({ x: sp[k] + .5, y: sp[k + 1] + .5, vx: (Math.random() - .5) * .6, vy: -Math.random() * .8 - .2, life: 1, r: hot ? .6 : 1, g: hot ? 1 : .55, b: hot ? 1.2 : .15 });
    }
    sp.length = 0;
    for (const e of this.embers) {
      e.x += e.vx; e.y += e.vy;
      e.vx += W.air.vxAt(Math.max(0, Math.min(W.w - 1, e.x | 0)), Math.max(0, Math.min(W.h - 1, e.y | 0))) * .05;
      e.vy += .01; e.life -= .025;
    }
    this.embers = this.embers.filter(e => e.life > 0);
  }

  private time = 0;
  render(cam: Camera, time: number) {
    this.time = time;
    const gl = this.gl, W = this.world;
    this.upload();
    this.spawnEmbers(time);
    gl.disable(gl.BLEND);
    // 1. world pass
    let u = this.use('world');
    this.bind(this.scene);
    this.texUnit(u.uState, 0, this.state); this.texUnit(u.uPal, 1, this.pal); this.texUnit(u.uProp, 2, this.prop); this.texUnit(u.uAir, 3, this.airTex);
    gl.uniform2f(u.uSize, W.w, W.h); gl.uniform1f(u.uTime, time);
    gl.uniform1i(u.uView, ({ normal: 0, heat: 1, air: 2, charge: 3 } as const)[this.view]);
    this.draw();
    // 2. glow: half res bloom, quarter res wide light
    u = this.use('down');
    this.bind(this.half); this.texUnit(u.uTex, 0, this.scene.tex[1]); gl.uniform2f(u.uTexel, 1 / W.w, 1 / W.h); this.draw();
    this.blurInto(this.half, this.halfB, 2);
    this.bind(this.quarter); this.texUnit(u.uTex, 0, this.half.tex[0]); gl.uniform2f(u.uTexel, 1 / this.half.w, 1 / this.half.h); this.draw();
    this.blurInto(this.quarter, this.quarterB, 4);
    // 3. composite
    u = this.use('comp');
    this.bind(null);
    this.texUnit(u.uColor, 0, this.scene.tex[0]); this.texUnit(u.uGlow, 1, this.scene.tex[1]); this.texUnit(u.uBloom, 2, this.half.tex[0]); this.texUnit(u.uLight, 3, this.quarter.tex[0]);
    gl.uniform2f(u.uWorld, W.w, W.h); gl.uniform2f(u.uScreen, this.canvas.width, this.canvas.height);
    const dpr = this.canvas.width / Math.max(1, this.canvas.clientWidth);
    gl.uniform3f(u.uCam, cam.x, cam.y, cam.zoom * dpr); gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uAmbient, this.view === 'normal' ? this.ambient : 1);
    const sh = new Float32Array(32); let ns = 0;
    for (const s of W.shocks) { if (ns >= 8) break; const k = s.t / 40; sh.set([s.x, s.y, s.r * (1 + s.t * .9), (1 - k) * Math.min(1, s.r / 6)], ns * 4); ns++; }
    gl.uniform4fv(u.uShock, sh); gl.uniform1i(u.uShocks, ns);
    this.planetUniforms(u, dpr);
    gl.uniform3f(u.uBrush, this.brush.x, this.brush.y, this.brush.r); gl.uniform1f(u.uBrushOn, this.brush.on);
    this.draw();
    // 4. debris, embers and lightning as points on top
    this.points(cam, dpr);
  }

  private planetUniforms(u: Record<string, WebGLUniformLocation>, dpr: number) {
    const P = this.planet;
    this.gl.uniform4f(u.uPlanet, P.on ? 1 : 0, P.cx * dpr, P.cy * dpr, P.rOut * dpr);
    this.gl.uniform2f(u.uPlanet2, P.rIn * dpr, P.rot);
  }
  private points(cam: Camera, dpr: number) {
    const gl = this.gl, W = this.world, d = this.ptData;
    const u = this.use('pts');
    gl.uniform2f(u.uWorld, W.w, W.h); gl.uniform2f(u.uScreen, this.canvas.width, this.canvas.height); gl.uniform3f(u.uCam, cam.x, cam.y, cam.zoom * dpr);
    this.planetUniforms(u, dpr);
    gl.bindVertexArray(this.ptVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.ptBuf);
    // debris keep their material colour
    let n = 0;
    const deb = W.debris;
    for (let k = 0; k < deb.n && n < 7000; k++, n++) {
      const c = MATS[deb.mat[k]].color, hot = Math.min(1, Math.max(0, (deb.temp[k] - 500) / 1000));
      d.set([deb.x[k], deb.y[k], (c[0] / 255) * (1 - hot) + hot, (c[1] / 255) * (1 - hot) + hot * .5, (c[2] / 255) * (1 - hot), 1], n * 6);
    }
    if (n) { gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 6); gl.uniform1f(u.uSize, 1.05); gl.uniform1f(u.uRound, 0); gl.drawArrays(gl.POINTS, 0, n); }
    // embers and lightning glow additively
    n = 0;
    // storm funnels: dust spiralling around each vortex, narrow at the ground and wide aloft
    for (const st of W.storms) {
      const k = Math.min(1, st.life / 120), sx = Math.max(0, Math.min(W.w - 1, st.x | 0));
      let gy = Math.max(0, st.y | 0); while (gy < W.h - 1 && (W.mat[gy * W.w + sx] === 0 || MATS[W.mat[gy * W.w + sx]].phase === 4)) gy++;
      const top = st.y - st.r * 1.2, big = st.r >= 14;
      for (let q = 0; q < 420 && n < 6000; q++) {
        const t = q / 420, y = gy + (top - gy) * t, rad = st.r * (big ? .5 + t * 1.6 : .12 + t * t * 1.1);
        const a = this.time * st.spin * (big ? 2.5 : 7) / (.3 + t) + q * 2.399;
        const x = st.x + Math.cos(a) * rad, depth = .5 + .5 * Math.sin(a);
        const g = (.1 + .12 * depth) * k;
        d.set([x, y, g, g, g * 1.2, 1], n * 6); n++;
      }
    }
    for (const e of this.embers) { if (n >= 7000) break; d.set([e.x, e.y, e.r * e.life, e.g * e.life, e.b * e.life, 1], n * 6); n++; }
    for (const b of W.bolts) {
      const f = Math.max(0, 1 - b.t / 14) * (b.t < 3 ? 1.6 : 1);
      for (let k = 0; k + 3 < b.pts.length && n < 7990; k += 2) {
        const x0 = b.pts[k], y0 = b.pts[k + 1], x1 = b.pts[k + 2], y1 = b.pts[k + 3], len = Math.hypot(x1 - x0, y1 - y0);
        for (let s = 0; s <= len && n < 7990; s += .5) { const t = s / len; d.set([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, .7 * f, .8 * f, 1.3 * f, 1], n * 6); n++; }
      }
    }
    if (n) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 6); gl.uniform1f(u.uSize, 2.2); gl.uniform1f(u.uRound, 1); gl.drawArrays(gl.POINTS, 0, n);
      gl.disable(gl.BLEND);
    }
  }
}

