// Preferencias del usuario guardadas en localStorage.
export const BOARD_THEMES = {
  green: { name: 'Verde', light: '#ebecd0', dark: '#739552', hlLight: '#f5f682', hlDark: '#b9ca43' },
  brown: { name: 'Madera', light: '#f0d9b5', dark: '#b58863', hlLight: '#f7ec74', hlDark: '#dac34b' },
  blue: { name: 'Azul', light: '#dee3e6', dark: '#8ca2ad', hlLight: '#c3d888', hlDark: '#92b166' },
  ice: { name: 'Hielo', light: '#e8edf9', dark: '#b7c0d8', hlLight: '#b1cbf3', hlDark: '#8ea9e0' },
  purple: { name: 'Morado', light: '#efefef', dark: '#8877b7', hlLight: '#e8e18e', hlDark: '#b5a96c' },
  coral: { name: 'Coral', light: '#b1e4b9', dark: '#70a2a3', hlLight: '#e2ee8a', hlDark: '#a4c66b' },
  night: { name: 'Noche', light: '#9f9f9f', dark: '#5b5b5b', hlLight: '#c5c56b', hlDark: '#8f8f3f' },
};

const KEY = 'chessort.settings';
const DEFAULTS = { theme: 'green', sound: true, coords: true, showLegal: true, animation: true };

let current = { ...DEFAULTS };
try {
  current = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
} catch {}

export function getSettings() {
  return current;
}

export function updateSettings(patch) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {}
  applySettings();
}

export function applySettings() {
  const t = BOARD_THEMES[current.theme] || BOARD_THEMES.green;
  const root = document.documentElement.style;
  root.setProperty('--sq-light', t.light);
  root.setProperty('--sq-dark', t.dark);
  root.setProperty('--hl-light', t.hlLight);
  root.setProperty('--hl-dark', t.hlDark);
  document.body.classList.toggle('no-coords', !current.coords);
}

// Identidad anónima persistente (sirve para reconectarte a tu asiento).
function randomId(n = 24) {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => a[b % a.length]).join('');
}

export function getPid() {
  let pid = null;
  try {
    pid = localStorage.getItem('chessort.pid');
    if (!pid) {
      pid = randomId();
      localStorage.setItem('chessort.pid', pid);
    }
  } catch {
    pid = pid || (window.__pid ||= randomId());
  }
  return pid;
}

export function getName() {
  try {
    let n = localStorage.getItem('chessort.name');
    if (!n) {
      n = 'Jugador' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem('chessort.name', n);
    }
    return n;
  } catch {
    return 'Invitado';
  }
}

export function setName(n) {
  const v = String(n || '').trim().slice(0, 20);
  if (!v) return;
  try {
    localStorage.setItem('chessort.name', v);
  } catch {}
}
