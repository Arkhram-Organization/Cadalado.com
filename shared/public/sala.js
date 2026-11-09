// Cliente de salas de cadalado (memes, casino, carrera). Se sirve en /comun/sala.js.
// Vercel no tiene WebSockets: la sala se consulta cada ~1 s y las acciones van por POST.

const guardar = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};
const leer = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Identificador del dispositivo: sirve para volver a tu lugar si recargás.
export function pid() {
  let p = leer('cadalado.pid');
  if (!p || !/^[A-Za-z0-9_-]{8,64}$/.test(p)) {
    p = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[b % 56]).join('');
    guardar('cadalado.pid', p);
  }
  return p;
}

export const nombreGuardado = () => leer('cadalado.nombre') || leer('chessort.name') || '';
export const guardarNombre = (n) => n && guardar('cadalado.nombre', n.trim().slice(0, 20));
// El personaje armado en /personaje (si no tenés cuenta queda en este navegador)
export const lookGuardado = () => {
  try {
    return JSON.parse(leer('cadalado.look') || 'null');
  } catch {
    return null;
  }
};

let cuentaP = null;
export function cuenta() {
  cuentaP ??= fetch('/api/club/yo', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => d.usuario || null)
    .catch(() => null);
  return cuentaP;
}

export async function api(ruta, body) {
  const res = await fetch(ruta, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status, data });
  return data;
}

export class Sala {
  // base: '/api/memes'  ·  opts: { onEstado, onEvento, onError, onNoExiste, onConexion, intervalo(estado) }
  constructor(base, code, opts = {}) {
    this.url = `${base}/salas/${code}`;
    this.code = code;
    this.o = opts;
    this.cursor = null;
    this.h = null;
    this.estado = null;
    this.offset = 0;
    this.pendientes = 0;
    this.fallas = 0;
    this.cerrada = false;
    this.alVolver = () => !document.hidden && this.programar(0);
    document.addEventListener('visibilitychange', this.alVolver);
    this.unirse();
  }

  ahora() {
    return Date.now() + this.offset;
  }

  async unirse() {
    const u = await cuenta();
    await this.enviar({ t: 'join', nombre: u?.nombre || nombreGuardado() || 'Invitado', look: u?.look || lookGuardado() });
    this.programar(this.intervalo());
  }

  intervalo() {
    if (document.hidden) return 4000;
    return this.o.intervalo?.(this.estado) ?? 1000;
  }

  programar(ms) {
    clearTimeout(this.timer);
    if (!this.cerrada) this.timer = setTimeout(() => this.consultar(), ms);
  }

  aplicar(data, n) {
    // una respuesta que salió antes que otra ya aplicada (y llegó tarde) se descarta
    if (n != null) {
      if (n < (this.aplicada || 0)) return;
      this.aplicada = n;
    }
    if (data.now) this.offset = data.now - Date.now();
    if (data.cursor != null) this.cursor = data.cursor;
    if (data.h) this.h = data.h;
    if (data.estado) {
      this.estado = data.estado;
      this.o.onEstado?.(data.estado, this);
    }
    for (const e of data.eventos || []) this.o.onEvento?.(e, this);
    if (data.error) this.o.onError?.(data.error);
    this.o.onExtra?.(data, this);
  }

  async pedir(body) {
    const n = (this.numero = (this.numero || 0) + 1);
    const ping = Date.now() - (this.ultimoPing || 0) > 4000;
    if (ping) this.ultimoPing = Date.now();
    const q = { pid: pid(), cursor: this.cursor ?? '', h: this.h || '', ...(ping ? { ping: 1 } : {}) };
    const res = await fetch(body ? this.url : `${this.url}?${new URLSearchParams(q)}`, {
      method: body ? 'POST' : 'GET',
      cache: 'no-store',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify({ ...q, ...body }) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 404 && data.noExiste) {
      this.cerrar();
      this.o.onNoExiste?.();
      return null;
    }
    if (res.status >= 500) throw new Error(data.error || 'Error del servidor');
    return Object.defineProperty(data, '_n', { value: n });
  }

  async consultar() {
    if (this.cerrada) return;
    try {
      const data = await this.pedir();
      if (data && !this.pendientes) this.aplicar(data, data._n);
      if (this.fallas) this.o.onConexion?.(true);
      this.fallas = 0;
    } catch {
      if (++this.fallas === 2) this.o.onConexion?.(false);
    }
    this.programar(this.intervalo());
  }

  // Manda una acción. Devuelve la respuesta (con el estado nuevo ya aplicado).
  async enviar(msg) {
    if (this.cerrada) return null;
    this.pendientes++;
    try {
      const data = await this.pedir({ msg });
      if (data) this.aplicar(data, data._n);
      return data;
    } catch (e) {
      this.o.onError?.('No se pudo enviar. Probá de nuevo.');
      return null;
    } finally {
      this.pendientes--;
      this.programar(this.intervalo());
    }
  }

  cerrar() {
    this.cerrada = true;
    clearTimeout(this.timer);
    document.removeEventListener('visibilitychange', this.alVolver);
  }
}

// "Volvé a jugar" del portal.
export function recordar(juego, url, titulo) {
  try {
    const lista = JSON.parse(leer('cadalado.recientes') || '[]').filter((x) => x.url !== url);
    lista.unshift({ juego, url, titulo, fecha: Date.now() });
    guardar('cadalado.recientes', JSON.stringify(lista.slice(0, 8)));
  } catch {}
}

// ---------------------------------------------------------------- avisos y sonidos
let toastT;
export function toast(texto, mal = false) {
  let el = document.querySelector('.cl-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'cl-toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = texto;
  el.classList.toggle('mal', mal);
  el.classList.add('ver');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('ver'), mal ? 5000 : 2600);
}

let actx;
export function sonar(tipo = 'clic') {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    const tono = (f, d, v = 0.12, forma = 'sine', at = 0) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = forma;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(v, t + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + d);
      o.connect(g).connect(actx.destination);
      o.start(t + at);
      o.stop(t + at + d + 0.05);
    };
    const ruido = (d, v = 0.2, f = 2000) => {
      const len = Math.floor(actx.sampleRate * d);
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
      const s = actx.createBufferSource();
      s.buffer = buf;
      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      const g = actx.createGain();
      g.gain.value = v;
      s.connect(bp).connect(g).connect(actx.destination);
      s.start(t);
    };
    ({
      clic: () => ruido(0.04, 0.25, 3000),
      ficha: () => { ruido(0.05, 0.35, 2500); tono(1800, 0.05, 0.04, 'triangle'); },
      carta: () => ruido(0.09, 0.3, 1400),
      bola: () => ruido(0.03, 0.15, 4000),
      gana: () => { tono(660, 0.12); tono(880, 0.12, 0.12, 'sine', 0.1); tono(1320, 0.25, 0.12, 'sine', 0.2); },
      jackpot: () => { for (let i = 0; i < 8; i++) tono(600 + i * 120, 0.12, 0.1, 'square', i * 0.07); },
      pierde: () => { tono(330, 0.18, 0.08, 'triangle'); tono(247, 0.3, 0.08, 'triangle', 0.15); },
      aviso: () => tono(990, 0.12, 0.08),
      salto: () => tono(520, 0.1, 0.06, 'triangle'),
      tick: () => tono(1400, 0.03, 0.04, 'square'),
      pina: () => { ruido(0.12, 0.5, 600); tono(120, 0.15, 0.12, 'square'); },
    })[tipo]?.();
  } catch {}
}

// ---------------------------------------------------------------- barra superior común
export async function marco({ juego, color = '#c5f04a', volver = null }) {
  import('./menu-esc.js').then((m) => m.menuEsc({ juego, volver: volver || '/' }));
  import('./seguir-grupo.js').then((m) => m.seguirGrupo()).catch(() => {});
  const barra = document.createElement('header');
  barra.className = 'cl-barra';
  barra.style.setProperty('--juego', color);
  barra.innerHTML = `
    <a class="cl-logo" href="/" title="Volver a cadalado"><img src="/comun/marca.svg" alt=""><span>cadalado</span></a>
    <span class="cl-sep"></span>
    <a class="cl-juego" href="${volver || location.pathname.split('/').slice(0, 2).join('/') + '/'}">${esc(juego)}</a>
    <span class="cl-espacio"></span>
    <span class="cl-cuenta"></span>`;
  document.body.prepend(barra);
  const u = await cuenta();
  barra.querySelector('.cl-cuenta').innerHTML = u
    ? `<a href="/club" class="cl-chip"><b style="background:${color}">${esc(u.nombre[0]?.toUpperCase() || '?')}</b>${esc(u.nombre)}</a>`
    : `<a href="/entrar?volver=${encodeURIComponent(location.pathname)}" class="cl-chip">Entrar</a>`;
  return u;
}
