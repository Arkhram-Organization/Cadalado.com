// Sonidos de Piña Final, sintetizados (sin archivos), y el locutor con la voz del navegador.
let ctx = null, master = null;
const apagado = () => { try { return localStorage.getItem('cadalado.audio') === 'silencio'; } catch { return false; } };
function audio() {
  if (apagado()) return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
let bufRuido = null;
function ruidoBuf(a) {
  if (bufRuido) return bufRuido;
  bufRuido = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const d = bufRuido.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return bufRuido;
}
function ruido(a, { dur = .2, vol = .4, f = 1200, q = 1, tipo = 'bandpass', f2 = null, at = 0 } = {}) {
  const t = a.currentTime + at;
  const s = a.createBufferSource(); s.buffer = ruidoBuf(a);
  const fl = a.createBiquadFilter(); fl.type = tipo; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(fl).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
}
function tono(a, { f = 200, f2 = null, dur = .2, vol = .3, forma = 'sine', at = 0 } = {}) {
  const t = a.currentTime + at;
  const o = a.createOscillator(); o.type = forma; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}

const SONIDOS = {
  zumbido: (a) => ruido(a, { dur: .12, vol: .25, f: 900, f2: 2400, q: 2 }),
  zumbidoPatada: (a) => ruido(a, { dur: .17, vol: .3, f: 600, f2: 1800, q: 1.5 }),
  zumbidoArma: (a) => { ruido(a, { dur: .22, vol: .35, f: 2500, f2: 6000, q: 4 }); tono(a, { f: 1800, f2: 3200, dur: .2, vol: .04, forma: 'sine' }); },
  golpe: (a) => { ruido(a, { dur: .09, vol: .8, f: 700, q: .8 }); tono(a, { f: 160, f2: 60, dur: .12, vol: .5, forma: 'triangle' }); },
  golpeFuerte: (a) => { ruido(a, { dur: .2, vol: 1, f: 450, q: .7 }); tono(a, { f: 120, f2: 40, dur: .25, vol: .7, forma: 'triangle' }); },
  corte: (a) => { ruido(a, { dur: .16, vol: .7, f: 3500, q: 2, tipo: 'highpass' }); tono(a, { f: 140, f2: 50, dur: .15, vol: .45, forma: 'triangle' }); },
  bloqueo: (a) => { tono(a, { f: 900, f2: 600, dur: .1, vol: .2, forma: 'square' }); ruido(a, { dur: .05, vol: .3, f: 3000 }); },
  salto: (a) => ruido(a, { dur: .12, vol: .12, f: 500, f2: 1200 }),
  cae: (a) => { tono(a, { f: 90, f2: 35, dur: .35, vol: .7, forma: 'sine' }); ruido(a, { dur: .3, vol: .5, f: 250, tipo: 'lowpass' }); },
  ko: (a) => { tono(a, { f: 70, f2: 30, dur: 1.2, vol: .8 }); ruido(a, { dur: .8, vol: .6, f: 300, tipo: 'lowpass' }); },
  choque: (a) => { ruido(a, { dur: .5, vol: .8, f: 800, f2: 200 }); tono(a, { f: 300, f2: 60, dur: .5, vol: .4, forma: 'sawtooth' }); },
  super: (a) => { for (let i = 0; i < 6; i++) tono(a, { f: 200 + i * 90, dur: .14, vol: .12, forma: 'sawtooth', at: i * .05 }); ruido(a, { dur: .6, vol: .4, f: 400, f2: 3000 }); },
  aplasta: (a) => { tono(a, { f: 60, f2: 25, dur: 1, vol: 1 }); ruido(a, { dur: .9, vol: .9, f: 200, tipo: 'lowpass' }); },
  rompeHielo: (a) => { for (let i = 0; i < 8; i++) tono(a, { f: 2000 + Math.random() * 3000, dur: .08, vol: .1, forma: 'triangle', at: i * .03 }); ruido(a, { dur: .5, vol: .6, f: 4000, tipo: 'highpass' }); },
  poder_fuego: (a) => { ruido(a, { dur: .5, vol: .6, f: 300, f2: 1400, q: .6 }); tono(a, { f: 110, f2: 220, dur: .4, vol: .2, forma: 'sawtooth' }); },
  poder_hielo: (a) => { tono(a, { f: 1800, f2: 2600, dur: .3, vol: .12, forma: 'triangle' }); ruido(a, { dur: .35, vol: .3, f: 5000, tipo: 'highpass' }); },
  poder_rayo: (a) => { ruido(a, { dur: .3, vol: .7, f: 3000, q: .5 }); tono(a, { f: 60, dur: .3, vol: .3, forma: 'square' }); },
  poder_veneno: (a) => { tono(a, { f: 300, f2: 120, dur: .35, vol: .25, forma: 'sine' }); ruido(a, { dur: .3, vol: .2, f: 600, q: 6 }); },
  poder_sombra: (a) => { for (let i = 0; i < 3; i++) ruido(a, { dur: .1, vol: .35, f: 4000, q: 3, at: i * .05 }); },
  poder_tierra: (a) => { tono(a, { f: 80, f2: 50, dur: .5, vol: .6 }); ruido(a, { dur: .4, vol: .5, f: 200, tipo: 'lowpass' }); },
  poder_viento: (a) => ruido(a, { dur: .7, vol: .5, f: 400, f2: 1600, q: .8 }),
  impacto_fuego: (a) => ruido(a, { dur: .4, vol: .6, f: 600, f2: 200 }),
  impacto_hielo: (a) => { for (let i = 0; i < 4; i++) tono(a, { f: 2500 + i * 400, dur: .07, vol: .08, forma: 'triangle', at: i * .02 }); },
  impacto_rayo: (a) => { ruido(a, { dur: .25, vol: .8, f: 2500, q: .4 }); tono(a, { f: 50, dur: .25, vol: .4, forma: 'square' }); },
  remate_fuego: (a) => { ruido(a, { dur: 2, vol: .7, f: 400, f2: 900, q: .5 }); tono(a, { f: 60, dur: 1.5, vol: .5, forma: 'sawtooth' }); },
  remate_hielo: (a) => { tono(a, { f: 1500, f2: 400, dur: 1.4, vol: .15, forma: 'triangle' }); ruido(a, { dur: 1.4, vol: .3, f: 6000, tipo: 'highpass' }); },
  remate_rayo: (a) => { tono(a, { f: 45, dur: 2, vol: .5, forma: 'square' }); },
  remate_veneno: (a) => { for (let i = 0; i < 10; i++) tono(a, { f: 200 + Math.random() * 300, f2: 80, dur: .2, vol: .12, at: i * .18 }); },
  remate_sombra: (a) => { tono(a, { f: 100, f2: 50, dur: 1.5, vol: .3, forma: 'sawtooth' }); },
  remate_tierra: (a) => ruido(a, { dur: 1, vol: .4, f: 1500, f2: 300 }),
  remate_viento: (a) => ruido(a, { dur: 3, vol: .7, f: 300, f2: 1400, q: .7 }),
  gong: (a) => { for (const [f, v] of [[110, .5], [167, .3], [231, .2], [347, .12]]) tono(a, { f, dur: 3, vol: v }); },
  cursor: (a) => tono(a, { f: 600, dur: .05, vol: .08, forma: 'square' }),
  elegir: (a) => { tono(a, { f: 300, f2: 900, dur: .25, vol: .15, forma: 'sawtooth' }); ruido(a, { dur: .25, vol: .2, f: 1500 }); },
};

export function sfx(nombre) {
  if (!nombre) return;
  const a = audio();
  if (!a || !SONIDOS[nombre]) return;
  try { SONIDOS[nombre](a); } catch {}
}

// Locutor: voz grave del navegador (en castellano si hay)
let voz = null;
function elegirVoz() {
  const vs = speechSynthesis.getVoices();
  voz = vs.find((v) => /es[-_](AR|MX|US|419)/i.test(v.lang)) || vs.find((v) => /^es/i.test(v.lang)) || null;
}
if (typeof speechSynthesis !== 'undefined') { elegirVoz(); speechSynthesis.onvoiceschanged = elegirVoz; }
export function locutor(texto) {
  if (apagado() || typeof speechSynthesis === 'undefined') return;
  try { if (localStorage.getItem('pelea.locutor') === 'no') return; } catch {}
  const limpio = String(texto).replace(/[¡!]/g, '').replace(/K\.O\./, 'K O').toLowerCase();
  const u = new SpeechSynthesisUtterance(limpio);
  if (voz) u.voice = voz;
  u.lang = voz?.lang || 'es-AR'; u.pitch = .35; u.rate = .85; u.volume = 1;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
