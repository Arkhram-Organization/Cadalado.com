// Sonidos de Empujón, sintetizados: empujones, agarradas, caídas al vacío, objetos y bocinas.
let ctx = null, master = null;
const apagado = () => { try { return localStorage.getItem('cadalado.audio') === 'silencio'; } catch { return false; } };
function audio() {
  if (apagado()) return null;
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
let buf = null;
const ruidoBuf = (a) => { if (buf) return buf; buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return buf; };
function ruido(a, { dur = .2, vol = .4, f = 1200, q = 1, tipo = 'bandpass', f2 = null, at = 0, ataque = .005 } = {}) {
  const t = a.currentTime + at;
  const s = a.createBufferSource(); s.buffer = ruidoBuf(a);
  const fl = a.createBiquadFilter(); fl.type = tipo; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(fl).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
}
function tono(a, { f = 200, f2 = null, dur = .2, vol = .3, forma = 'sine', at = 0 } = {}) {
  const t = a.currentTime + at;
  const o = a.createOscillator(); o.type = forma; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
const SONIDOS = {
  empujon: (a) => { ruido(a, { dur: .12, vol: .7, f: 500, q: .8 }); tono(a, { f: 150, f2: 70, dur: .14, vol: .4, forma: 'triangle' }); },
  fuerte: (a) => { ruido(a, { dur: .25, vol: 1, f: 380, q: .7 }); tono(a, { f: 120, f2: 45, dur: .3, vol: .6, forma: 'triangle' }); tono(a, { f: 900, f2: 1400, dur: .12, vol: .06, forma: 'square', at: .02 }); },
  aire: (a) => ruido(a, { dur: .14, vol: .25, f: 900, f2: 2200, q: 2 }),
  agarra: (a) => { tono(a, { f: 260, f2: 180, dur: .12, vol: .2, forma: 'square' }); ruido(a, { dur: .08, vol: .3, f: 1500 }); },
  revolea: (a) => { ruido(a, { dur: .35, vol: .5, f: 400, f2: 1600, q: 1 }); tono(a, { f: 200, f2: 500, dur: .3, vol: .15, forma: 'sawtooth' }); },
  salto: (a) => tono(a, { f: 380, f2: 760, dur: .14, vol: .12, forma: 'triangle' }),
  cae: (a) => { tono(a, { f: 1400, f2: 180, dur: 1.1, vol: .14, forma: 'sine' }); }, // fiiiuuu
  tirada: (a) => { tono(a, { f: 660, dur: .1, vol: .12, forma: 'square' }); tono(a, { f: 990, dur: .16, vol: .12, forma: 'square', at: .08 }); ruido(a, { dur: .6, vol: .25, f: 700, q: .4, at: .05, ataque: .1 }); },
  objeto: (a) => { for (let i = 0; i < 4; i++) tono(a, { f: 700 + i * 220, dur: .08, vol: .1, forma: 'triangle', at: i * .05 }); },
  resbala: (a) => { tono(a, { f: 900, f2: 300, dur: .35, vol: .15, forma: 'sawtooth' }); ruido(a, { dur: .3, vol: .2, f: 2500 }); },
  boom: (a) => { ruido(a, { dur: .9, vol: 1, f: 160, tipo: 'lowpass' }); tono(a, { f: 70, f2: 30, dur: .8, vol: .7 }); },
  arranca: (a) => { tono(a, { f: 440, dur: .25, vol: .14, forma: 'square' }); tono(a, { f: 660, dur: .4, vol: .14, forma: 'square', at: .25 }); },
  achica: (a) => { for (let i = 0; i < 3; i++) tono(a, { f: 880, dur: .15, vol: .1, forma: 'square', at: i * .3 }); },
  fin: (a) => { for (const [f, k] of [[523, 0], [659, .15], [784, .3], [1047, .45]]) tono(a, { f, dur: .5, vol: .12, forma: 'triangle', at: k }); ruido(a, { dur: 2, vol: .3, f: 700, q: .4, at: .4, ataque: .3 }); },
  cursor: (a) => tono(a, { f: 600, dur: .05, vol: .08, forma: 'square' }),
  elegir: (a) => tono(a, { f: 400, f2: 900, dur: .2, vol: .15, forma: 'triangle' }),
};
export function sfx(nombre) { const a = audio(); if (!a || !SONIDOS[nombre]) return; try { SONIDOS[nombre](a); } catch {} }
