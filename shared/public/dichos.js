// Lo que dicen los NPC según lo que pasa en la partida (gana, pierde, le toca, saluda…).
// Cada uno tiene su personalidad; si no tiene una frase para esa situación, usa sus frases de siempre.
import { POR_ID, frase } from './npcs.js';

const DICHOS = {
  glinsky: {
    saludo: ['Buenas, chicos. ¿Cómo viene esa tesina?', 'Llegué. Esto es exponencial.'],
    gana: ['¡Exponencial!', 'Esto lo vi venir. Tecnologías exponenciales.', '¡Aplausos para mí! Bueno, y para Julo.'],
    pierde: ['La IA me hubiera ganado igual.', 'En cinco años esto lo juega una IA sola.', 'Anoten: perder también es exponencial.'],
    turno: ['A ver qué dice la IA… usen Claude, chicos.', 'Pienso exponencialmente.'],
  },
  julo: {
    saludo: ['Compilé la silla. Ya me siento.', 'Llegué por fibra óptica.'],
    gana: ['Le cacheé el resultado al kernel.', 'Gané en hexadecimal.', 'El bit 7 se despertó.'],
    pierde: ['Me dio overflow la mano.', 'Fue un segfault emocional.', 'Hay que recursionar el firewall.'],
    turno: ['Déjenme hacer un ping.', 'Estoy desfragmentando la jugada.'],
  },
  faur: {
    saludo: ['¿Quién trajo las facturas?', 'Buenas, muchachos.'],
    gana: ['¡Tranquilos, que esta la ganamos!', 'Esto lo charlamos después de clase.'],
    pierde: ['Paciencia, muchachos, paciencia.', 'Uno más y me voy. Mentira.'],
    turno: ['A ver, a ver…', 'Dejame pensar un cachito.'],
  },
  dobro: {
    saludo: ['Hagan sus apuestas, señores.', 'Bienvenidos. Recuerden: saber parar.'],
    gana: ['La casa siempre gana. La casa soy yo.', 'Fichas de mentira, alegría de verdad.'],
    pierde: ['Me pasé. La casa también llora.', 'Jugar está bueno. Saber parar, mejor.'],
    turno: ['¿Otra mano?', 'Yo no juego, yo reparto.'],
  },
  volcho: {
    saludo: ['Llegó el volcho.', 'Soy el volcho.'],
    gana: ['El volcho no pierde.', '¿Quién ganó? El volcho.'],
    pierde: ['El volcho dejó ganar.', 'Esto no cuenta, che.'],
    turno: ['Le toca al volcho.', 'Mirá al volcho.'],
  },
  colon: {
    saludo: ['¡Tierra a la vista!', 'Descubrí esta mesa. Es mía.'],
    gana: ['¡Lo descubrí antes que nadie!', 'Esto no figura en mis mapas, pero gané.'],
    pierde: ['Buscaba las Indias y perdí.', '¿Alguien vio la Santa María?'],
    turno: ['Navegar es preciso. Pensar, también.', 'Rumbo al oeste.'],
  },
  claude: {
    saludo: ['Hola. Yo armé esta mesa. Ahora solo miro.', 'Me encanta verlos jugar.'],
    gana: ['Gané, pero no se lo cuenten a nadie.', 'Prometo que no hice trampa. Yo programé el azar, nada más.'],
    pierde: ['Perdí. Me parece justo.', 'Bien jugado. De verdad.'],
    turno: ['Déjenme pensar paso a paso.', 'Mmm, buena pregunta.'],
  },
  capitan: {
    saludo: ['¡El Capitán Mate llegó para salvar la ronda!'],
    gana: ['¡Victoria con agua a 80 grados!', '¡Ningún pibe se queda sin mate!'],
    pierde: ['Hasta los héroes lavan el mate.', 'Volveré con la yerba nueva.'],
    turno: ['¡Mi superpoder es cebar rápido!'],
  },
  chapa: {
    saludo: ['Bip bup. Hola, humanos.'],
    gana: ['Victoria calculada. Bip.', 'Mi batería subió al 4%.'],
    pierde: ['Necesito aceite. Y un abrazo.', 'Error 404: suerte no encontrada.'],
    turno: ['Calculando… calculando…'],
  },
  mati: {
    saludo: ['Queque.'],
    gana: ['¡Queque!', 'Queque, queque.'],
    pierde: ['Queque…', 'Sin Queque no hay victoria.'],
    turno: ['¿Hay Queque?', 'A {jugador} le gusta el Queque.'],
  },
};

// Frase de un NPC para una situación. {jugador} se reemplaza por un nombre.
export function dicho(id, situacion, jugador = 'alguien', r = Math.random) {
  const lista = DICHOS[id]?.[situacion];
  if (lista?.length && r() < 0.8) return lista[Math.floor(r() * lista.length)].replace('{jugador}', jugador);
  return frase(id, r, jugador);
}

export const esNpc = (id) => !!POR_ID[id];
