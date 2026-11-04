// Utilidades de interfaz: escape de HTML, avatares, iconos SVG y avisos.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const AVATAR_COLORS = ['#e66a5c', '#e59b3c', '#d9c043', '#7fb24c', '#3fa58f', '#4c8fd6', '#7d6bd6', '#c065b5', '#8b7b6b', '#5a8f9e'];
export function avatarHtml(name, color, big = false) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = AVATAR_COLORS[h % AVATAR_COLORS.length];
  const letter = esc((String(name).trim()[0] || '?').toUpperCase());
  return `<div class="avatar ${big ? 'avatar-lg' : ''}" style="--av:${bg}"><span>${letter}</span><i class="avatar-piece" style="background-image:url(/pieces/${color}p.svg)"></i></div>`;
}

const ICONS = {
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  send: '<path d="M4 12l16-8-6 16-2-7z"/>',
  flip: '<path d="M7 4v14m0 0l-3-3m3 3l3-3M17 20V6m0 0l-3 3m3-3l3 3"/>',
  first: '<path d="M6 5v14M18 6l-7 6 7 6"/>',
  prev: '<path d="M15 6l-7 6 7 6"/>',
  next: '<path d="M9 6l7 6-7 6"/>',
  last: '<path d="M18 5v14M6 6l7 6-7 6"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4"/>',
  flag: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  repeat: '<path d="M4 12a8 8 0 0114-5l2 2M20 12a8 8 0 01-14 5l-2-2M20 4v5h-5M4 20v-5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  link: '<path d="M10 14a4 4 0 006 0l3-3a4 4 0 00-6-6l-1 1M14 10a4 4 0 00-6 0l-3 3a4 4 0 006 6l1-1"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4v2a3 3 0 004 3M16 6h4v2a3 3 0 01-4 3M12 13v4M8 21h8M9 17h6v4H9z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0114 0M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 014 6"/>',
  board: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  bullet: '<path d="M4 15l9-9a4 4 0 016 0l-0 0a4 4 0 010 6l-9 9-6 0z" fill="currentColor" stroke="none"/>',
  blitz: '<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none"/>',
  rapid: '<circle cx="12" cy="13" r="8" fill="currentColor" stroke="none"/><path d="M12 9v4l2.5 2" stroke="#262421"/><path d="M10 2h4"/>',
  unlimited: '<path d="M7 9a3 3 0 100 6c2.5 0 7.5-6 10-6a3 3 0 110 6c-2.5 0-7.5-6-10-6z"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
};

export function icon(name) {
  return `<svg class="ico ico-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

let toastTimer;
export function toast(text, kind = 'info') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.append(el);
  }
  el.textContent = text;
  el.dataset.kind = kind;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
