// Conexión en vivo con el servidor (WebSocket), para cuando cadalado corre en Cloudflare.
// El servidor avisa cuando algo cambia (en vez de que el navegador pregunte cada segundo) y las acciones
// viajan por el mismo canal. Si el WebSocket no anda o se corta, quien lo usa vuelve a consultar por HTTP.
//
//   const c = new Conexion('/api/royale/salas/ABCDE/ws', { hola: () => ({ pid, cursor, h }) });
//   c.alAviso = (datos, status) => …     (novedades que manda el servidor solo)
//   c.alPos = (pos) => …                 (posiciones de otros jugadores, plan B)
//   const { s, r } = await c.pedir('POST', { cuerpo })
export class Conexion {
  constructor(ruta, { hola = () => ({}), alCambiar = () => {} } = {}) {
    this.ruta = ruta;
    this.hola = hola;
    this.alCambiar = alCambiar; // (abierta: boolean)
    this.esperando = new Map();
    this.n = 0;
    this.intentos = 0;
    this.cerrada = false;
    // una pestaña oculta más de un minuto suelta la conexión (y la sala deja de trabajar para ella);
    // al volver, se reconecta enseguida
    this.alVer = () => {
      clearTimeout(this.dormir);
      if (document.hidden) {
        this.dormir = setTimeout(() => {
          this.dormida = true;
          try { this.ws?.close(1000); } catch {}
        }, 60_000);
      } else if (this.dormida) {
        this.dormida = false;
        this.intentos = 0;
        if (!this.ws) this.abrir();
      }
    };
    document.addEventListener('visibilitychange', this.alVer);
    this.abrir();
  }

  get abierta() {
    return this.ws?.readyState === 1;
  }

  abrir() {
    if (this.cerrada) return;
    const url = new URL(this.ruta, document.baseURI);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const h = this.hola() || {};
    if (h.pid) url.searchParams.set('pid', h.pid);
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      return this.reintentar();
    }
    this.ws = ws;
    ws.onopen = () => {
      this.intentos = 0;
      ws.send(JSON.stringify({ hola: this.hola() || {} }));
      this.alCambiar(true);
    };
    ws.onmessage = (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.id !== undefined && this.esperando.has(m.id)) {
        const { ok, t } = this.esperando.get(m.id);
        clearTimeout(t);
        this.esperando.delete(m.id);
        ok({ s: m.s, r: m.r });
      } else if (m.p !== undefined) this.alAviso?.(m.p, m.s);
      else if (m.pos) this.alPos?.(m.pos);
      else if (m.aviso) this.alAvisoClub?.(m.aviso);
    };
    ws.onclose = () => {
      const estaba = this.ws === ws;
      for (const { mal, t } of this.esperando.values()) {
        clearTimeout(t);
        mal(new Error('Se cortó la conexión'));
      }
      this.esperando.clear();
      if (estaba) {
        this.ws = null;
        this.alCambiar(false);
        this.reintentar();
      }
    };
    ws.onerror = () => {};
  }

  reintentar() {
    if (this.cerrada || this.dormida) return;
    // 0,5 s, 1 s, 2 s… hasta 15 s entre intentos
    const espera = Math.min(15000, 500 * 2 ** Math.min(this.intentos++, 5));
    clearTimeout(this.reintento);
    this.reintento = setTimeout(() => this.abrir(), espera);
  }

  // Pide algo por el canal. metodo 'GET' (con q) o 'POST' (con b). En el club se indica la ruta.
  pedir(metodo, { q, b, ruta } = {}, msMax = 10000) {
    if (!this.abierta) return Promise.reject(new Error('Sin conexión en vivo'));
    const id = ++this.n;
    return new Promise((ok, mal) => {
      const t = setTimeout(() => {
        this.esperando.delete(id);
        mal(new Error('El servidor no respondió'));
      }, msMax);
      this.esperando.set(id, { ok, mal, t });
      this.ws.send(JSON.stringify({ id, m: metodo, q, b, ruta }));
    });
  }

  // Posición propia para el plan B (cuando dos navegadores no se pueden conectar directo).
  enviarPos(s) {
    if (this.abierta) this.ws.send(JSON.stringify({ pos: s }));
  }

  cerrar() {
    this.cerrada = true;
    clearTimeout(this.reintento);
    clearTimeout(this.dormir);
    document.removeEventListener('visibilitychange', this.alVer);
    try {
      this.ws?.close(1000);
    } catch {}
  }
}
