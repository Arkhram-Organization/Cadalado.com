// Sonidos de La Canchita, sintetizados: patadas, piques, palo, silbato y la tribuna.
let ctx = null, master = null, murmullo = null;
const apagado = () => { try { return localStorage.getItem('cadalado.audio') === 'silencio'; } catch { return false; } };
function audio() {
  if (apagado()) return null;
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
let buf = null;
const ruidoBuf = (a) => {
  if (buf) return buf;
  buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
};
function ruido(a, { dur = .2, vol = .4, f = 1200, q = 1, tipo = 'bandpass', f2 = null, at = 0, ataque = .005 } = {}) {
  const t = a.currentTime + at;
  const s = a.createBufferSource(); s.buffer = ruidoBuf(a);
  const fl = a.createBiquadFilter(); fl.type = tipo; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(fl).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
}
function tono(a, { f = 200, f2 = null, dur = .2, vol = .3, forma = 'sine', at = 0 } = {}) {
  const t = a.currentTime + at;
  const o = a.createOscillator(); o.type = forma; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
const silbido = (a, at, dur) => { const t = a.currentTime + at; const o = a.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(2900, t); const lfo = a.createOscillator(); lfo.frequency.value = 38; const lg = a.createGain(); lg.gain.value = 120; lfo.connect(lg).connect(o.frequency); const g = a.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .02); g.gain.setValueAtTime(.18, t + dur - .05); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + dur + .05); lfo.stop(t + dur + .05); };
const SONIDOS = {
  remate: (a, k = .6) => { ruido(a, { dur: .12, vol: .5 + k * .5, f: 500, q: .8 }); tono(a, { f: 140, f2: 60, dur: .14, vol: .4 + k * .3, forma: 'triangle' }); },
  pase: (a) => { ruido(a, { dur: .08, vol: .35, f: 700, q: .9 }); tono(a, { f: 180, f2: 90, dur: .09, vol: .2, forma: 'triangle' }); },
  globo: (a) => { ruido(a, { dur: .1, vol: .4, f: 600 }); tono(a, { f: 160, f2: 70, dur: .12, vol: .25, forma: 'triangle' }); },
  pique: (a, k = 3) => tono(a, { f: 120, f2: 70, dur: .08, vol: Math.min(.35, k * .05), forma: 'triangle' }),
  pared: (a, k = 5) => { ruido(a, { dur: .14, vol: Math.min(.6, k * .05), f: 300, q: .7 }); tono(a, { f: 90, dur: .12, vol: Math.min(.3, k * .03) }); },
  palo: (a) => { for (const [f, v] of [[1180, .25], [1620, .15], [2350, .1]]) tono(a, { f, dur: 1.2, vol: v, forma: 'sine' }); ruido(a, { dur: .1, vol: .5, f: 2000 }); },
  atajada: (a) => { ruido(a, { dur: .15, vol: .6, f: 900, q: .6 }); ruido(a, { dur: 1.2, vol: .25, f: 600, q: .4, at: .05, ataque: .2 }); },
  quite: (a) => { ruido(a, { dur: .12, vol: .4, f: 400, q: .6 }); },
  cae: (a) => { tono(a, { f: 80, f2: 40, dur: .3, vol: .5 }); ruido(a, { dur: .25, vol: .4, f: 250, tipo: 'lowpass' }); },
  silbato: (a) => silbido(a, 0, .45),
  final: (a) => { silbido(a, 0, .35); silbido(a, .5, .35); silbido(a, 1, .9); ruido(a, { dur: 2.5, vol: .5, f: 700, q: .3, at: 1, ataque: .3 }); },
  gol: (a) => { ruido(a, { dur: 3.5, vol: .9, f: 650, q: .3, ataque: .25 }); ruido(a, { dur: 3, vol: .5, f: 1400, q: .5, ataque: .4 }); for (let i = 0; i < 3; i++) tono(a, { f: 466, dur: .35, vol: .12, forma: 'sawtooth', at: .3 + i * .45 }); },
  trueno: (a) => ruido(a, { dur: 2.5, vol: .7, f: 120, tipo: 'lowpass', at: .3, ataque: .1 }),
  cursor: (a) => tono(a, { f: 600, dur: .05, vol: .08, forma: 'square' }),
  elegir: (a) => { tono(a, { f: 400, f2: 900, dur: .2, vol: .15, forma: 'triangle' }); },
};
export function sfx(nombre, k) {
  const a = audio();
  if (!a || !SONIDOS[nombre]) return;
  try { SONIDOS[nombre](a, k); } catch {}
}
// murmullo de la tribuna, de fondo, todo el partido
export function tribuna(prender) {
  const a = audio();
  if (!a) return;
  if (prender && !murmullo) {
    const s = a.createBufferSource(); s.buffer = ruidoBuf(a); s.loop = true;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = .5;
    const g = a.createGain(); g.gain.value = .07;
    s.connect(f).connect(g).connect(master); s.start();
    murmullo = { s, g };
  } else if (!prender && murmullo) { try { murmullo.s.stop(); } catch {} murmullo = null; }
}
let voz = null;
const elegirVoz = () => { const vs = speechSynthesis.getVoices(); voz = vs.find((v) => /es[-_](AR|MX|US|419)/i.test(v.lang)) || vs.find((v) => /^es/i.test(v.lang)) || null; };
if (typeof speechSynthesis !== 'undefined') { elegirVoz(); speechSynthesis.addEventListener?.('voiceschanged', elegirVoz); }
export function relator(texto) {
  if (apagado() || typeof speechSynthesis === 'undefined') return;
  try { if (localStorage.getItem('futbol.relator') === 'no') return; } catch {}
  const u = new SpeechSynthesisUtterance(String(texto).replace(/[¡!]/g, ''));
  if (voz) u.voice = voz; u.lang = voz?.lang || 'es-AR'; u.rate = 1.15; u.pitch = 1.1;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
