// Sonidos sintetizados con WebAudio (sin archivos externos).
let ctx = null;
let enabled = true;

export function setSoundEnabled(v) {
  enabled = v;
}

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Golpe de madera: ruido filtrado + tono grave corto.
function knock({ freq = 180, gain = 0.5, decay = 0.07, noise = 0.6, delay = 0 } = {}) {
  const a = ac();
  const t = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * decay * 2);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq * 6;
  bp.Q.value = 1.2;
  const ng = a.createGain();
  ng.gain.value = noise * gain;
  src.connect(bp).connect(ng).connect(a.destination);
  src.start(t);

  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 2, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + decay);
  const og = a.createGain();
  og.gain.setValueAtTime(gain, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + decay * 1.6);
  osc.connect(og).connect(a.destination);
  osc.start(t);
  osc.stop(t + decay * 2);
}

function tone(freq, start, dur, gain = 0.15, type = 'sine') {
  const a = ac();
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function playSound(kind) {
  if (!enabled) return;
  try {
    switch (kind) {
      case 'move':
        return knock({ freq: 170, gain: 0.45 });
      case 'capture':
        knock({ freq: 140, gain: 0.6, noise: 1 });
        return knock({ freq: 220, gain: 0.35, delay: 0.035 });
      case 'castle':
        knock({ freq: 170, gain: 0.4 });
        return knock({ freq: 190, gain: 0.4, delay: 0.09 });
      case 'check':
        knock({ freq: 170, gain: 0.45 });
        return tone(880, 0.02, 0.18, 0.08, 'triangle');
      case 'promote':
        knock({ freq: 170, gain: 0.45 });
        return tone(660, 0.03, 0.2, 0.08, 'triangle');
      case 'start':
        tone(523, 0, 0.18);
        return tone(784, 0.12, 0.3);
      case 'end':
        tone(784, 0, 0.2);
        tone(659, 0.15, 0.2);
        return tone(523, 0.3, 0.4);
      case 'notify':
        return tone(988, 0, 0.15, 0.08);
      case 'lowtime':
        return tone(1200, 0, 0.08, 0.06, 'square');
    }
  } catch {
    /* audio no disponible */
  }
}

export function soundForMove(move) {
  if (!move) return 'move';
  if (move.san.includes('+') || move.san.includes('#')) return 'check';
  if (move.promotion) return 'promote';
  if (move.flags.includes('k') || move.flags.includes('q')) return 'castle';
  if (move.captured) return 'capture';
  return 'move';
}
