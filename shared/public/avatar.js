// Avatares dibujados (SVG) de personas: busto con cara, pelo, ropa y accesorios.
// Usan el mismo "look" que los muñecos 3D (ver npcs.js), así cada personaje se reconoce en todos los juegos.
import { POR_ID, LOOKS_EXTRA, rngNpc } from './npcs.js';

// Look para una persona real (sale de su id, con el color que eligió).
export function lookDeId(id, color = '#7aa2ff') {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = rngNpc(h);
  const de = (l) => l[Math.floor(r() * l.length)];
  return {
    piel: de(['#f0cfb4', '#e8c4a8', '#d9a982', '#b98463', '#8d5b3e']),
    pelo: { estilo: de(['corto', 'corto', 'rulos', 'largo', 'poco']), color: de(['#1e1610', '#3b2a1e', '#6b4226', '#c49a5a', '#141414']) },
    ojos: '#1b1410',
    cuerpo: de(['flaco', 'normal', 'normal', 'gordito']),
    ropa: { remera: color, pantalon: '#2b2b33' },
  };
}

// Look de un bot por su nombre (NPC del club o personaje extra de los memes).
export function lookDeNombre(nombre) {
  const n = String(nombre || '').trim();
  const npc = Object.values(POR_ID).find((x) => x.nombre.toLowerCase() === n.toLowerCase());
  if (npc) return { ...npc.look, smoking: npc.smoking };
  return LOOKS_EXTRA[n] || lookDeId(n, '#9be15d');
}

const oscurecer = (hex, k = 0.75) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${[c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
};

// SVG cuadrado (viewBox 100x100): fondo redondo de color, hombros con la remera y la cabeza.
export function avatarSvg(look = {}, { fondo = null, titulo = '' } = {}) {
  const L = { piel: '#e8c4a8', pelo: { estilo: 'corto', color: '#2b1d14' }, ojos: '#1b1410', cuerpo: 'normal', ropa: { remera: '#7aa2ff' }, ...look };
  const remera = L.smoking ? '#141416' : L.ropa?.remera || '#7aa2ff';
  const piel = L.piel;
  const pelo = L.pelo?.color || '#222';
  const est = L.pelo?.estilo || 'corto';
  const ancho = { flaco: 30, normal: 34, gordito: 40 }[L.cuerpo] || 34;
  const bg = fondo || oscurecer(remera, 0.55);
  const cx = 50;
  const cy = 44; // centro de la cabeza
  const rx = L.cuerpo === 'gordito' ? 22 : 20;
  const ry = 22;
  let s = '';
  // hombros
  s += `<path d="M${cx - ancho} 100 Q${cx - ancho} ${70} ${cx} ${68} Q${cx + ancho} ${70} ${cx + ancho} 100 Z" fill="${remera}"/>`;
  if (L.smoking) s += `<path d="M44 70 L50 86 L56 70 Z" fill="#f4f4ee"/><rect x="45" y="70" width="10" height="4" rx="2" fill="#0b0b0b"/>`;
  if (L.ropa?.franja && !L.smoking) s += `<rect x="${cx - ancho + 4}" y="84" width="${ancho * 2 - 8}" height="5" fill="${L.ropa.franja}"/>`;
  if (L.capa) s += `<path d="M${cx - ancho - 2} 100 Q${cx - ancho} 72 ${cx - 14} 70 L${cx - 18} 100Z M${cx + ancho + 2} 100 Q${cx + ancho} 72 ${cx + 14} 70 L${cx + 18} 100Z" fill="${L.capa}"/>`;
  // pelo de atrás (largo)
  if (est === 'largo') s += `<path d="M${cx - rx - 3} ${cy - 4} Q${cx - rx - 6} ${cy + 30} ${cx - rx + 2} ${cy + 32} L${cx + rx - 2} ${cy + 32} Q${cx + rx + 6} ${cy + 30} ${cx + rx + 3} ${cy - 4} Z" fill="${pelo}"/>`;
  // orejas y cabeza
  if (!L.robot) s += `<circle cx="${cx - rx}" cy="${cy + 2}" r="4.5" fill="${piel}"/><circle cx="${cx + rx}" cy="${cy + 2}" r="4.5" fill="${piel}"/>`;
  s += L.robot ? `<rect x="${cx - rx}" y="${cy - ry}" width="${rx * 2}" height="${ry * 2}" rx="10" fill="${piel}" stroke="#5d6773" stroke-width="2"/>` : `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${piel}"/>`;
  // pelo de arriba
  const top = `M${cx - rx - 1} ${cy - 2}`;
  if (est === 'corto' || est === 'largo') s += `<path d="${top} Q${cx - rx} ${cy - ry - 8} ${cx} ${cy - ry - 3} Q${cx + rx} ${cy - ry - 8} ${cx + rx + 1} ${cy - 2} Q${cx + rx - 4} ${cy - 14} ${cx + 4} ${cy - 15} Q${cx - 10} ${cy - 15} ${cx - rx + 3} ${cy - 6} Z" fill="${pelo}"/>`;
  else if (est === 'poco') s += `<path d="M${cx - rx - 1} ${cy + 4} Q${cx - rx - 2} ${cy - 10} ${cx - rx + 6} ${cy - 14} L${cx - rx + 6} ${cy + 2} Z M${cx + rx + 1} ${cy + 4} Q${cx + rx + 2} ${cy - 10} ${cx + rx - 6} ${cy - 14} L${cx + rx - 6} ${cy + 2} Z" fill="${pelo}"/>`;
  else if (est === 'rulos' || est === 'rulosPoco') {
    const n = est === 'rulos' ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      s += `<circle cx="${cx + Math.cos(a) * (rx - 2)}" cy="${cy - 6 + Math.sin(a) * (ry - 2)}" r="${est === 'rulos' ? 7 : 5}" fill="${pelo}"/>`;
    }
  }
  // cara
  const ojo = L.robot ? '#38d9e6' : L.ojos || '#1b1410';
  s += `<ellipse cx="${cx - 7.5}" cy="${cy + 1}" rx="3" ry="4.2" fill="${ojo}"/><ellipse cx="${cx + 7.5}" cy="${cy + 1}" rx="3" ry="4.2" fill="${ojo}"/>`;
  s += `<circle cx="${cx - 6.5}" cy="${cy - 0.5}" r="1.1" fill="#fff"/><circle cx="${cx + 8.5}" cy="${cy - 0.5}" r="1.1" fill="#fff"/>`;
  if (!L.robot) s += `<circle cx="${cx - 13}" cy="${cy + 9}" r="3.4" fill="#ff8a7a" opacity=".35"/><circle cx="${cx + 13}" cy="${cy + 9}" r="3.4" fill="#ff8a7a" opacity=".35"/>`;
  if (est !== 'calvo' || L.barba) s += `<path d="M${cx - 11} ${cy - 7} l7 -1.5 M${cx + 11} ${cy - 7} l-7 -1.5" stroke="${pelo}" stroke-width="2.2" stroke-linecap="round"/>`;
  if (L.barba) s += `<path d="M${cx - rx + 2} ${cy + 4} Q${cx - rx + 2} ${cy + ry + 6} ${cx} ${cy + ry + 6} Q${cx + rx - 2} ${cy + ry + 6} ${cx + rx - 2} ${cy + 4} Q${cx + 8} ${cy + 12} ${cx} ${cy + 12} Q${cx - 8} ${cy + 12} ${cx - rx + 2} ${cy + 4}Z" fill="${L.barba}"/>`;
  s += `<path d="M${cx - 5} ${cy + 11} Q${cx} ${cy + 15} ${cx + 5} ${cy + 11}" stroke="#5a2b25" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  // accesorios
  if (L.lentes) s += `<g fill="none" stroke="${L.lentes}" stroke-width="2"><circle cx="${cx - 7.5}" cy="${cy + 1}" r="6"/><circle cx="${cx + 7.5}" cy="${cy + 1}" r="6"/><path d="M${cx - 1.5} ${cy + 1}h3"/></g>`;
  if (L.antifaz) s += `<rect x="${cx - rx + 1}" y="${cy - 5}" width="${rx * 2 - 2}" height="10" rx="5" fill="${L.antifaz}" opacity=".9"/><ellipse cx="${cx - 7.5}" cy="${cy}" rx="3" ry="3" fill="#fff"/><ellipse cx="${cx + 7.5}" cy="${cy}" rx="3" ry="3" fill="#fff"/>`;
  if (L.kipa) s += `<path d="M${cx - 9} ${cy - ry + 3} Q${cx} ${cy - ry - 7} ${cx + 9} ${cy - ry + 3} Z" fill="${L.kipa}"/>`;
  if (L.sombrero) s += `<rect x="${cx - rx - 8}" y="${cy - ry - 2}" width="${rx * 2 + 16}" height="5" rx="2" fill="${L.sombrero}"/><rect x="${cx - 13}" y="${cy - ry - 14}" width="26" height="13" rx="3" fill="${L.sombrero}"/>`;
  if (L.auriculares) s += `<path d="M${cx - rx - 2} ${cy + 2} Q${cx - rx} ${cy - ry - 8} ${cx} ${cy - ry - 7} Q${cx + rx} ${cy - ry - 8} ${cx + rx + 2} ${cy + 2}" stroke="${L.auriculares}" stroke-width="3.5" fill="none"/><rect x="${cx - rx - 6}" y="${cy - 4}" width="7" height="12" rx="3" fill="${L.auriculares}"/><rect x="${cx + rx - 1}" y="${cy - 4}" width="7" height="12" rx="3" fill="${L.auriculares}"/>`;
  if (L.robot) s += `<path d="M${cx} ${cy - ry} v-8" stroke="#8a96a3" stroke-width="2"/><circle cx="${cx}" cy="${cy - ry - 9}" r="3" fill="#ff6b5b"/>`;
  const brillo = L.dorado ? `<circle cx="50" cy="50" r="47" fill="none" stroke="#f2c94c" stroke-width="5"/>` : '';
  return `<svg viewBox="0 0 100 100" class="avatar-svg" role="img" aria-label="${String(titulo).replace(/"/g, '')}"><defs><clipPath id="cr"><circle cx="50" cy="50" r="48"/></clipPath></defs><circle cx="50" cy="50" r="48" fill="${bg}"/><g clip-path="url(#cr)">${s}</g>${brillo}</svg>`;
}
