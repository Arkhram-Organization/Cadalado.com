import { DurableObject } from 'cloudflare:workers';

const MIN = 60_000;

// Un único Durable Object ("global") que guarda un resumen de cada sala para la portada.
export class Lobby extends DurableObject {
  async upsert(summary) {
    await this.ctx.storage.put('g:' + summary.id, { ...summary, updatedAt: Date.now() });
  }

  async list() {
    const all = await this.ctx.storage.list({ prefix: 'g:' });
    const now = Date.now();
    const open = [];
    const live = [];
    const stale = [];
    for (const [key, g] of all) {
      const age = now - g.updatedAt;
      const expired =
        (g.status === 'ended' && age > 2 * MIN) ||
        (g.status === 'waiting' && !g.hostOnline && age > 30 * MIN) ||
        age > 24 * 60 * MIN;
      if (expired) {
        stale.push(key);
        continue;
      }
      if (g.status === 'waiting' && g.hostOnline) open.push(g);
      else if (g.status === 'playing' && g.online > 0) live.push(g);
    }
    for (let i = 0; i < stale.length; i += 128) await this.ctx.storage.delete(stale.slice(i, i + 128));
    const byRecent = (a, b) => b.updatedAt - a.updatedAt;
    return { open: open.sort(byRecent).slice(0, 50), live: live.sort(byRecent).slice(0, 50) };
  }

  // ---- Truco ----
  async upsertTruco(summary) {
    await this.ctx.storage.put('t:' + summary.code, { ...summary, updatedAt: Date.now() });
  }

  async listTruco() {
    const all = await this.ctx.storage.list({ prefix: 't:' });
    const now = Date.now();
    const open = [];
    const live = [];
    const stale = [];
    for (const [key, r] of all) {
      const age = now - r.updatedAt;
      const expired = (r.online === 0 && age > 10 * MIN) || (r.status === 'ended' && age > 5 * MIN) || age > 24 * 60 * MIN;
      if (expired) {
        stale.push(key);
        continue;
      }
      if (!r.isPublic) continue;
      if (r.status === 'lobby' && r.free > 0 && r.online > 0) open.push(r);
      else if (r.status === 'playing' && r.online > 0) live.push(r);
    }
    for (let i = 0; i < stale.length; i += 128) await this.ctx.storage.delete(stale.slice(i, i + 128));
    const byRecent = (a, b) => b.updatedAt - a.updatedAt;
    return { open: open.sort(byRecent).slice(0, 50), live: live.sort(byRecent).slice(0, 50) };
  }

  // Partida rápida: una sala pública esperando gente en ese modo.
  async findTruco(mode) {
    const { open } = await this.listTruco();
    const r = open.filter((x) => x.mode === mode).sort((a, b) => a.free - b.free)[0];
    return r ? r.code : null;
  }
}
