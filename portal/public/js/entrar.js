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
  document.querySelectorAll('[data-solo-recuperar]').forEach((e) => e.classList.toggle('hidden', modo !== 'recuperar'));
  $('[data-enviar]').textContent = modo === 'registro' ? 'Crear cuenta' : modo === 'recuperar' ? 'Cambiar la contraseña y entrar' : 'Entrar';
  $('[data-label-clave]').textContent = modo === 'recuperar' ? 'Contraseña nueva' : 'Contraseña';
  $('[data-olvide]').textContent = modo === 'recuperar' ? 'Volver a entrar con mi contraseña' : '¿Te olvidaste la contraseña?';
  $('#clave').autocomplete = modo === 'entrar' ? 'current-password' : 'new-password';
  $('[data-error]').textContent = '';
}
$('[data-olvide]').onclick = () => {
  modo = modo === 'recuperar' ? 'entrar' : 'recuperar';
  pintar();
  (modo === 'recuperar' ? $('#usuario').value ? $('#codigo') : $('#usuario') : $('#clave')).focus();
};
document.querySelectorAll('[data-modo]').forEach((b) => (b.onclick = () => ((modo = b.dataset.modo), pintar())));
pintar();

yo().then((u) => u && location.replace(volver));

$('[data-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const boton = $('[data-enviar]');
  const datos = { usuario: $('#usuario').value.trim(), clave: $('#clave').value, nombre: $('#nombre').value.trim(), codigo: $('#codigo').value.trim() };
  if (modo === 'recuperar' && !datos.codigo) return ($('[data-error]').textContent = 'Poné tu código de recuperación.');
  if (datos.usuario.length < 3) return ($('[data-error]').textContent = 'Poné tu usuario.');
  if (datos.clave.length < 6) return ($('[data-error]').textContent = 'La contraseña tiene al menos 6 caracteres.');
  boton.disabled = true;
  try {
    const { usuario } = await api(modo === 'registro' ? '/api/club/registro' : modo === 'recuperar' ? '/api/club/recuperar' : '/api/club/entrar', datos);
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
