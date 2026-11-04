import { Board } from './board.js';
import { TIME_CONTROLS } from './core.js';
import { mountGame } from './game-view.js';
import { OnlineController, LocalController } from './controllers.js';
import { BOARD_THEMES, applySettings, getSettings, updateSettings, getPid, getName, setName } from './settings.js';
import { setSoundEnabled } from './sound.js';
import { esc, icon, toast, avatarHtml } from './ui.js';

const app = document.getElementById('app');
let cleanup = null;

// ---------- navegación ----------
export function navigate(path, replace = false) {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  route();
}

function route() {
  cleanup?.();
  cleanup = null;
  const path = location.pathname;
  document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === path));
  const m = path.match(/^\/game\/([a-z0-9]{4,16})$/);
  if (m) return showOnlineGame(m[1]);
  if (path === '/local') return showLocalGame(new URLSearchParams(location.search).get('tc') || '10+0');
  return showHome();
}

window.addEventListener('popstate', route);
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  navigate(a.getAttribute('href'));
});

// ---------- portada ----------
const CATS = [
  { id: 'bullet', name: 'Bala', icon: 'bullet' },
  { id: 'blitz', name: 'Blitz', icon: 'blitz' },
  { id: 'rapid', name: 'Rápidas', icon: 'rapid' },
  { id: 'unlimited', name: 'Sin límite', icon: 'unlimited' },
];

function showHome() {
  let tc = localStorage.getItem('chessort.tc') || '10+0';
  let color = 'random';
  app.innerHTML = `
    <div class="home">
      <section class="home-board-col">
        <div class="player-bar mini">${avatarHtml('Rival', 'b')}<div class="pinfo"><div class="pname">Rival</div></div></div>
        <div class="home-board"></div>
        <div class="player-bar mini">${avatarHtml(getName(), 'w')}<div class="pinfo"><div class="pname" data-myname>${esc(getName())}</div></div></div>
      </section>
      <section class="home-panel card">
        <div class="panel-header">${icon('play')}<h1>Jugar ajedrez</h1></div>
        <div class="panel-scroll">
          <label class="field-label" for="name">Tu nombre</label>
          <div class="name-field">${icon('edit')}<input id="name" maxlength="20" value="${esc(getName())}"></div>

          <div class="field-label">Ritmo de juego</div>
          <div class="tc-groups">
            ${CATS.map((c) => {
              const tcs = TIME_CONTROLS.filter((t) => t.cat === c.id);
              return `<div class="tc-group"><div class="tc-cat cat-${c.id}">${icon(c.icon)} ${c.name}</div>
                <div class="tc-row">${tcs.map((t) => `<button class="tc-btn ${t.id === tc ? 'selected' : ''}" data-tc="${t.id}">${t.label}</button>`).join('')}</div></div>`;
            }).join('')}
          </div>

          <div class="field-label">Juegas con</div>
          <div class="color-pick">
            <button data-color="w" title="Blancas"><img src="/pieces/wk.svg" alt="Blancas"></button>
            <button data-color="random" class="selected" title="Al azar"><span class="half-king"><img src="/pieces/wk.svg" alt=""><img src="/pieces/bk.svg" alt=""></span></button>
            <button data-color="b" title="Negras"><img src="/pieces/bk.svg" alt="Negras"></button>
          </div>

          <button class="btn btn-green btn-xl" data-create>Crear partida</button>
          <button class="btn btn-gray btn-block" data-local>${icon('users')} Jugar en este dispositivo</button>

          <form class="join-form">
            <input placeholder="Código o enlace de partida" autocomplete="off">
            <button class="btn btn-gray">Unirse</button>
          </form>

          <div class="lobby">
            <div class="lobby-head">Desafíos abiertos <span class="lobby-count" data-open-count></span></div>
            <div class="lobby-list" data-open><div class="lobby-empty">Cargando…</div></div>
            <div class="lobby-head">Partidas en vivo <span class="lobby-count" data-live-count></span></div>
            <div class="lobby-list" data-live></div>
          </div>
        </div>
      </section>
    </div>`;

  const board = new Board(app.querySelector('.home-board'), { settings: getSettings });
  board.setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', { animate: false });

  const nameInput = app.querySelector('#name');
  nameInput.addEventListener('change', () => {
    setName(nameInput.value);
    nameInput.value = getName();
    app.querySelector('[data-myname]').textContent = getName();
    renderSidebarUser();
  });

  app.querySelectorAll('.tc-btn').forEach((b) => {
    b.onclick = () => {
      tc = b.dataset.tc;
      localStorage.setItem('chessort.tc', tc);
      app.querySelectorAll('.tc-btn').forEach((x) => x.classList.toggle('selected', x === b));
    };
  });
  app.querySelectorAll('[data-color]').forEach((b) => {
    b.onclick = () => {
      color = b.dataset.color;
      app.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('selected', x === b));
    };
  });

  app.querySelector('[data-create]').onclick = async (e) => {
    setName(nameInput.value);
    e.target.disabled = true;
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tc, color, pid: getPid(), name: getName() }),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      navigate('/game/' + id);
    } catch {
      toast('No se pudo crear la partida', 'error');
      e.target.disabled = false;
    }
  };
  app.querySelector('[data-local]').onclick = () => navigate('/local?tc=' + encodeURIComponent(tc));

  app.querySelector('.join-form').onsubmit = (e) => {
    e.preventDefault();
    const val = e.target.querySelector('input').value.trim();
    const m = val.match(/([a-z0-9]{6,16})\/?$/i);
    if (!m) return toast('Código no válido', 'error');
    setName(nameInput.value);
    navigate('/game/' + m[1].toLowerCase());
  };

  // Lobby: se actualiza cada pocos segundos
  let alive = true;
  async function loadLobby() {
    if (!alive) return;
    try {
      const res = await fetch('/api/lobby');
      const data = await res.json();
      renderLobby(data);
    } catch {
      app.querySelector('[data-open]').innerHTML = '<div class="lobby-empty">No se pudo cargar la lista</div>';
    }
  }
  function tcLabel(t) {
    return t.initial ? `${t.initial / 60} | ${t.increment}` : '∞';
  }
  function renderLobby({ open, live }) {
    const me = getName();
    const openEl = app.querySelector('[data-open]');
    const liveEl = app.querySelector('[data-live]');
    if (!openEl) return;
    app.querySelector('[data-open-count]').textContent = open.length || '';
    app.querySelector('[data-live-count]').textContent = live.length || '';
    openEl.innerHTML = open.length
      ? open
          .map((g) => {
            const host = g.white || g.black;
            const hostColor = g.white ? 'w' : 'b';
            return `<a class="lobby-row" href="/game/${g.id}" data-link>
              <span class="lr-player">${avatarHtml(host, hostColor)}<span>${esc(host)}${host === me ? ' <small>(tú)</small>' : ''}</span></span>
              <span class="lr-tc">${tcLabel(g.tc)}</span>
              <span class="btn btn-green btn-sm">Unirse</span></a>`;
          })
          .join('')
      : '<div class="lobby-empty">No hay desafíos. ¡Crea uno y comparte el enlace!</div>';
    liveEl.innerHTML = live.length
      ? live
          .map(
            (g) => `<a class="lobby-row" href="/game/${g.id}" data-link>
              <span class="lr-vs"><i class="dot w"></i>${esc(g.white)} <em>vs</em> <i class="dot b"></i>${esc(g.black)}</span>
              <span class="lr-tc">${tcLabel(g.tc)}</span>
              <span class="btn btn-gray btn-sm">${icon('eye')} Ver</span></a>`,
          )
          .join('')
      : '<div class="lobby-empty">Nadie está jugando ahora mismo.</div>';
  }
  loadLobby();
  const timer = setInterval(loadLobby, 4000);
  cleanup = () => {
    alive = false;
    clearInterval(timer);
  };
}

// ---------- partidas ----------
function showOnlineGame(id) {
  const ctrl = new OnlineController(id);
  cleanup = mountGame(app, ctrl, { gameId: id, navigate });
}

function showLocalGame(tc) {
  const ctrl = new LocalController(tc);
  cleanup = mountGame(app, ctrl, { navigate });
}

// ---------- ajustes ----------
function openSettings() {
  const s = getSettings();
  const modal = document.createElement('div');
  modal.className = 'overlay';
  modal.innerHTML = `
    <div class="settings card">
      <div class="settings-head"><h2>${icon('gear')} Ajustes</h2><button class="modal-close" data-close>✕</button></div>
      <label class="field-label">Tu nombre</label>
      <input class="text-input" data-name maxlength="20" value="${esc(getName())}">
      <div class="field-label">Tablero</div>
      <div class="themes">
        ${Object.entries(BOARD_THEMES)
          .map(
            ([k, t]) => `<button class="theme ${k === s.theme ? 'selected' : ''}" data-theme="${k}" title="${t.name}">
              <span style="background:${t.light}"></span><span style="background:${t.dark}"></span><span style="background:${t.dark}"></span><span style="background:${t.light}"></span>
              <em>${t.name}</em></button>`,
          )
          .join('')}
      </div>
      <label class="toggle"><input type="checkbox" data-opt="sound" ${s.sound ? 'checked' : ''}><span></span>Sonidos</label>
      <label class="toggle"><input type="checkbox" data-opt="coords" ${s.coords ? 'checked' : ''}><span></span>Mostrar coordenadas</label>
      <label class="toggle"><input type="checkbox" data-opt="showLegal" ${s.showLegal ? 'checked' : ''}><span></span>Mostrar jugadas legales</label>
      <label class="toggle"><input type="checkbox" data-opt="animation" ${s.animation ? 'checked' : ''}><span></span>Animar piezas</label>
      <button class="btn btn-green btn-block" data-close>Listo</button>
    </div>`;
  document.body.append(modal);
  const close = () => {
    const n = modal.querySelector('[data-name]').value;
    if (n.trim() && n.trim() !== getName()) {
      setName(n);
      renderSidebarUser();
      const my = document.querySelector('[data-myname]');
      if (my) my.textContent = getName();
      const inp = document.querySelector('#name');
      if (inp) inp.value = getName();
    }
    modal.remove();
  };
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) close();
    const th = e.target.closest('[data-theme]');
    if (th) {
      updateSettings({ theme: th.dataset.theme });
      modal.querySelectorAll('[data-theme]').forEach((x) => x.classList.toggle('selected', x === th));
    }
  });
  modal.querySelectorAll('[data-opt]').forEach((cb) => {
    cb.onchange = () => {
      updateSettings({ [cb.dataset.opt]: cb.checked });
      setSoundEnabled(getSettings().sound);
    };
  });
}

function renderSidebarUser() {
  const el = document.querySelector('.sidebar-user');
  if (el) el.innerHTML = `${avatarHtml(getName(), 'w')}<span>${esc(getName())}</span>`;
}

// ---------- arranque ----------
applySettings();
setSoundEnabled(getSettings().sound);
document.querySelector('[data-settings]').onclick = openSettings;
document.querySelectorAll('.sidebar [data-icon]').forEach((el) => (el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon))));
renderSidebarUser();
route();
