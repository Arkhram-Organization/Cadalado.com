// Tablero interactivo sin dependencias: arrastrar y soltar, clic-clic, puntos de jugadas legales,
// flechas y marcas con clic derecho, selector de coronación y animaciones.

const FILES = 'abcdefgh';
const SVG_NS = 'http://www.w3.org/2000/svg';

export function parseFenBoard(fen) {
  const map = new Map();
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        map.set(FILES[f] + (8 - i), color + ch.toLowerCase());
        f++;
      }
    }
  });
  return map;
}

export class Board {
  constructor(el, opts = {}) {
    this.el = el;
    this.opts = opts; // { getDests(sq) -> [{to, promotion}], onMove(from, to, promotion), settings() }
    this.orientation = 'w';
    this.movable = null; // color que puede mover ahora, o null
    this.position = new Map();
    this.pieceEls = new Map();
    this.lastMove = null;
    this.check = null;
    this.selected = null;
    this.dests = [];
    this.marks = new Set();
    this.arrows = new Set();
    this.drag = null;
    this.rightStart = null;
    this.noAnimTo = null;

    el.classList.add('board');
    el.innerHTML = '';
    this.squaresEl = div('board-squares');
    this.piecesEl = div('board-pieces');
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('class', 'board-arrows');
    this.svg.setAttribute('viewBox', '0 0 800 800');
    this.promoEl = div('board-promo hidden');
    el.append(this.squaresEl, this.piecesEl, this.svg, this.promoEl);
    this.buildSquares();

    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMoveEvt(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', () => this.cancelDrag());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------- coordenadas ----------
  xy(sq) {
    const f = FILES.indexOf(sq[0]);
    const r = Number(sq[1]) - 1;
    return this.orientation === 'w' ? [f, 7 - r] : [7 - f, r];
  }

  sqAt(x, y) {
    const f = this.orientation === 'w' ? x : 7 - x;
    const r = this.orientation === 'w' ? 7 - y : y;
    return FILES[f] + (r + 1);
  }

  eventSquare(e) {
    const rect = this.el.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * 8);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return this.sqAt(x, y);
  }

  // ---------- render ----------
  buildSquares() {
    this.squaresEl.innerHTML = '';
    this.squareEls = new Map();
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const sq = this.sqAt(x, y);
        const f = FILES.indexOf(sq[0]);
        const r = Number(sq[1]) - 1;
        const el = div('sq ' + ((f + r) % 2 === 1 ? 'light' : 'dark'));
        el.dataset.sq = sq;
        if (x === 0) el.append(span('coord rank', sq[1]));
        if (y === 7) el.append(span('coord file', sq[0]));
        this.squaresEl.append(el);
        this.squareEls.set(sq, el);
      }
    }
    this.renderHighlights();
  }

  setOrientation(color) {
    if (color === this.orientation) return;
    this.orientation = color;
    this.buildSquares();
    for (const [sq, el] of this.pieceEls) placeEl(el, this.xy(sq), false);
    this.marks.clear();
    this.arrows.clear();
    this.renderArrows();
    this.closePromo();
  }

  setMovable(color) {
    this.movable = color;
    if (!color && this.selected) this.deselect();
  }

  setPosition(fen, { lastMove = null, check = null, animate = true } = {}) {
    const next = parseFenBoard(fen);
    const anim = animate && this.settings().animation !== false;
    const old = new Map(this.pieceEls);
    const newEls = new Map();
    const pending = [];

    for (const [sq, code] of next) {
      const el = old.get(sq);
      if (el && el.dataset.code === code) {
        newEls.set(sq, el);
        old.delete(sq);
      } else pending.push([sq, code]);
    }
    for (const [sq, code] of pending) {
      let best = null;
      let bestD = Infinity;
      for (const [osq, el] of old) {
        if (el.dataset.code !== code) continue;
        const d = dist(osq, sq);
        if (d < bestD) {
          bestD = d;
          best = osq;
        }
      }
      if (best) {
        const el = old.get(best);
        old.delete(best);
        placeEl(el, this.xy(sq), anim && sq !== this.noAnimTo);
        newEls.set(sq, el);
      } else {
        const el = div('piece');
        el.dataset.code = code;
        el.style.backgroundImage = `url(pieces/${code}.svg)`;
        placeEl(el, this.xy(sq), false);
        this.piecesEl.append(el);
        newEls.set(sq, el);
      }
    }
    for (const el of old.values()) {
      if (anim) {
        el.classList.add('fading');
        setTimeout(() => el.remove(), 160);
      } else el.remove();
    }
    this.noAnimTo = null;
    this.pieceEls = newEls;
    this.position = next;
    this.lastMove = lastMove;
    this.check = check;
    if (this.selected && !(this.position.get(this.selected) || '').startsWith(this.movable || '-')) this.deselect();
    else if (this.selected) this.select(this.selected);
    this.renderHighlights();
  }

  settings() {
    return this.opts.settings ? this.opts.settings() : {};
  }

  renderHighlights() {
    const showHints = this.settings().showLegal !== false;
    const destSet = new Map(this.dests.map((d) => [d.to, d]));
    for (const [sq, el] of this.squareEls) {
      el.classList.toggle('last', !!this.lastMove && (this.lastMove[0] === sq || this.lastMove[1] === sq));
      el.classList.toggle('selected', this.selected === sq);
      el.classList.toggle('check', this.check === sq);
      el.classList.toggle('mark', this.marks.has(sq));
      let hint = el.querySelector('.hint');
      const isDest = showHints && destSet.has(sq);
      if (isDest) {
        if (!hint) {
          hint = div('hint');
          el.append(hint);
        }
        hint.classList.toggle('capture', this.position.has(sq));
      } else if (hint) hint.remove();
    }
  }

  // ---------- selección y jugadas ----------
  canPick(sq) {
    const code = this.position.get(sq);
    return !!code && !!this.movable && code[0] === this.movable;
  }

  select(sq) {
    this.selected = sq;
    this.dests = this.opts.getDests ? this.opts.getDests(sq) : [];
    this.renderHighlights();
  }

  deselect() {
    this.selected = null;
    this.dests = [];
    this.renderHighlights();
  }

  isDest(sq) {
    return this.dests.some((d) => d.to === sq);
  }

  tryMove(from, to, dragged) {
    const options = this.dests.filter((d) => d.to === to);
    if (!options.length) return false;
    this.deselect();
    if (dragged) this.noAnimTo = to;
    if (options.some((d) => d.promotion)) {
      if (dragged) this.dropPieceVisual(from, to);
      this.openPromo(from, to);
    } else {
      this.opts.onMove?.(from, to);
    }
    return true;
  }

  dropPieceVisual(from, to) {
    const el = this.pieceEls.get(from);
    if (el) placeEl(el, this.xy(to), false);
  }

  // ---------- coronación ----------
  openPromo(from, to) {
    const color = this.position.get(from)[0];
    const [x, y] = this.xy(to);
    const fromTop = y === 0;
    this.promoEl.innerHTML = '';
    this.promoEl.classList.remove('hidden');
    this.promoEl.style.left = x * 12.5 + '%';
    this.promoEl.style.top = fromTop ? '0' : 'auto';
    this.promoEl.style.bottom = fromTop ? 'auto' : '0';
    this.promoEl.classList.toggle('from-bottom', !fromTop);
    const pieces = ['q', 'n', 'r', 'b'];
    for (const p of pieces) {
      const b = div('promo-piece');
      b.style.backgroundImage = `url(pieces/${color}${p}.svg)`;
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.closePromo();
        this.opts.onMove?.(from, to, p);
      });
      this.promoEl.append(b);
    }
    const x2 = div('promo-close', '✕');
    x2.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.closePromo();
      const el = this.pieceEls.get(from);
      if (el) placeEl(el, this.xy(from), true);
    });
    this.promoEl.append(x2);
    this.promoPending = { from };
  }

  closePromo() {
    this.promoEl.classList.add('hidden');
    this.promoEl.innerHTML = '';
    this.promoPending = null;
  }

  // ---------- puntero ----------
  onDown(e) {
    if (this.promoPending) return;
    const sq = this.eventSquare(e);
    if (!sq) return;
    if (e.button === 2) {
      this.rightStart = sq;
      return;
    }
    if (e.button !== 0) return;
    if (this.marks.size || this.arrows.size) {
      this.marks.clear();
      this.arrows.clear();
      this.renderArrows();
      this.renderHighlights();
    }
    if (this.selected && this.selected !== sq && this.isDest(sq)) {
      this.tryMove(this.selected, sq, false);
      return;
    }
    if (this.canPick(sq)) {
      const wasSelected = this.selected === sq;
      this.select(sq);
      const el = this.pieceEls.get(sq);
      this.drag = { from: sq, el, wasSelected, moved: false, x0: e.clientX, y0: e.clientY };
      this.el.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else if (this.selected) {
      this.deselect();
    }
  }

  onMoveEvt(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
    d.moved = true;
    const rect = this.el.getBoundingClientRect();
    const size = rect.width / 8;
    d.el.classList.add('dragging');
    d.el.style.transform = `translate(${e.clientX - rect.left - size / 2}px, ${e.clientY - rect.top - size / 2}px)`;
    const sq = this.eventSquare(e);
    if (sq !== this.hoverSq) {
      this.squareEls.get(this.hoverSq)?.classList.remove('hover');
      this.hoverSq = sq;
      if (sq) this.squareEls.get(sq)?.classList.add('hover');
    }
  }

  onUp(e) {
    if (e.button === 2 && this.rightStart) {
      const sq = this.eventSquare(e);
      const from = this.rightStart;
      this.rightStart = null;
      if (!sq) return;
      if (sq === from) toggle(this.marks, sq);
      else toggle(this.arrows, from + sq);
      this.renderArrows();
      this.renderHighlights();
      return;
    }
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.squareEls.get(this.hoverSq)?.classList.remove('hover');
    this.hoverSq = null;
    d.el?.classList.remove('dragging');
    const sq = this.eventSquare(e);
    if (d.moved) {
      if (sq && sq !== d.from && this.tryMove(d.from, sq, true)) return;
      if (d.el) placeEl(d.el, this.xy(d.from), sq !== d.from);
      if (sq !== d.from) this.deselect();
    } else if (d.wasSelected) {
      this.deselect();
    }
  }

  cancelDrag() {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    d.el?.classList.remove('dragging');
    if (d.el) placeEl(d.el, this.xy(d.from), true);
  }

  // ---------- flechas ----------
  renderArrows() {
    this.svg.innerHTML = `<defs><marker id="ah" markerWidth="4" markerHeight="4" refX="2.05" refY="2" orient="auto">
      <path d="M0,0 L4,2 L0,4 z" fill="rgba(255,170,0,.8)"/></marker></defs>`;
    for (const key of this.arrows) {
      const [x1, y1] = this.xy(key.slice(0, 2));
      const [x2, y2] = this.xy(key.slice(2, 4));
      const cx1 = x1 * 100 + 50;
      const cy1 = y1 * 100 + 50;
      const cx2 = x2 * 100 + 50;
      const cy2 = y2 * 100 + 50;
      const len = Math.hypot(cx2 - cx1, cy2 - cy1);
      const shorten = 38;
      const ex = cx2 - ((cx2 - cx1) / len) * shorten;
      const ey = cy2 - ((cy2 - cy1) / len) * shorten;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', cx1);
      line.setAttribute('y1', cy1);
      line.setAttribute('x2', ex);
      line.setAttribute('y2', ey);
      line.setAttribute('stroke', 'rgba(255,170,0,.8)');
      line.setAttribute('stroke-width', '18');
      line.setAttribute('marker-end', 'url(#ah)');
      this.svg.append(line);
    }
  }
}

function placeEl(el, [x, y], animate) {
  el.classList.toggle('no-anim', !animate);
  el.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
  if (!animate) {
    void el.offsetWidth;
    requestAnimationFrame(() => el.classList.remove('no-anim'));
  }
}

function dist(a, b) {
  return Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) + Math.abs(a.charCodeAt(1) - b.charCodeAt(1));
}

function toggle(set, v) {
  if (set.has(v)) set.delete(v);
  else set.add(v);
}

function div(cls, text) {
  const el = document.createElement('div');
  el.className = cls;
  if (text) el.textContent = text;
  return el;
}

function span(cls, text) {
  const el = document.createElement('span');
  el.className = cls;
  el.textContent = text;
  return el;
}
