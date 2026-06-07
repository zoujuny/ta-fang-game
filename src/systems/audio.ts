// 音效: 用 Web Audio API 合成, 无外部资源
// 用户偏好: 通过 window.__audio (单例) 调用, 也支持直接 import
// 每个事件一个 play* 方法, 内部合成对应音色

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private volume = 0.4;

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;
    try {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setMuted(m: boolean) { this.muted = m; }
  isMuted() { return this.muted; }
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }
  getVolume() { return this.volume; }

  private playTone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 1) {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  private playNoise(dur: number, vol = 0.3, filterFreq = 2000) {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    src.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    src.start(t0);
    src.stop(t0 + dur);
  }

  private playSweep(freqStart: number, freqEnd: number, dur: number, type: OscillatorType = 'sine', vol = 0.5) {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  // ====== 事件音效 ======

  // 塔开火: 不同元素不同音色
  fire(element: 'phys' | 'frost' | 'fire' | 'shock' | 'poison' | 'holy' | 'dark' | 'cannon') {
    switch (element) {
      case 'phys': this.playTone(800, 0.06, 'square', 0.25); break;       // 箭: 短促
      case 'cannon': this.playNoise(0.1, 0.4, 1200); break;               // 炮: 噪声
      case 'frost': this.playSweep(2000, 800, 0.12, 'triangle', 0.3); break;  // 冰: 下降
      case 'fire': this.playSweep(200, 600, 0.1, 'sawtooth', 0.3); break;   // 火: 上升
      case 'shock': this.playNoise(0.05, 0.35, 4000); break;               // 雷: 高频噪声
      case 'poison': this.playSweep(400, 200, 0.2, 'sawtooth', 0.25); break; // 毒: 低沉
      case 'holy': this.playTone(880, 0.1, 'sine', 0.3); break;            // 神圣: 高音
      case 'dark': this.playSweep(150, 80, 0.15, 'square', 0.25); break;    // 暗: 低沉下沉
      default: this.playTone(600, 0.08, 'square', 0.2);
    }
  }

  hit() {
    this.playNoise(0.05, 0.2, 3000);
  }

  monsterDeath() {
    this.playSweep(400, 100, 0.2, 'sawtooth', 0.3);
    this.playNoise(0.1, 0.15, 1500);
  }

  monsterReachedEnd() {
    this.playSweep(300, 50, 0.3, 'square', 0.35);
  }

  reaction(name: 'melt' | 'overload' | 'supercharge' | 'shatter') {
    switch (name) {
      case 'melt': this.playSweep(800, 200, 0.25, 'sine', 0.35); this.playNoise(0.15, 0.2, 2500); break;
      case 'overload': this.playSweep(100, 600, 0.18, 'sawtooth', 0.4); this.playNoise(0.1, 0.3, 2000); break;
      case 'supercharge': this.playTone(1200, 0.2, 'triangle', 0.4); this.playSweep(2000, 400, 0.2, 'sine', 0.3); break;
      case 'shatter': this.playSweep(2000, 100, 0.15, 'square', 0.35); this.playNoise(0.1, 0.25, 4000); break;
    }
  }

  build() {
    this.playTone(440, 0.08, 'triangle', 0.3);
    this.playTone(660, 0.08, 'triangle', 0.25);
  }

  upgrade() {
    this.playSweep(440, 880, 0.15, 'sine', 0.4);
    this.playTone(1100, 0.1, 'sine', 0.35);
  }

  sell() {
    this.playTone(660, 0.12, 'square', 0.3);
    this.playSweep(660, 330, 0.15, 'square', 0.2);
  }

  waveStart() {
    this.playTone(220, 0.15, 'sine', 0.3);
    this.playTone(330, 0.15, 'sine', 0.3);
    this.playTone(440, 0.15, 'sine', 0.3);
  }

  bossSpawn() {
    this.playSweep(100, 50, 0.4, 'sawtooth', 0.5);
    this.playSweep(150, 80, 0.4, 'square', 0.4);
  }

  victory() {
    this.playTone(523, 0.2, 'sine', 0.4);
    setTimeout(() => this.playTone(659, 0.2, 'sine', 0.4), 200);
    setTimeout(() => this.playTone(784, 0.4, 'sine', 0.45), 400);
  }

  defeat() {
    this.playSweep(400, 80, 0.5, 'sawtooth', 0.4);
    this.playTone(80, 0.4, 'square', 0.3);
  }
}

let _instance: AudioManager | null = null;

export function getAudio(): AudioManager {
  if (!_instance) _instance = new AudioManager();
  return _instance;
}
