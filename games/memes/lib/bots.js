// Bots de Make it Meme: completan las plantillas con frases cortas y absurdas.
// Hay muchas frases y en una sala no se repite ninguna hasta agotar la lista,
// así no se queman los chistes.
import { mezclar, entero } from '../../../shared/salas.js';
import { NPCS } from '../../../shared/public/npcs.js';
import { dicho } from '../../../shared/public/dichos.js';

export const NOMBRES_BOT = ['Lior', 'Polshu', 'Familia Maica', 'Guivi', 'Glinsky', 'Milton Giménez', 'Julo', 'Maica', 'Mafi', 'Simja Tora', 'Faur', 'Dobro', 'Herma'];
export const MAX_BOTS = 8;

// Textos cortos (que entren en el meme). Muchos son chistes internos del grupo.
// Una sola palabra o nombre: queda solo, como título del meme.
const SOLAS = [
  'Dobro', 'Julo', 'Glinsky', 'Estanca', 'Polshu', 'Lior', 'Maica', 'Mati Nadeo', 'Queque',
  'Exponencial', 'Tecnologías exponenciales', 'La tesina', 'Dobro a las 4 AM', 'Julo compilando',
  'Glinsky con Claude', 'Estanca en la previa', 'Polshu llegando', 'Lior con un plan', 'Maica organizando',
  'Mati Nadeo y el Queque', 'Yo con la tesina', 'El kernel', 'Otra mano, Dobro',
];
// Arriba y abajo (se combinan al azar)
const ARRIBA = [
  'Glinsky:', 'Julo:', 'Dobro:', 'Estanca:', 'Polshu:', 'Lior:', 'Maica:', 'Nadie:', 'La IA:', 'Yo:',
  'La tesina', 'Lunes 8 AM', 'El grupo', 'Mati Nadeo', 'Dobro', 'Julo', 'Glinsky', 'Estanca',
];
const ABAJO = [
  'Es exponencial', 'Usen Claude, chicos', 'Una mano más', 'Queque', 'Compilé la heladera',
  'El bit 7 está cansado', 'Hice un deploy', 'La casa siempre gana', 'Esto va al final',
  'Llegué tarde', 'Tengo un plan', 'Ya organicé todo', 'Mañana arranco', 'En 3 años lo hace una IA',
  'Recursioná el firewall', 'Aplausos para Julo', 'Saber parar', 'Exponencial', 'Ni idea',
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
  // tamaño según lo largo del texto (los cortos, grandes)
  const tam = (t) => (t.length <= 8 ? 0.13 : t.length <= 14 ? 0.1 : 0.075);
  const caja = (i, t) => (n === 2 ? { x: 0.05, y: i ? 0.78 : 0.03, w: 0.9, s: tam(t), c: 'blanco', t } : { x: 0.08, y: 0.04 + (i * 0.82) / (n - 1), w: 0.84, s: Math.min(0.08, tam(t)), c: 'blanco', t });
  const r = Math.random();
  if (r < 0.4) {
    const t = sacar(SOLAS, 's');
    return [caja(Math.random() < 0.6 ? n - 1 : 0, t)]; // una sola palabra o nombre
  }
  return [caja(0, sacar(ARRIBA, 'a')), caja(n - 1, sacar(ABAJO, 'b'))];
}

// Nombres para los bots de una sala (sin repetir).
export const nombresBots = (n) => mezclar([...NOMBRES_BOT]).slice(0, n);

// Voto de un bot: variado (no regala la partida). A veces 1, casi nunca siempre 5.
export const votoBot = () => [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 5][entero(12)];

// Lo que dicen los bots en el chat: los que son NPC con su personalidad, el resto con frases cortas.
const COMENTAN = ['Jajaja', 'Exponencial.', 'Flojo.', 'Este es de Julo seguro.', 'Queque.', 'Buenísimo.', 'Le pongo un 3 y gracias.', 'Esto en tres años lo hace una IA.', '¿Quién hizo este?', 'Mmm.'];
const GANAN = ['Gané. Exponencial.', 'Lo sabía.', 'Talento natural.', 'Gracias, gracias.', 'Esto va a la tesina.'];
const PIERDEN = ['Robo.', 'El mío era mejor.', 'Jurado comprado.', 'La próxima la gano.', 'Me faltó Dobro en el meme.'];
const npcDeNombre = (n) => NPCS.find((x) => x.nombre.toLowerCase() === String(n).replace(/\s\d+$/, '').toLowerCase())?.id; // "Dobro 2" también es Dobro
export function reaccionBot(nombre, situacion) {
  const npc = npcDeNombre(nombre);
  if (npc && Math.random() < 0.7) return dicho(npc, situacion === 'comenta' ? 'turno' : situacion);
  const l = situacion === 'gana' ? GANAN : situacion === 'pierde' ? PIERDEN : COMENTAN;
  return l[entero(l.length)];
}
