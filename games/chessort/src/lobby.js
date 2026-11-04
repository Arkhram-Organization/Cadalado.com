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
}
