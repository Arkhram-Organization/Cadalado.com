// Posiciones en tiempo real entre jugadores.
// 1) Directo navegador a navegador (WebRTC): ~15 veces por segundo, sin pasar por el servidor.
//    El servidor solo "presenta" a los jugadores (señalización por la sala, ver acción 'senal').
// 2) Si dos navegadores no se pueden conectar directo (algunas redes lo bloquean), plan B:
//    se pasan la posición por el servidor unas 4 veces por segundo.
import { pid } from '/comun/sala.js';

const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

export const codificar = (e, t) => `${e.x.toFixed(2)},${e.y.toFixed(2)},${e.z.toFixed(2)},${e.ry.toFixed(2)},${e.a},${t.toFixed(3)}`;
export function decodificar(s) {
  const [x, y, z, ry, a, t] = String(s).split(',');
  return { x: +x, y: +y, z: +z, ry: +ry, a, t: +t };
}

export class Red {
  constructor({ sala, code, miId, alRecibir }) {
    this.sala = sala;
    this.code = code;
    this.miId = miId;
    this.alRecibir = alRecibir; // (id, estado) => void
    this.pares = new Map(); // id -> { pc, dc, ok, desde }
    this.ultimo = null;
    this.relevoT = setInterval(() => this.relevo(), 250);
  }

  // Asegura una conexión con cada uno de los ids (los demás jugadores conectados).
  sincronizar(ids) {
    for (const id of ids) {
      if (id === this.miId) continue;
      const p = this.pares.get(id);
      const vencido = p && !p.ok && Date.now() - p.desde > 12_000 && !p.reintento;
      if (!p) this.crear(id, this.miId < id);
      else if (vencido) {
        // no se conectó: probamos una vez más; mientras tanto va por el servidor
        p.reintento = true;
        if (this.miId < id) this.reiniciar(id);
      }
    }
    for (const id of [...this.pares.keys()]) if (!ids.includes(id)) this.cerrarPar(id);
  }

  crear(id, ofrezco) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const par = { pc, dc: null, ok: false, desde: Date.now(), reintento: this.pares.get(id)?.reintento };
    this.pares.set(id, par);
    const engancharCanal = (dc) => {
      par.dc = dc;
      dc.onopen = () => (par.ok = true);
      dc.onclose = () => (par.ok = false);
      dc.onmessage = (m) => this.alRecibir(id, decodificar(m.data));
    };
    pc.ondatachannel = (e) => engancharCanal(e.channel);
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) par.ok = false;
    };
    if (ofrezco) {
      engancharCanal(pc.createDataChannel('pos', { ordered: false, maxRetransmits: 0 }));
      (async () => {
        await pc.setLocalDescription(await pc.createOffer());
        await this.juntarIce(pc);
        this.sala.enviar({ t: 'senal', para: id, data: { tipo: 'oferta', sdp: pc.localDescription } });
      })().catch(() => {});
    }
    return par;
  }

  reiniciar(id) {
    this.pares.get(id)?.pc.close();
    this.pares.delete(id);
    this.crear(id, true);
  }

  // Sin "trickle": esperamos a juntar los candidatos y mandamos todo en un solo mensaje.
  juntarIce(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((ok) => {
      const fin = () => ok();
      pc.addEventListener('icegatheringstatechange', () => pc.iceGatheringState === 'complete' && fin());
      setTimeout(fin, 2500);
    });
  }

  async senal(de, data) {
    try {
      if (data?.tipo === 'oferta') {
        this.pares.get(de)?.pc.close();
        this.pares.delete(de);
        const par = this.crear(de, false);
        await par.pc.setRemoteDescription(data.sdp);
        await par.pc.setLocalDescription(await par.pc.createAnswer());
        await this.juntarIce(par.pc);
        this.sala.enviar({ t: 'senal', para: de, data: { tipo: 'respuesta', sdp: par.pc.localDescription } });
      } else if (data?.tipo === 'respuesta') {
        const par = this.pares.get(de);
        if (par && par.pc.signalingState === 'have-local-offer') await par.pc.setRemoteDescription(data.sdp);
      }
    } catch {}
  }

  // Manda mi estado a todos los que están conectados directo.
  enviar(estado, t) {
    const s = codificar(estado, t);
    this.ultimo = s;
    for (const p of this.pares.values()) if (p.ok && p.dc?.readyState === 'open') {
      try {
        p.dc.send(s);
      } catch {}
    }
  }

  sinConexion() {
    return [...this.pares.entries()].filter(([, p]) => !p.ok).map(([id]) => id);
  }

  // Plan B: si hay alguien sin conexión directa, nos pasamos la posición por el servidor.
  async relevo() {
    const faltan = this.sinConexion();
    if (!faltan.length || !this.ultimo || this.ocupado) return;
    this.ocupado = true;
    try {
      await fetch('/api/carrera/pos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pid: pid(), code: this.code, s: this.ultimo }) });
      const r = await fetch(`/api/carrera/pos?code=${encodeURIComponent(this.code)}`, { cache: 'no-store' });
      const { pos } = await r.json();
      for (const id of faltan) if (pos?.[id]) this.alRecibir(id, decodificar(pos[id]));
    } catch {}
    this.ocupado = false;
  }

  estadoConexiones() {
    const todos = [...this.pares.values()];
    return { total: todos.length, directas: todos.filter((p) => p.ok).length };
  }

  cerrarPar(id) {
    try {
      this.pares.get(id)?.pc.close();
    } catch {}
    this.pares.delete(id);
  }

  cerrar() {
    clearInterval(this.relevoT);
    for (const id of [...this.pares.keys()]) this.cerrarPar(id);
  }
}
