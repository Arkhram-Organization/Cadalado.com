// Fondo de los menús de los juegos: el juego queda atrás, quieto (en pausa), y el menú va arriba.
// fondoMenu(menu, { dibujar(canvas) → limpiar?, imagen }) — con `dibujar` se usa el motor del juego;
// si no, la captura del juego con un acercamiento lento.
export function fondoMenu(menu, { dibujar = null, imagen = null, etiqueta = 'En pausa' } = {}) {
  if (!menu) return () => {};
  const fondo = document.createElement('div');
  fondo.className = 'menu-fondo';
  fondo.innerHTML = `${imagen ? `<img src="${imagen}" alt="">` : ''}<span class="menu-pausa"><i></i><i></i>${etiqueta}</span>`;
  menu.classList.add('sobre-juego');
  menu.prepend(fondo);
  let fin = null;
  if (dibujar) {
    const c = document.createElement('canvas');
    fondo.prepend(c);
    try { fin = dibujar(c) || null; } catch (e) { console.warn('fondo del menú', e); }
  }
  return () => { try { fin?.(); } catch {} fondo.remove(); };
}
