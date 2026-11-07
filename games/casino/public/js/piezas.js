// Piezas visuales del casino: fichas, cartas francesas y símbolos de la tragamonedas (todo dibujado, sin imágenes).
export const VALORES_FICHA = [10, 50, 100, 500, 1000, 5000];
const corto = (v) => (v >= 1000 ? v / 1000 + 'K' : String(v));
export const ficha = (v, extra = '') => `<span class="ficha ${extra}" data-v="${v}"><span>${corto(v)}</span></span>`;
export const fmt = (n) => Number(n || 0).toLocaleString('es-AR');

// Descompone un monto en fichas (de mayor a menor) para dibujar pilas.
export function enFichas(monto, max = 5) {
  const out = [];
  for (const v of [...VALORES_FICHA].reverse()) while (monto >= v && out.length < max) {
    out.push(v);
    monto -= v;
  }
  return out;
}

const PALO = { P: '♠', C: '♥', D: '♦', T: '♣' };
export function carta(c, { nueva = false, rot = 0 } = {}) {
  if (c === 'X') return `<div class="carta dorso ${nueva ? 'nueva' : ''}" style="--rot:${rot}deg"></div>`;
  const v = c.slice(0, -1);
  const p = c.slice(-1);
  const roja = p === 'C' || p === 'D';
  const centro = ['J', 'Q', 'K'].includes(v) ? `<span style="font-size:.8em">${v}${PALO[p]}</span>` : v === 'A' ? `<span style="font-size:1.35em">${PALO[p]}</span>` : PALO[p];
  return `<div class="carta ${roja ? 'roja' : ''} ${nueva ? 'nueva' : ''}" style="--rot:${rot}deg" aria-label="${v} de ${{ P: 'picas', C: 'corazones', D: 'diamantes', T: 'tréboles' }[p]}">
    <span class="esq e1">${v}<i>${PALO[p]}</i></span><span class="centro">${centro}</span><span class="esq e2">${v}<i>${PALO[p]}</i></span></div>`;
}

export const SIMBOLO = {
  cereza: `<svg viewBox="0 0 64 64"><path d="M30 10c6 10 4 22-6 30M34 10c4 12 10 20 18 24" stroke="#2f8f2f" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M30 10c8-6 18-4 22 2-8 4-16 2-22-2z" fill="#3fae3f"/><circle cx="22" cy="46" r="12" fill="#d0112b"/><circle cx="46" cy="42" r="12" fill="#e2213b"/><circle cx="18" cy="42" r="3" fill="#fff" opacity=".7"/><circle cx="42" cy="38" r="3" fill="#fff" opacity=".7"/></svg>`,
  limon: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="34" rx="24" ry="17" fill="#ffd60a"/><ellipse cx="32" cy="34" rx="24" ry="17" fill="none" stroke="#e0a800" stroke-width="3"/><circle cx="8" cy="34" r="4" fill="#ffd60a"/><circle cx="56" cy="34" r="4" fill="#ffd60a"/><ellipse cx="24" cy="28" rx="8" ry="4" fill="#fff" opacity=".45"/></svg>`,
  naranja: `<svg viewBox="0 0 64 64"><circle cx="32" cy="36" r="22" fill="#ff8c1a"/><circle cx="32" cy="36" r="22" fill="none" stroke="#d96a00" stroke-width="3"/><path d="M32 14c6-8 16-8 20-4-6 6-14 6-20 4z" fill="#3fae3f"/><circle cx="25" cy="28" r="5" fill="#fff" opacity=".35"/></svg>`,
  uva: `<svg viewBox="0 0 64 64"><path d="M32 6v10" stroke="#5a3a1a" stroke-width="4" stroke-linecap="round"/><path d="M34 12c8-6 16-2 18 2-8 2-14 2-18-2z" fill="#3fae3f"/>${[[24, 22], [40, 22], [16, 34], [32, 34], [48, 34], [24, 46], [40, 46], [32, 58]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8.5" fill="#7b2fbf" stroke="#4e1a80" stroke-width="2"/>`).join('')}</svg>`,
  campana: `<svg viewBox="0 0 64 64"><path d="M32 8c-12 0-18 10-18 24v10l-6 8h48l-6-8V32C50 18 44 8 32 8z" fill="#f2c94c" stroke="#b8860b" stroke-width="3"/><circle cx="32" cy="54" r="6" fill="#b8860b"/><path d="M24 20c2-4 6-6 8-6" stroke="#fff" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/></svg>`,
  bar: `<svg viewBox="0 0 64 64"><rect x="6" y="20" width="52" height="24" rx="5" fill="#111" stroke="#f2c94c" stroke-width="3"/><text x="32" y="39" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="900" font-size="16" fill="#f2c94c">BAR</text></svg>`,
  diamante: `<svg viewBox="0 0 64 64"><path d="M14 22l10-12h16l10 12-18 32z" fill="#38d9e6" stroke="#0b8a99" stroke-width="3" stroke-linejoin="round"/><path d="M14 22h36M24 10l8 12 8-12M32 22v32" stroke="#0b8a99" stroke-width="2" fill="none"/><path d="M20 20l6-7" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
  siete: `<svg viewBox="0 0 64 64"><text x="32" y="54" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="900" font-size="58" fill="#e2213b" stroke="#7a0718" stroke-width="3" paint-order="stroke">7</text></svg>`,
};
export const NOMBRES_SIMBOLO = Object.keys(SIMBOLO);
