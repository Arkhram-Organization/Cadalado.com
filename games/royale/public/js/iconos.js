// Íconos del HUD de Battle Shmitz (siluetas en SVG, usan currentColor).
const svg = (vb, cuerpo) => `<svg viewBox="${vb}" aria-hidden="true" fill="currentColor">${cuerpo}</svg>`;
export const ICONOS = {
  pistola: svg('0 0 64 32', '<path d="M8 7h40v8H27l-4 14h-10l4-14H8z"/><rect x="48" y="9" width="8" height="4"/>'),
  subfusil: svg('0 0 64 32', '<path d="M2 8h52v8h-8v2H35l-2 10h-7l2-10h-4l-2 6h-7l2-6H2z"/><rect x="54" y="10" width="8" height="4"/><rect x="0" y="9" width="4" height="10"/>'),
  escopeta: svg('0 0 64 32', '<path d="M2 10h60v4H36v3H16l-7 9H1l5-11 1-1z"/><rect x="38" y="15" width="14" height="4" rx="1"/>'),
  rifle: svg('0 0 64 32', '<path d="M1 11h13l2-2h28V6h5v3h14v5H48v2h-7l-3 12h-7l3-12h-8l-2 5h-6v-5H15l-8 9H1l5-10z"/><rect x="24" y="3" width="14" height="5" rx="2"/>'),
  francotirador: svg('0 0 64 32', '<path d="M0 12h64v3H42v3H20l-9 9H2l7-11H0z"/><rect x="20" y="4" width="20" height="6" rx="3"/><rect x="28" y="9" width="3" height="4"/>'),
  rpg: svg('0 0 64 32', '<path d="M4 10h48l10 5-10 5H4z"/><rect x="20" y="20" width="5" height="9"/><rect x="34" y="20" width="5" height="7"/><rect x="0" y="8" width="6" height="14" rx="1"/>'),
  venda: svg('0 0 64 32', '<circle cx="26" cy="16" r="11"/><circle cx="26" cy="16" r="4" fill="#0004"/><path d="M34 21h24v6H30z"/>'),
  botiquin: svg('0 0 64 32', '<path fill-rule="evenodd" d="M14 7h36a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3zm15 5v4h-4v5h4v4h6v-4h4v-5h-4v-4z"/><rect x="25" y="2" width="14" height="5" rx="2"/>'),
  mini: svg('0 0 64 32', '<circle cx="32" cy="20" r="10"/><rect x="28" y="3" width="8" height="9" rx="1"/><rect x="26" y="1" width="12" height="4" rx="1"/>'),
  escudo: svg('0 0 64 32', '<rect x="21" y="8" width="22" height="22" rx="6"/><rect x="26" y="2" width="12" height="7" rx="2"/><rect x="30" y="13" width="4" height="12" fill="#fff6"/>'),
  granada: svg('0 0 64 32', '<circle cx="30" cy="19" r="11"/><rect x="26" y="4" width="9" height="6" rx="1"/><circle cx="41" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="2.4"/>'),
  pico: svg('0 0 64 32', '<path d="M10 15C20 4 42 2 56 8l1 4C44 8 26 9 13 18z"/><path d="M33 6l5 0 6 24-5 1z"/><circle cx="35" cy="8" r="3.4"/>'),
  madera: svg('0 0 32 32', '<rect x="3" y="7" width="26" height="8" rx="4"/><rect x="3" y="17" width="26" height="8" rx="4"/><circle cx="7" cy="11" r="2.4" fill="#0003"/><circle cx="7" cy="21" r="2.4" fill="#0003"/>'),
  piedra: svg('0 0 32 32', '<path d="M5 22l4-11 9-5 9 6 2 10-6 5H11z"/>'),
  metal: svg('0 0 32 32', '<path d="M3 12l13-6 13 6-13 6z"/><path d="M3 17l13 6 13-6v4l-13 6-13-6z"/>'),
  tormenta: svg('0 0 32 32', '<circle cx="16" cy="17" r="11" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 10h3v8h-3z"/><path d="M16 16h6v3h-6z"/><rect x="12" y="2" width="8" height="3" rx="1"/>'),
  gente: svg('0 0 32 32', '<circle cx="16" cy="9" r="6"/><path d="M5 29c0-7 5-12 11-12s11 5 11 12z"/>'),
  calavera: svg('0 0 32 32', '<path fill-rule="evenodd" d="M16 3C9 3 4 8 4 15c0 4 2 7 5 8v5h14v-5c3-1 5-4 5-8 0-7-5-12-12-12zm-5 10a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm10 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-5 7l2 3h-4z"/>'),
  pared: svg('0 0 32 32', '<path d="M4 6h24v20H4z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M4 13h24M4 19h24M14 6v7M20 13v6M12 19v7" stroke="currentColor" stroke-width="2"/>'),
  escalera: svg('0 0 32 32', '<path d="M4 28L28 4" stroke="currentColor" stroke-width="3"/><path d="M8 28L28 8v20z" opacity=".55"/>'),
  balas: svg('0 0 32 32', '<path d="M8 12c0-5 2-8 3-8s3 3 3 8v14H8zM18 12c0-5 2-8 3-8s3 3 3 8v14h-6z"/>'),
  marca: svg('0 0 32 32', '<path d="M16 2c-6 0-10 4-10 10 0 7 10 18 10 18s10-11 10-18c0-6-4-10-10-10zm0 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/>'),
  corona: svg('0 0 32 32', '<path d="M4 24l-2-15 8 6 6-10 6 10 8-6-2 15z"/><rect x="4" y="25" width="24" height="4"/>'),
};
export const icono = (tipo) => ICONOS[tipo] || ICONOS[tipo?.replace('balas-', '') ? 'balas' : 'balas'] || '';
