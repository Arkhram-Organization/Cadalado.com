import { Conexion } from '/comun/conexion.js';
// Reemplazo de WebSocket para Vercel (que no tiene WebSockets). En Cloudflare, por debajo usa un WebSocket
// de verdad (conexion.js): la sala avisa sola y se deja de consultar cada segundo.
// Tiene la misma forma que un WebSocket (onopen, onmessage, onclose, send, close, readyState),
// así main.js casi no cambia: por dentro consulta la sala cada ~1 segundo y manda las acciones por POST.
// El servidor devuelve los mismos mensajes que mandaba el WebSocket ('state', 'chat', 'gaze', 'sena'…).
export class PollingSocket {
  constructor(base) {
    this.base = base; // /api/truco/rooms/CODIGO
    this.readyState = 0;
    this.cursor = null;
    this.h = null;
    this.fails = 0;
    this.pending = 0;
    this.onVisible = () => !document.hidden && this.schedule(0);
    document.addEventListener('visibilitychange', this.onVisible);
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
      this.schedule(0);
    }, 0);
  }

  interval() {
    if (this.vivo?.abierta) return 15000; // en vivo: solo una consulta de control cada tanto
    return document.hidden ? 4000 : 900;
  }

  enVivo() {
    this.vivo = new Conexion(`${this.base}/ws`, {
      hola: () => ({ pid: this.pid || '', cursor: this.cursor ?? '', h: this.h || '' }),
      alCambiar: () => this.schedule(this.interval()),
    });
    this.vivo.alAviso = (data) => data && this.dispatch(data);
  }

  schedule(ms) {
    clearTimeout(this.timer);
    if (this.readyState === 1) this.timer = setTimeout(() => this.poll(), ms);
  }

  dispatch(data) {
    if (data.cursor != null) this.cursor = data.cursor;
    if (data.h) this.h = data.h;
    for (const m of data.msgs || []) {
      if (m.t === 'chat-history') recordar(this.base);
      this.onmessage?.({ data: JSON.stringify(m) });
    }
  }

  async request(method, body) {
    const qs = new URLSearchParams({ pid: this.pid || '', cursor: this.cursor ?? '', h: this.h || '' });
    // "sigo acá" cada ~4 s (no en cada consulta: ahorra operaciones de la base)
    if (Date.now() - (this.lastPing || 0) > 4000) {
      qs.set('ping', '1');
      this.lastPing = Date.now();
    }
    if (this.vivo?.abierta) {
      try {
        const { s, r } = await this.vivo.pedir(method, method === 'GET' ? { q: Object.fromEntries(qs) } : { b: body });
        if (s >= 500) throw new Error(r?.error || 'Error del servidor');
        return r || { msgs: [] };
      } catch {}
    }
    const res = await fetch(method === 'GET' ? `${this.base}/poll?${qs}` : `${this.base}/poll`, {
      method,
      cache: 'no-store',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.headers.get('x-cadalado-ws') && !this.vivo && this.readyState === 1) this.enVivo();
    const data = await res.json().catch(() => ({ msgs: [] }));
    if (res.status >= 500) throw new Error(data.error || 'Error del servidor');
    return data;
  }

  async poll() {
    if (this.readyState !== 1) return;
    try {
      const data = await this.request('GET');
      if (!this.pending || this.vivo?.abierta) this.dispatch(data);
      this.fails = 0;
    } catch {
      if (++this.fails >= 4) return this.fail();
    }
    this.schedule(this.interval());
  }

  send(raw) {
    if (this.readyState !== 1) return;
    const msg = JSON.parse(raw);
    if (msg.t === 'ping') return;
    if (msg.t === 'join') {
      this.pid = msg.pid;
      this.name = msg.name;
      this.cursor = null;
    }
    this.pending++;
    this.request('POST', { pid: this.pid, name: this.name, cursor: this.cursor, h: this.h, msg })
      .then((data) => this.dispatch(data))
      .catch(() => this.onmessage?.({ data: JSON.stringify({ t: 'error', msg: 'No se pudo enviar. Probá de nuevo.' }) }))
      .finally(() => {
        this.pending--;
        this.schedule(this.interval());
      });
  }

  fail() {
    this.close();
    this.onclose?.({});
  }

  close() {
    this.readyState = 3;
    this.vivo?.cerrar();
    clearTimeout(this.timer);
    document.removeEventListener('visibilitychange', this.onVisible);
  }
}

// Guarda la sala en "Volvé a jugar" del portal (mismo dominio, mismo localStorage).
function recordar(base) {
  try {
    const code = base.split('/').pop();
    const lista = JSON.parse(localStorage.getItem('cadalado.recientes') || '[]').filter((x) => x.url !== `/truco/sala/${code}`);
    lista.unshift({ juego: 'truco', url: `/truco/sala/${code}`, titulo: `Sala ${code}`, fecha: Date.now() });
    localStorage.setItem('cadalado.recientes', JSON.stringify(lista.slice(0, 8)));
  } catch {}
}
