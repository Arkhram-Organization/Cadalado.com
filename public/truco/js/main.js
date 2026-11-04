import { TableScene, preloadCards } from './scene.js';
import { SENAS, drawCharacter, lookFor } from './characters.js';
import { cardName, team, ENVIDO_NAMES } from './engine.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get(k, d) {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

function myPid() {
  let p = store.get('truco-pid');
  if (!p || !/^[A-Za-z0-9_-]{8,64}$/.test(p)) {
    p = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()).replace(/-/g, '');
    store.set('truco-pid', p);
  }
  return p;
}
function myName() {
  const v = $('#name').value.trim();
  if (v) store.set('truco-name', v);
  return v || store.get('truco-name') || 'Invitado';
}

async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de conexión');
  return data;
}

// ======================================================== sonido y voz
let actx = null;
function audio() {
  if (!actx) {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  }
  return actx;
}
function flick(vol = 0.25, dur = 0.07) {
  const a = audio();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}
function ding() {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.value = 880;
  g.gain.setValueAtTime(0.12, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.35);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.4);
}
let voiceOn = store.get('truco-voice', '1') === '1';
function say(text) {
  if (!voiceOn || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find((v) => v.lang === 'es-AR') || voices.find((v) => v.lang?.startsWith('es')) || null;
    u.lang = u.voice?.lang || 'es-AR';
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch {}
}

// ======================================================== menú
const menuEl = $('#menu');
const gameEl = $('#game');
let lobbyTimer = null;

function initMenu() {
  $('#name').value = store.get('truco-name', '');
  for (const seg of document.querySelectorAll('.seg')) {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    });
  }
  const segVal = (name) => $(`.seg[data-name="${name}"] .on`)?.dataset.v;

  $('#quick').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      const r = await api('/api/truco/quick', { pid: myPid(), name: myName(), mode: b.dataset.mode });
      go(r.code);
    } catch (err) {
      alert(err.message);
    }
  });

  const create = async (practice) => {
    try {
      const r = await api('/api/truco/rooms', {
        pid: myPid(),
        name: myName(),
        mode: segVal('mode'),
        target: Number(segVal('target')),
        isPublic: !practice && segVal('isPublic') === '1',
        ayudas: $('#ayudas').checked,
      });
      if (practice) sessionStorage.setItem('truco-autostart', r.code);
      go(r.code);
    } catch (err) {
      alert(err.message);
    }
  };
  $('#create-form').addEventListener('submit', (e) => {
    e.preventDefault();
    create(false);
  });
  $('#practice').addEventListener('click', () => create(true));

  $('#join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('#join-code').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) return alert('El código tiene 5 letras o números');
    const info = await api('/api/truco/rooms/' + code).catch(() => ({ exists: false }));
    if (!info.exists) return alert('No existe una sala con ese código');
    myName();
    go(code);
  });
  $('#refresh').addEventListener('click', loadPublic);
  $('#public-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-code]');
    if (!b) return;
    myName();
    if (b.dataset.spectate) sessionStorage.setItem('truco-spectate', b.dataset.code);
    go(b.dataset.code);
  });
}

async function loadPublic() {
  const el = $('#public-list');
  try {
    const { open, live } = await api('/api/truco/lobby');
    const card = (r, isLive) => `
      <div class="room">
        <div class="top"><span class="mode">${esc(r.mode.replace('v', ' vs '))}</span><span class="muted">${r.target} pts · ${isLive ? 'jugando' : `${r.free} lugar${r.free === 1 ? '' : 'es'}`}</span></div>
        <div class="players">${esc(r.players.filter(Boolean).join(', ') || '—')}</div>
        ${isLive && r.score ? `<div class="muted">Van ${r.score[0]} a ${r.score[1]}</div>` : ''}
        <button class="btn ${isLive ? '' : 'primary'} small" data-code="${esc(r.code)}" ${isLive ? 'data-spectate="1"' : ''}>${isLive ? 'Mirar' : 'Sentarme'}</button>
      </div>`;
    const html = open.map((r) => card(r, false)).join('') + live.map((r) => card(r, true)).join('');
    el.innerHTML = html || '<p class="hint">No hay mesas públicas ahora. ¡Abrí una con “Partida rápida”!</p>';
  } catch {
    el.innerHTML = '<p class="hint">No se pudo cargar la lista.</p>';
  }
}

function showMenu() {
  room?.close();
  room = null;
  gameEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
  document.title = 'Truco · Cada Lado';
  loadPublic();
  clearInterval(lobbyTimer);
  lobbyTimer = setInterval(loadPublic, 7000);
}

function go(code) {
  history.pushState({}, '', '/truco/sala/' + code);
  route();
}

function route() {
  const m = location.pathname.match(/^\/truco\/sala\/([A-Za-z0-9]{5})/);
  if (m) openRoom(m[1].toUpperCase());
  else showMenu();
}

// ======================================================== partida
let scene = null;
let room = null;

function openRoom(code) {
  clearInterval(lobbyTimer);
  menuEl.classList.add('hidden');
  gameEl.classList.remove('hidden');
  if (!scene) {
    scene = new TableScene($('#stage'));
    window.__truco = { scene, get room() { return room; } };
    preloadCards();
    bindGameUI();
  }
  scene.resize();
  room?.close();
  room = new RoomClient(code);
}

class RoomClient {
  constructor(code) {
    this.code = code;
    this.closed = false;
    this.st = null;
    this.lastEv = null;
    this.selected = null;
    this.gaze = {};
    this.labels = new Map();
    this.unread = false;
    this.spectate = sessionStorage.getItem('truco-spectate') === code;
    sessionStorage.removeItem('truco-spectate');
    this.autostart = sessionStorage.getItem('truco-autostart') === code;
    sessionStorage.removeItem('truco-autostart');
    $('#room-code').textContent = code;
    $('#chat-log').innerHTML = '';
    $('#labels').innerHTML = '';
    document.title = `Truco · Sala ${code}`;
    scene.onLook = (t) => this.sendLook(t);
    scene.onCardClick = (id) => this.clickCard(id);
    scene.onCardDouble = (id) => this.playCard(id, 'normal');
    scene.onFrame = () => this.updateLabels();
    this.connect();
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/api/truco/rooms/${this.code}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.send({ t: 'join', pid: myPid(), name: store.get('truco-name') || 'Invitado', spectate: this.spectate });
      this.retry = 0;
    };
    ws.onmessage = (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      this.onMessage(m);
    };
    ws.onclose = () => {
      if (this.closed) return;
      this.toast('Se cortó la conexión. Reconectando…', 'bad');
      setTimeout(() => !this.closed && this.connect(), Math.min(5000, 800 * ++this.retry));
    };
    clearInterval(this.pinger);
    this.pinger = setInterval(() => this.send({ t: 'ping' }), 25000);
  }

  close() {
    this.closed = true;
    clearInterval(this.pinger);
    try {
      this.ws?.close();
    } catch {}
    $('#waiting').classList.add('hidden');
    $('#result').classList.add('hidden');
  }

  send(obj) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  act(a) {
    audio();
    this.send({ t: 'act', a });
  }

  // ---------------------------------------------------- mensajes
  onMessage(m) {
    switch (m.t) {
      case 'state':
        return this.onState(m);
      case 'notfound':
        alert('Esa sala no existe o ya cerró.');
        history.pushState({}, '', '/truco/');
        return route();
      case 'error':
        return this.toast(m.msg, 'bad');
      case 'chat-history':
        $('#chat-log').innerHTML = '';
        m.messages.forEach((x) => this.addChat(x, false));
        return;
      case 'chat':
        this.addChat(m.msg, true);
        return;
      case 'gaze-all':
        for (const [s, t] of Object.entries(m.gaze)) this.setGaze(Number(s), t);
        return;
      case 'gaze':
        return this.setGaze(m.seat, m.target);
      case 'sena':
        return this.onSena(m);
    }
  }

  setGaze(seat, target) {
    this.gaze[seat] = target;
    scene.setGaze(seat, target);
  }

  onSena(m) {
    const s = SENAS[m.sena];
    if (!s) return;
    // Sin carteles: la seña solo se ve en la cara del que la hace (si lo estabas mirando).
    if (m.self) return;
    scene.showSena(m.seat, m.sena);
  }

  nameOf(seat, rel = false) {
    const p = this.st?.room.seats[seat];
    const n = p?.name || `Jugador ${seat + 1}`;
    if (!rel || this.you == null) return n;
    return `${n} (${team(seat) === team(this.you) ? 'compañero' : 'rival'})`;
  }

  onState(st) {
    const first = !this.st;
    const prev = this.st;
    this.st = st;
    this.you = st.you;
    const seats = st.room.seats;
    const g = st.game;
    const spectator = st.you == null;
    scene.setLayout({ n: seats.length, me: st.you ?? 0, spectator });
    const layoutKey = `${seats.length}:${st.you}`;
    if (layoutKey !== this.layoutKey) {
      this.layoutKey = layoutKey;
      this.labels.clear();
      $('#labels').innerHTML = '';
      for (const [s, t] of Object.entries(this.gaze)) scene.setGaze(Number(s), t);
    }
    scene.setPlayers(seats, g?.h?.handCounts);

    if (g?.h) {
      scene.setDealer(g.dealer);
      if (this.selected && !g.h.myCards.includes(this.selected)) this.selected = null;
      if (!g.actions.play) this.selected = null;
      scene.setMyCards(g.h.myCards, this.selected);
      scene.syncTable(g.h.table, { animate: !first });
      // eventos nuevos
      const evs = g.ev || [];
      if (this.lastEv === null || first) this.lastEv = evs.length ? evs[evs.length - 1].id : 0;
      else {
        for (const e of evs) if (e.id > this.lastEv) this.onEvent(e, g);
        if (evs.length) this.lastEv = Math.max(this.lastEv, evs[evs.length - 1].id);
      }
      const myTurn = g.waiting.seats.includes(st.you) && g.h.phase === 'play';
      if (myTurn && !(prev?.game?.waiting.seats.includes(st.you) && prev.game.h?.phase === 'play')) ding();
    } else {
      scene.setMyCards([], null);
      scene.syncTable([], { animate: false });
      this.lastEv = null;
    }

    // arranque automático en modo práctica
    if (this.autostart && st.isHost && st.room.status === 'lobby') {
      this.autostart = false;
      this.send({ t: 'start', fillBots: true });
    }
    this.render();
  }

  onEvent(e, g) {
    const me = this.you;
    const mine = e.seat === me;
    switch (e.type) {
      case 'call': {
        const txt = `¡${e.text}!`;
        this.bubble(e.seat, txt, 'call', 2600);
        say(e.text);
        break;
      }
      case 'tanto': {
        const txt = e.value == null ? 'Son buenas' : `${e.value}`;
        this.bubble(e.seat, txt, 'call', 2600);
        say(e.value == null ? 'Son buenas' : `${e.value}`);
        break;
      }
      case 'mazo':
        this.bubble(e.seat, 'Me voy al mazo', '', 2400);
        flick(0.15, 0.2);
        break;
      case 'play':
        flick();
        break;
      case 'round':
        if (g.ayudas) {
          const t = e.result === 'parda' ? 'Parda' : `${e.result === team(me ?? 0) ? 'Ganamos' : 'Perdimos'} la ronda ${e.round + 1}`;
          this.toast(t, '');
        }
        break;
      case 'denuncia':
        this.bubble(e.seat, '¡Trampa!', 'call', 2200);
        say('¡Trampa!');
        if (e.ok) this.toast(`¡Era trampa! ${esc(this.nameOf(e.target))} había encimado una carta. Pierde la mano.`, 'good');
        else this.toast(`Denuncia falsa de ${esc(this.nameOf(e.seat))}: un punto para el otro equipo.`, 'bad');
        break;
      case 'hand-end': {
        const res = g.h.result;
        const who = this.teamLabel(e.team);
        const why = { noquiero: 'no quisieron', mazo: 'se fueron al mazo', trampa: 'por trampa', cartas: '' }[e.reason] || '';
        this.toast(`${who} ${e.team === team(me ?? 0) && me != null ? 'ganamos' : 'ganan'} la mano ${why} (+${e.pts})`, e.team === team(me ?? 0) && me != null ? 'good' : '');
        if (res?.envidoShow) {
          const s = res.envidoShow;
          const imgs = s.cards.map((c) => `<img src="/truco/cards/${c}.webp" alt="${esc(cardName(c))}">`).join('');
          this.toast(`${esc(this.nameOf(s.seat))} muestra sus ${s.value} de envido<br>${imgs}`, '', 5000);
        }
        break;
      }
      case 'deal':
        flick(0.12, 0.25);
        this.selected = null;
        if (e.hand > 1) this.toast(`Mano ${e.hand} · reparte ${esc(this.nameOf(e.seat))}`, '', 1800);
        break;
      case 'points':
        if (e.why === 'envido') this.toast(`Envido: +${e.pts} para ${this.teamLabel(e.team)}`, '', 2500);
        break;
    }
    void mine;
  }

  teamLabel(t) {
    if (this.you != null) return t === team(this.you) ? 'Nosotros' : 'Ellos';
    const seats = this.st.room.seats;
    return seats.filter((_, i) => team(i) === t).map((s) => s?.name).join(' y ');
  }

  // ---------------------------------------------------- cartas
  clickCard(id) {
    const g = this.st?.game;
    if (!g?.actions.play) {
      this.toast('Todavía no es tu turno', '', 1200);
      return;
    }
    this.selected = this.selected === id ? null : id;
    scene.setMyCards(g.h.myCards, this.selected);
    this.render();
  }

  playCard(id, mode) {
    const g = this.st?.game;
    if (!g?.actions.play || !id) return;
    this.selected = null;
    this.act({ t: 'play', card: id, mode });
  }

  sendLook(target) {
    clearTimeout(this.lookT);
    this.lookT = setTimeout(() => this.send({ t: 'look', target: target ?? null }), 90);
    this.renderLookBar();
  }

  // ---------------------------------------------------- etiquetas 3D (nombres y globos)
  labelFor(seat) {
    let l = this.labels.get(seat);
    if (!l) {
      const el = document.createElement('div');
      el.className = 'tag3d';
      el.innerHTML = '<div class="bubbles"></div><div class="nameplate"></div>';
      $('#labels').appendChild(el);
      l = { el, plate: el.querySelector('.nameplate'), bubbles: el.querySelector('.bubbles') };
      this.labels.set(seat, l);
    }
    return l;
  }

  updateLabels() {
    if (!this.st) return;
    const seats = this.st.room.seats;
    seats.forEach((p, seat) => {
      if (seat === this.you) return;
      const l = this.labelFor(seat);
      const pos = scene.screenPos(seat);
      if (!pos || !pos.visible || !p) {
        l.el.style.opacity = '0';
        return;
      }
      l.el.style.opacity = '1';
      l.el.style.left = pos.x + 'px';
      l.el.style.top = pos.y + 'px';
    });
    // mis globos
    const mine = this.labelFor('me');
    mine.el.style.left = '50%';
    mine.el.style.top = '62%';
    mine.plate.style.display = 'none';
  }

  bubble(seat, text, kind = '', ms = 2500) {
    const l = this.labelFor(seat === this.you ? 'me' : seat);
    const b = document.createElement('div');
    b.className = 'bubble ' + kind;
    b.textContent = text;
    l.bubbles.appendChild(b);
    while (l.bubbles.children.length > 2) l.bubbles.firstChild.remove();
    if (seat !== this.you) scene.speak(seat, Math.min(2000, 500 + text.length * 60));
    setTimeout(() => b.remove(), ms);
  }

  // ---------------------------------------------------- chat
  addChat(msg, live) {
    const log = $('#chat-log');
    const div = document.createElement('div');
    if (msg.system) {
      div.className = 'sys';
      div.textContent = msg.text;
    } else {
      const t = msg.seat == null ? '' : `t${team(msg.seat)}`;
      div.innerHTML = `<b class="${t}">${esc(msg.name)}:</b> ${esc(msg.text)}`;
      if (live && msg.seat != null) this.bubble(msg.seat, msg.text, 'chat', 4500);
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    if (live && $('#chat').classList.contains('hidden') && !msg.system) $('#chat-badge').classList.remove('hidden');
  }

  // ---------------------------------------------------- HUD
  render() {
    const st = this.st;
    if (!st) return;
    const g = st.game;
    this.renderScore();
    this.renderStatus();
    this.renderActions();
    this.renderLookBar();
    this.renderPlates();
    this.renderWaiting();
    this.renderResult();
    $('#spect').textContent = st.room.spectators ? `${st.room.spectators} mirando` : '';
    $('#tools').classList.toggle('hidden', this.you == null || !g || st.room.status !== 'playing');
  }

  renderScore() {
    const st = this.st;
    const g = st.game;
    const score = g?.score || [0, 0];
    const target = g?.target || st.room.cfg.target;
    const order = this.you != null ? [team(this.you), 1 - team(this.you)] : [0, 1];
    const names = this.you != null ? ['Nosotros', 'Ellos'] : order.map((t) => (t === 0 ? 'Equipo A' : 'Equipo B'));
    const key = `${score}|${target}|${order}`;
    const el = $('#anotador');
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.innerHTML = `
      <div class="an-head">${order.map((t, i) => `<span class="t${t}">${names[i]}</span>`).join('')}</div>
      <div class="an-body">${order.map((t) => palitos(score[t], target)).join('<i class="an-sep"></i>')}</div>
      <div class="an-foot">${order.map((t) => `<b>${score[t]}</b>`).join('')}<small>a ${target}</small></div>`;
  }

  renderStatus() {
    const el = $('#status-line');
    const g = this.st.game;
    el.classList.remove('mine');
    if (!g || this.st.room.status !== 'playing') return (el.textContent = '');
    const w = g.waiting;
    const me = this.you;
    const mine = w.seats.includes(me);
    const who = (s) => this.nameOf(s);
    let t = '';
    if (w.kind === 'play') t = mine ? 'Te toca jugar' : `Juega ${who(w.seats[0])}`;
    else if (w.kind === 'envido') {
      const calls = g.h.envido.calls.map((c) => ENVIDO_NAMES[c]).join(' + ');
      t = mine ? `Te cantaron ${calls}: ¿querés?` : `${calls}: esperando respuesta`;
    } else if (w.kind === 'truco') {
      const lvl = g.h.truco.pending.level;
      const name = { 2: 'Truco', 3: 'Retruco', 4: 'Vale cuatro' }[lvl];
      t = mine ? `Te cantaron ${name}: ¿querés?` : `${name}: esperando respuesta`;
    } else if (w.kind === 'declare') t = mine ? 'Cantá tus tantos' : `${who(w.seats[0])} canta los tantos`;
    else if (w.kind === 'next-hand') t = 'Fin de la mano';
    if (g.h?.mazo[me]) t = 'Te fuiste al mazo: mirá cómo sigue tu equipo';
    el.textContent = t;
    if (mine) el.classList.add('mine');
  }

  renderActions() {
    const g = this.st.game;
    const box = $('#actions');
    const cardBox = $('#card-actions');
    box.innerHTML = '';
    cardBox.classList.add('hidden');
    if (!g || this.you == null || this.st.room.status !== 'playing') return;
    const a = g.actions;
    const add = (label, cls, fn, title) => {
      const b = document.createElement('button');
      b.className = 'btn ' + cls;
      b.textContent = label;
      if (title) b.title = title;
      b.onclick = fn;
      box.appendChild(b);
    };
    if (a.cantar) add(`Cantar mis tantos (${g.h.myTanto})`, 'call', () => this.act({ t: 'cantar' }));
    if (a.buenas) add('Son buenas', '', () => this.act({ t: 'buenas' }));
    if (a.quiero) add('Quiero', 'good', () => this.act({ t: 'quiero' }));
    if (a.noquiero) add('No quiero', 'danger', () => this.act({ t: 'noquiero' }));
    if (a.truco) add(`¡${a.truco}!`, 'call', () => this.act({ t: 'truco' }));
    for (const k of a.envido) add(ENVIDO_NAMES[k], 'call', () => this.act({ t: 'envido', kind: k }), `Tenés ${g.h.myTanto} de envido`);
    if (a.mazo) add('Irse al mazo', 'small', () => confirm('¿Te vas al mazo?') && this.act({ t: 'mazo' }));

    if (a.play && this.selected) {
      cardBox.classList.remove('hidden');
      cardBox.querySelector('[data-play="stack"]').disabled = !a.canStack;
      cardBox.querySelector('[data-play="down"]').disabled = !a.canDown;
    } else if (a.play && !box.children.length) {
      const hint = document.createElement('span');
      hint.className = 'muted';
      hint.style.textShadow = '0 1px 3px #000';
      hint.textContent = 'Tocá una carta para elegirla (doble clic para tirarla)';
      box.appendChild(hint);
    }

    // denuncias
    const tm = $('#trampa-menu');
    tm.innerHTML = '<div class="tip">Si un rival tiró una carta <b>encimada</b> en esta mano y lo denunciás, pierde la mano. Si te equivocás, le das <b>1 punto</b> al otro equipo.</div>';
    if (!a.denunciar.length) tm.innerHTML += '<div class="tip">Ahora no se puede denunciar.</div>';
    for (const s of a.denunciar) {
      const b = document.createElement('button');
      b.className = 'item';
      b.innerHTML = `<span>Denunciar a <b>${esc(this.nameOf(s))}</b><small>“¡Esa carta está encimada!”</small></span>`;
      b.onclick = () => {
        tm.classList.add('hidden');
        this.act({ t: 'denuncia', target: s });
      };
      tm.appendChild(b);
    }
  }

  renderLookBar() {
    const bar = $('#look-bar');
    if (!this.st || this.you == null || this.st.room.status === 'lobby') return (bar.innerHTML = '');
    const seats = this.st.room.seats;
    const cur = scene.lookTarget;
    let html = '<span class="lbl">Mirar a</span>';
    seats.forEach((p, s) => {
      if (s === this.you || !p) return;
      const rel = team(s) === team(this.you) ? 'Compañero' : 'Rival';
      html += `<button class="btn small ghost ${cur === s ? 'on' : ''}" data-look="${s}"><small>${rel}</small> ${esc(p.name)}</button>`;
    });
    html += `<button class="btn small ghost ${cur === 'table' ? 'on' : ''}" data-look="table">La mesa</button>`;
    if (bar.dataset.html !== html) {
      bar.innerHTML = html;
      bar.dataset.html = html;
    }
  }

  renderPlates() {
    const st = this.st;
    const g = st.game;
    st.room.seats.forEach((p, seat) => {
      if (seat === this.you) return;
      const l = this.labelFor(seat);
      if (!p) {
        l.plate.innerHTML = '';
        return;
      }
      const t = team(seat);
      const chips = [];
      if (g?.h) {
        if (g.dealer === seat) chips.push('reparte');
        if (g.h.mano === seat) chips.push('mano');
        if (g.h.mazo[seat]) chips.push('al mazo');
      }
      const rel = this.you == null ? '' : team(seat) === team(this.you) ? '<span class="chip">compañero</span>' : '';
      const looking = this.gaze[seat] === this.you && this.you != null ? '<span class="chip eye">te mira</span>' : '';
      const turn = g && st.room.status === 'playing' && g.waiting.seats.includes(seat);
      l.plate.className = `nameplate t${t} ${turn ? 'turn' : ''}`;
      l.plate.innerHTML = `${esc(p.name)} ${p.bot ? '<span class="chip">bot</span>' : ''} ${rel} ${looking} ${chips.map((c) => `<span class="chip">${c}</span>`).join('')} ${p.online ? '' : '<span class="off">desconectado</span>'}`;
    });
  }

  renderWaiting() {
    const st = this.st;
    const el = $('#waiting');
    if (st.room.status !== 'lobby') return el.classList.add('hidden');
    el.classList.remove('hidden');
    const r = st.room;
    const host = st.isHost;
    const link = `${location.origin}/truco/sala/${r.code}`;
    const seatHtml = (i) => {
      const p = r.seats[i];
      const me = i === st.you;
      if (!p) {
        return `<div class="seat empty"><span class="nm">Lugar libre</span>
          <button class="btn small" data-sit="${i}">Sentarme</button>
          ${host ? `<button class="btn small" data-bot="${i}">Agregar bot</button>` : ''}</div>`;
      }
      return `<div class="seat ${me ? 'me' : ''}"><span class="nm">${esc(p.name)}${p.bot ? ' <span class="muted">(bot)</span>' : ''}${p.host ? ' <span class="muted">(anfitrión)</span>' : ''}${me ? ' (vos)' : ''}</span>
        ${!p.online ? '<span class="muted">desconectado</span>' : ''}
        ${host && p.bot ? `<button class="btn small" data-unbot="${i}">Sacar</button>` : ''}
        ${host && !p.bot && !me && !p.host ? `<button class="btn small" data-kick="${i}">Echar</button>` : ''}</div>`;
    };
    const cols = [0, 1]
      .map((t) => {
        const idx = r.seats.map((_, i) => i).filter((i) => team(i) === t);
        return `<div class="team-col t${t}"><h3>Equipo ${t === 0 ? 'A' : 'B'}</h3>${idx.map(seatHtml).join('')}</div>`;
      })
      .join('');
    const full = r.seats.every(Boolean);
    const cfg = r.cfg;
    const seg = (name, opts, cur) =>
      `<div class="seg" data-cfg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    el.innerHTML = `<div class="card-box">
      <h2>Sala ${esc(r.code)} · ${esc(cfg.mode.replace('v', ' vs '))}</h2>
      <div class="muted">${cfg.target} puntos · ${cfg.isPublic ? 'pública' : 'privada'}${cfg.ayudas ? ' · con ayudas' : ''}</div>
      <div class="share">
        <span class="big-code">${esc(r.code)}</span>
        <button class="btn small" data-copy="${esc(link)}">Copiar enlace</button>
        <button class="btn small" data-copy="${esc(r.code)}">Copiar código</button>
        <a class="btn small" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('¿Un truquito? Entrá a mi mesa: ' + link)}">WhatsApp</a>
        ${navigator.share ? '<button class="btn small" data-share="1">Compartir…</button>' : ''}
      </div>
      <div class="seats">${cols}</div>
      ${host ? `<div class="field">Modo ${seg('mode', [['1v1', '1 vs 1'], ['2v2', '2 vs 2'], ['3v3', '3 vs 3']], cfg.mode)}</div>
        <div class="field">Puntos ${seg('target', [[30, '30'], [15, '15']], cfg.target)}</div>
        <div class="field">Sala ${seg('isPublic', [[0, 'Privada'], [1, 'Pública']], cfg.isPublic ? 1 : 0)}</div>
        <label class="check"><input type="checkbox" data-ayudas ${cfg.ayudas ? 'checked' : ''}> Mostrar quién gana cada ronda</label>
        <div class="row">
          <button class="btn primary big" data-start="0" ${full ? '' : 'disabled'}>Empezar</button>
          <button class="btn big" data-start="1">Empezar llenando con bots</button>
        </div>` : '<p class="hint">Esperando que el anfitrión empiece la partida…</p>'}
      ${st.you == null ? '<p class="hint">Estás mirando. Tocá “Sentarme” en un lugar libre para jugar.</p>' : ''}
    </div>`;
  }

  renderResult() {
    const st = this.st;
    const el = $('#result');
    const g = st.game;
    if (st.room.status !== 'ended' || !g) return el.classList.add('hidden');
    el.classList.remove('hidden');
    const w = g.winner;
    const won = this.you != null && team(this.you) === w;
    const names = st.room.seats.filter((_, i) => team(i) === w).map((s) => s?.name).join(' y ');
    el.innerHTML = `<div class="card-box">
      <h2>${this.you == null ? '¡Terminó!' : won ? '¡Ganaron!' : 'Perdieron'}</h2>
      <div class="muted">Ganan ${esc(names)}</div>
      <div class="final">${g.score[w]} – ${g.score[1 - w]}</div>
      <div class="row" style="justify-content:center">
        ${this.you != null ? '<button class="btn primary big" data-rematch="1">Revancha</button>' : ''}
        ${st.isHost ? '<button class="btn big" data-tolobby="1">Volver a la sala</button>' : ''}
        <button class="btn big" data-exit="1">Salir</button>
      </div></div>`;
  }

  toast(html, kind = '', ms = 3200) {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = html;
    $('#toast-area').appendChild(t);
    while ($('#toast-area').children.length > 4) $('#toast-area').firstChild.remove();
    setTimeout(() => t.remove(), ms);
  }

  doSena(id) {
    this.send({ t: 'sena', sena: id });
    // espejo: así te ven los que te miran
    const mirror = $('#mirror');
    const look = lookFor(store.get('truco-name') || 'Invitado', this.you);
    const full = document.createElement('canvas');
    full.width = 512;
    full.height = 768;
    drawCharacter(full.getContext('2d'), look, { expr: SENAS[id].expr, gx: 0, gy: 0, cards: 0 });
    const ctx = mirror.getContext('2d');
    ctx.clearRect(0, 0, mirror.width, mirror.height);
    ctx.drawImage(full, 96, 90, 320, 320, 0, 0, mirror.width, mirror.height);
    mirror.classList.remove('hidden');
    clearTimeout(this.mirrorT);
    this.mirrorT = setTimeout(() => mirror.classList.add('hidden'), 1800);
  }
}

// Palitos como en el anotador de verdad: cuatro palitos forman un cuadrado y el quinto lo cruza.
// Los grupos van uno debajo del otro; en partidas a 30 una raya separa las malas de las buenas.
function palitos(pts, target) {
  const groups = Math.ceil(target / 5);
  const gap = 8;
  const size = 22;
  const rule = target === 30 ? 12 : 0;
  const h = groups * (size + gap) + rule;
  let svg = `<svg viewBox="0 0 34 ${h}" width="34" height="${h}" aria-label="${pts} puntos">`;
  // pequeñas variaciones fijas para que parezcan hechos a mano
  const wob = [0.6, -0.8, 0.4, -0.5, 0.7, -0.3];
  for (let gI = 0; gI < groups; gI++) {
    const n = Math.max(0, Math.min(5, pts - gI * 5));
    const y = gI * (size + gap) + (target === 30 && gI >= 3 ? rule : 0) + 4;
    const x = 6;
    const w = wob[gI % wob.length];
    const lines = [
      [x, y + w, x, y + size],
      [x, y, x + size, y - w],
      [x + size, y, x + size + w, y + size],
      [x, y + size, x + size, y + size + w],
      [x + 2, y + size - 2, x + size - 2, y + 2],
    ];
    lines.forEach((l, i) => {
      const on = i < n;
      svg += `<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}" stroke="${on ? '#ece6d8' : 'rgba(236,230,216,0.08)'}" stroke-width="${on ? 2.6 : 1.4}" stroke-linecap="round"/>`;
    });
  }
  if (target === 30) {
    const y = 3 * (size + gap) + rule / 2 - 2;
    svg += `<line x1="0" y1="${y}" x2="34" y2="${y}" stroke="rgba(236,230,216,0.45)" stroke-width="1" stroke-dasharray="3 3"/>`;
  }
  return svg + '</svg>';
}

// ======================================================== eventos de la UI del juego
const QUICK = ['¡Buenas!', 'Jugá, che', 'Uh, qué mano…', 'Las viejas', 'Las perdedoras', '¡Qué suerte tenés!', 'Bien jugado', 'Me voy a la parda', '¿Truco?', 'Uy, se me cayó'];

function bindGameUI() {
  $('#leave').onclick = () => {
    history.pushState({}, '', '/truco/');
    route();
  };
  $('#code-chip').onclick = () => {
    const link = `${location.origin}/truco/sala/${room?.code}`;
    navigator.clipboard?.writeText(link);
    room?.toast('Enlace copiado: ' + esc(link), 'good');
  };
  const vt = $('#voice-toggle');
  const paintVoice = () => (vt.textContent = voiceOn ? 'Voz: sí' : 'Voz: no');
  paintVoice();
  vt.onclick = () => {
    voiceOn = !voiceOn;
    store.set('truco-voice', voiceOn ? '1' : '0');
    paintVoice();
  };
  const zb = $('#zoom-btn');
  const zoomOn = (e) => {
    e.preventDefault();
    scene.zoomHeld = true;
  };
  const zoomOff = () => (scene.zoomHeld = false);
  zb.addEventListener('pointerdown', zoomOn);
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) zb.addEventListener(ev, zoomOff);
  const chat = $('#chat');
  $('#chat-toggle').onclick = () => {
    chat.classList.toggle('hidden');
    $('#chat-badge').classList.add('hidden');
    if (!chat.classList.contains('hidden')) $('#chat-input').focus();
  };
  $('#chat-close').onclick = () => chat.classList.add('hidden');
  $('#chat-form').onsubmit = (e) => {
    e.preventDefault();
    const v = $('#chat-input').value.trim();
    if (!v) return;
    room?.send({ t: 'chat', text: v });
    $('#chat-input').value = '';
  };
  $('#quick-phrases').innerHTML = QUICK.map((q) => `<button type="button">${esc(q)}</button>`).join('');
  $('#quick-phrases').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) room?.send({ t: 'chat', text: b.textContent });
  };

  // carta elegida
  $('#card-actions').onclick = (e) => {
    const b = e.target.closest('button[data-play]');
    if (b && !b.disabled) room?.playCard(room.selected, b.dataset.play);
  };

  // menús desplegables
  const toggleMenu = (id) => {
    const m = $(id);
    const open = m.classList.contains('hidden');
    document.querySelectorAll('.dropdown .menu').forEach((x) => x.classList.add('hidden'));
    if (open) m.classList.remove('hidden');
    return open;
  };
  $('#senas-btn').onclick = (e) => {
    e.stopPropagation();
    if (toggleMenu('#senas-menu')) buildSenasMenu();
  };
  $('#trampa-btn').onclick = (e) => {
    e.stopPropagation();
    toggleMenu('#trampa-menu');
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) document.querySelectorAll('.dropdown .menu').forEach((x) => x.classList.add('hidden'));
  });

  $('#look-bar').onclick = (e) => {
    const b = e.target.closest('[data-look]');
    if (!b) return;
    const v = b.dataset.look;
    scene.lookAtSeat(v === 'table' ? 'table' : Number(v));
  };

  // sala de espera y resultado (delegación)
  $('#waiting').addEventListener('click', (e) => {
    const b = e.target.closest('button, [data-cfg] button');
    if (!b || !room) return;
    const d = b.dataset;
    if (d.sit) room.send({ t: 'sit', seat: Number(d.sit) });
    else if (d.bot) room.send({ t: 'addbot', seat: Number(d.bot) });
    else if (d.unbot) room.send({ t: 'removebot', seat: Number(d.unbot) });
    else if (d.kick) room.send({ t: 'kick', seat: Number(d.kick) });
    else if (d.start) room.send({ t: 'start', fillBots: d.start === '1' });
    else if (d.copy) {
      navigator.clipboard?.writeText(d.copy);
      room.toast('Copiado', 'good', 1200);
    } else if (d.share) navigator.share?.({ title: 'Truco', text: '¿Un truquito?', url: `${location.origin}/truco/sala/${room.code}` }).catch(() => {});
    else if (d.v !== undefined) {
      const name = b.closest('[data-cfg]')?.dataset.cfg;
      if (!name) return;
      const v = name === 'target' ? Number(d.v) : name === 'isPublic' ? d.v === '1' : d.v;
      room.send({ t: 'config', cfg: { [name]: v } });
    }
  });
  $('#waiting').addEventListener('change', (e) => {
    if (e.target.matches('[data-ayudas]')) room?.send({ t: 'config', cfg: { ayudas: e.target.checked } });
  });
  $('#result').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !room) return;
    if (b.dataset.rematch) room.send({ t: 'rematch' });
    if (b.dataset.tolobby) room.send({ t: 'to-lobby' });
    if (b.dataset.exit) $('#leave').click();
  });

  $('#help-btn').onclick = () => {
    const h = $('#help');
    h.innerHTML = helpHtml();
    h.classList.remove('hidden');
  };
  $('#help').onclick = (e) => {
    if (e.target.id === 'help' || e.target.closest('[data-close]')) $('#help').classList.add('hidden');
  };

  // atajos: 1/2/3 eligen carta, Enter la tira, C abre el chat
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || !room?.st?.game) return;
    const g = room.st.game;
    if (['1', '2', '3'].includes(e.key) && g.h?.myCards[Number(e.key) - 1]) room.clickCard(g.h.myCards[Number(e.key) - 1]);
    if (e.key === 'Enter' && room.selected) room.playCard(room.selected, 'normal');
    if (e.key.toLowerCase() === 'c') $('#chat-toggle').click();
  });
}

function buildSenasMenu() {
  const m = $('#senas-menu');
  const tgt = scene.lookTarget;
  let who = 'nadie';
  if (tgt === 'table') who = 'la mesa';
  else if (tgt != null && room?.st) who = room.nameOf(tgt, true);
  const look = lookFor(store.get('truco-name') || 'Invitado', room?.you ?? 0);
  m.innerHTML = `<div class="tip">La seña <b>solo la ven los que te están mirando</b> en ese momento (fijate quién dice “te mira” en los nombres). Ahora estás mirando a: <b>${esc(who)}</b>.</div>`;
  for (const [id, s] of Object.entries(SENAS)) {
    const b = document.createElement('button');
    b.className = 'item';
    const full = document.createElement('canvas');
    full.width = 512;
    full.height = 768;
    drawCharacter(full.getContext('2d'), look, { expr: s.expr, cards: 0 });
    const cv = document.createElement('canvas');
    cv.width = cv.height = 120;
    cv.getContext('2d').drawImage(full, 116, 110, 280, 280, 0, 0, 120, 120);
    const span = document.createElement('span');
    span.innerHTML = `<b>${esc(s.label)}</b><small>${esc(s.desc)}</small>`;
    b.append(cv, span);
    b.onclick = () => {
      m.classList.add('hidden');
      room?.doSena(id);
    };
    m.appendChild(b);
  }
}

function helpHtml() {
  const senas = Object.values(SENAS).map((s) => `<li><b>${esc(s.label)}</b>: ${esc(s.desc)}</li>`).join('');
  return `<div class="card-box">
    <div class="row between"><h2>Cómo se juega</h2><button class="btn small" data-close>✕</button></div>
    <h3>Controles</h3>
    <ul>
      <li>Arrastrá con el mouse o el dedo para mirar a los costados y para abajo (a la mesa). También <kbd>A</kbd>/<kbd>D</kbd> y <kbd>W</kbd>/<kbd>S</kbd>, o los botones de la izquierda.</li>
      <li>Tocá una carta para elegirla y después: <b>Tirar</b>, <b>Tirar encimada</b> (sobre tu carta anterior, para disimular cómo venía la mano) o <b>Tirar tapada</b> (boca abajo, desde segunda; no gana la ronda). Doble clic la tira directo. Atajos: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> y <kbd>Enter</kbd>.</li>
      <li>“te mira” al lado de un nombre quiere decir que esa persona te está mirando. Las señas no avisan nada: hay que verlas en la cara.</li>
      <li>Mantené apretada la <kbd>Z</kbd> (o el botón Zoom) para hacer zoom y ver mejor la mesa o una cara.</li>
    </ul>
    <h3>Señas (las ven solo los que te miran en ese momento)</h3><ul>${senas}<li>De palabra (por el chat, y las escuchan todos): “las viejas” = 27, “las perdedoras” = 29.</li></ul>
    <h3>Puntos</h3>
    <ul>
      <li>Truco 2 (no querido 1) · Retruco 3 (2) · Vale cuatro 4 (3). Sin cantar: 1.</li>
      <li>Envido 2 · Real envido 3 · Falta envido: lo que le falta al que va ganando. No querido: 1, o lo que se había querido antes.</li>
      <li>El envido se canta en primera, antes de tirar tu carta. “El envido está primero”: si te cantan truco, podés cantar envido antes de contestar.</li>
      <li>Irse al mazo en primera sin envido cantado: el rival suma 1 de envido + lo del truco.</li>
      <li>Carta encimada: si un rival la denuncia, perdés la mano. Denuncia falsa: 1 punto para el otro equipo.</li>
    </ul>
  </div>`;
}

// ======================================================== arranque
initMenu();
window.addEventListener('popstate', route);
route();
