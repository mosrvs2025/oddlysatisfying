/** Tiny synth: fire crackle, painting rustle, blasts, zaps and discovery chimes. All generated, no samples. */
export class Sound {
  ctx: AudioContext | null = null; on = true;
  private noise!: AudioBuffer; private crk!: GainNode; private rus!: GainNode; private rusF!: BiquadFilterNode; private out!: GainNode;
  constructor() { try { this.on = localStorage.getItem('terrarium.sound') !== '0'; } catch { /* default on */ } }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.out = c.createGain(); this.out.gain.value = this.on ? .7 : 0; this.out.connect(c.destination);
    const len = c.sampleRate * 2; this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // crackle: noise gated by sparse random clicks
    const crackBuf = c.createBuffer(1, len, c.sampleRate), cd = crackBuf.getChannelData(0);
    for (let i = 0; i < len; i++) cd[i] = Math.random() < .0015 ? (Math.random() * 2 - 1) : cd[i - 1] * .86 || 0;
    const cs = c.createBufferSource(); cs.buffer = crackBuf; cs.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    this.crk = c.createGain(); this.crk.gain.value = 0; cs.connect(hp).connect(this.crk).connect(this.out); cs.start();
    const rs = c.createBufferSource(); rs.buffer = this.noise; rs.loop = true;
    this.rusF = c.createBiquadFilter(); this.rusF.type = 'bandpass'; this.rusF.Q.value = .8; this.rusF.frequency.value = 2400;
    this.rus = c.createGain(); this.rus.gain.value = 0; rs.connect(this.rusF).connect(this.rus).connect(this.out); rs.start();
  }
  set(on: boolean) { this.on = on; try { localStorage.setItem('terrarium.sound', on ? '1' : '0'); } catch { /* ignore */ } if (this.ctx) this.out.gain.value = on ? .7 : 0; }
  stop() { if (this.ctx) { this.crk.gain.value = 0; this.rus.gain.value = 0; } }
  /** fire: 0..1 amount of flame on screen. phase: material phase being painted, or -1. */
  crackle(fire: number, phase: number) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.crk.gain.setTargetAtTime(fire * .9, t, .2);
    const g = phase < 0 ? 0 : phase === 3 ? .09 : phase === 2 ? .07 : .03;
    this.rus.gain.setTargetAtTime(g, t, .05);
    this.rusF.frequency.setTargetAtTime(phase === 3 ? 700 : phase === 4 ? 4000 : 2400, t, .05);
  }
  boom(k: number) {
    if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(90, t + .7);
    const g = c.createGain(); g.gain.setValueAtTime(.2 + .6 * k, t); g.gain.exponentialRampToValueAtTime(.001, t + 1.1);
    s.connect(f).connect(g).connect(this.out); s.start(t); s.stop(t + 1.2);
    const o = c.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + .5);
    const og = c.createGain(); og.gain.setValueAtTime(.5 * k + .2, t); og.gain.exponentialRampToValueAtTime(.001, t + .6);
    o.connect(og).connect(this.out); o.start(t); o.stop(t + .7);
  }
  zap() {
    if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = c.createGain(); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .35);
    s.connect(f).connect(g).connect(this.out); s.start(t); s.stop(t + .4);
    this.boom(.35);
  }
  chime(n: number) {
    if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    [0, 1, 2].forEach(k => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 523.25 * 2 ** (scale[(n + k * 2) % scale.length] / 12);
      const g = c.createGain(); g.gain.setValueAtTime(0, t + k * .09); g.gain.linearRampToValueAtTime(.12, t + k * .09 + .01); g.gain.exponentialRampToValueAtTime(.001, t + k * .09 + 1.2);
      o.connect(g).connect(this.out); o.start(t + k * .09); o.stop(t + k * .09 + 1.3);
    });
  }
}
