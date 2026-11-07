// Bots de Make it Meme: completan las plantillas con frases cortas y absurdas.
// Hay muchas frases y en una sala no se repite ninguna hasta agotar la lista,
// así no se queman los chistes.
import { mezclar, entero } from '../../../shared/salas.js';

export const NOMBRES_BOT = ['Lior', 'Polshu', 'Familia Maica', 'Guivi', 'Glinsky', 'Milton Giménez', 'Julo', 'Maica', 'Mafi', 'Simja Tora', 'Faur', 'Dobro', 'Herma'];
export const MAX_BOTS = 4;

// Arriba / abajo: se combinan al azar, así salen memes distintos cada vez.
const ARRIBA = [
  'Yo a las 3 AM',
  'Cuando decís "una más y me voy"',
  'Mi plan para el finde',
  'El grupo de WhatsApp de la familia',
  'Cuando el profe dice "esto no entra"',
  'Yo explicándole a mi vieja qué es la nube',
  'Lunes 8 AM',
  'Cuando llega la boleta de la luz',
  'Mi heladera a fin de mes',
  'Yo después de un mate lavado',
  'El colectivo cuando corrés para alcanzarlo',
  'Cuando te dicen "tenemos que hablar"',
  'Mi cerebro en el examen',
  'Cuando el Wi-Fi anda',
  'El asado cuando llegás tarde',
  'Cuando ponés "voy" y estás en la ducha',
  'Mi presupuesto',
  'Yo jurando que hoy me acuesto temprano',
  'La tesina',
  'El que trae hielo',
  'Cuando el delivery dice "a dos cuadras"',
  'Yo leyendo los términos y condiciones',
  'Mi perro cuando abro un paquete',
  'Cuando encontrás plata en la campera',
  'El último pedazo de pizza',
  'Yo programando sin dormir',
  'El aguinaldo',
  'Cuando el audio dura 7 minutos',
  'Cuando te mandan "jaja" sin la J mayúscula',
  'El GPS cuando no hay señal',
];
const ABAJO = [
  'No me arrepiento de nada',
  'Bueno, era eso',
  'Todo bien, todo tranqui',
  'Y sin embargo, acá estamos',
  'Esto es cine',
  'Ni idea, pero con confianza',
  'Error 404: ganas no encontradas',
  'Lo dejo para mañana',
  'Fuente: me lo contó un amigo',
  'Siempre fue así, no sé de qué te sorprendés',
  'Plan perfecto, cero fallas',
  'Spoiler: no salió bien',
  'La previa más larga del mundo',
  'Confíen en el proceso',
  'Esto es exponencial',
  'Lo compilé en la heladera',
  'Queque',
  'Me dijeron que era fácil',
  'Mañana arranco el gimnasio',
  'Nadie:',
  'Y no paró de llover',
  'Tranqui, tengo un primo que sabe',
  'Lo vi en un TikTok',
  'Si sale, sale',
  'Era un martes cualquiera',
  'Con la mejor onda',
  'Necesito vacaciones de mis vacaciones',
  'Igual vamos a ganar',
  'Jamás le fallé a nadie (mentira)',
  'Por algo será',
];
// Frases que van solas (una sola caja o para todas).
const SOLAS = [
  'Cuando la bocha no entra pero la querés igual',
  'Yo armando el equipo ideal y me toca el arquero',
  'Ese momento en que el mate se tapa',
  'Cuando ponés la alarma y te despertás antes',
  'Cuando te decís "último capítulo" y son las 5',
  'Cuando el profe toma lo único que no leíste',
  'Mi cara cuando dicen "es un ratito nomás"',
  'Cuando la playlist es tuya y nadie la banca',
  'Yo cuando me ofrecen una porción más',
  'Cuando el grupo dice "a las 9" y son las 11',
  'Cuando te dan vuelto de más',
  'Ese amigo que siempre dice "yo invito" y nunca invita',
  'Cuando ganás una mano y te sentís experto',
  'Cuando la paloma te mira raro',
  'Mi vida en una imagen',
];

// Arma los textos de un bot para una plantilla con `cajas` lugares.
export function textosBot(cajas, usadas) {
  const sacar = (lista, clave) => {
    const libres = lista.filter((f) => !usadas.includes(`${clave}:${f}`));
    const pool = libres.length ? libres : lista;
    if (!libres.length) for (let i = usadas.length - 1; i >= 0; i--) if (usadas[i].startsWith(clave + ':')) usadas.splice(i, 1);
    const f = pool[entero(pool.length)];
    usadas.push(`${clave}:${f}`);
    return f;
  };
  const n = Math.max(2, Math.min(4, cajas || 2));
  const caja = (i, t) => (n === 2 ? { x: 0.05, y: i ? 0.8 : 0.03, w: 0.9, s: 0.08, c: 'blanco', t } : { x: 0.08, y: 0.04 + (i * 0.82) / (n - 1), w: 0.84, s: 0.06, c: 'blanco', t });
  const r = Math.random();
  if (r < 0.25) return [caja(1, sacar(SOLAS, 's'))]; // a veces una sola frase abajo
  if (n === 2 || r < 0.6) return [caja(0, sacar(ARRIBA, 'a')), caja(n - 1, sacar(ABAJO, 'b'))];
  // varias cajas: arriba, alguna del medio y abajo
  const medio = 1 + entero(n - 2);
  return [caja(0, sacar(ARRIBA, 'a')), caja(medio, sacar(SOLAS, 's')), caja(n - 1, sacar(ABAJO, 'b'))];
}

// Nombres para los bots de una sala (sin repetir).
export const nombresBots = (n) => mezclar([...NOMBRES_BOT]).slice(0, n);

// Voto de un bot: generoso pero no siempre 5.
export const votoBot = () => [2, 3, 3, 4, 4, 4, 5, 5][entero(8)];
