import { iniciarPagina, api, yo } from './comun.js';

iniciarPagina();
const $ = (s) => document.querySelector(s);
const volver = (() => {
  const v = new URLSearchParams(location.search).get('volver') || '/club';
  return v.startsWith('/') && !v.startsWith('//') ? v : '/club';
})();
let modo = location.hash === '#crear' ? 'registro' : 'entrar';

function pintar() {
  document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.modo === modo)));
  document.querySelectorAll('[data-solo-registro]').forEach((e) => e.classList.toggle('hidden', modo !== 'registro'));
  $('[data-enviar]').textContent = modo === 'registro' ? 'Crear cuenta' : 'Entrar';
  $('#clave').autocomplete = modo === 'registro' ? 'new-password' : 'current-password';
  $('[data-error]').textContent = '';
}
document.querySelectorAll('[data-modo]').forEach((b) => (b.onclick = () => ((modo = b.dataset.modo), pintar())));
pintar();

yo().then((u) => u && location.replace(volver));

$('[data-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const boton = $('[data-enviar]');
  const datos = { usuario: $('#usuario').value.trim(), clave: $('#clave').value, nombre: $('#nombre').value.trim() };
  if (datos.usuario.length < 3) return ($('[data-error]').textContent = 'Poné tu usuario.');
  if (datos.clave.length < 6) return ($('[data-error]').textContent = 'La contraseña tiene al menos 6 caracteres.');
  boton.disabled = true;
  try {
    const { usuario } = await api(modo === 'registro' ? '/api/club/registro' : '/api/club/entrar', datos);
    // los juegos usan el nombre guardado: que coincida con el de la cuenta
    try {
      localStorage.setItem('chessort.name', usuario.nombre);
      localStorage.setItem('truco-name', usuario.nombre);
    } catch {}
    location.replace(volver);
  } catch (err) {
    $('[data-error]').textContent = err.message;
    boton.disabled = false;
  }
});
