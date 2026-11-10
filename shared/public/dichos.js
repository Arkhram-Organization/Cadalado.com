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
  olcho: {
    saludo: ['Hola, soy la rata. Jaja.', 'Shana Tova Umeka.', 'Llegó la rata. La ratatata.'],
    gana: ['¡La rata gana! Shimyz.', 'Esto se lo dedico a Trosman.', 'Shana Tova Umeka, perdedores.'],
    pierde: ['La rata se escabulle y vuelve.', 'Javila…', 'Seguro fue culpa de Trosman.'],
    turno: ['Shimyz.', 'Le toca a la rata.', 'Javila, javila.'],
  },
  sandra: {
    saludo: ['Hola. Desde el caso Bernstein no volví a ser la misma.', '¡Shaná Tová a todos!', 'Llegué. ¿Alguien quiere hablar del caso Bernstein?'],
    gana: ['¡Gané! Esto no pasaba desde antes del caso Bernstein.', 'Mazal tov para mí.', 'Esto lo festejo como en Janucá: ocho días.'],
    pierde: ['Perder no es nada. Lo del caso Bernstein, eso sí fue perder.', 'Ya me pasó algo peor. El caso Bernstein.', 'El próximo año en Jerusalén… y ganando.'],
    turno: ['Me toca. Como en el caso Bernstein: me tocó.', 'Vamos, que se viene Pésaj.', 'Pensando… como en Iom Kipur, con calma.'],
  },
  franba: {
    saludo: ['Llegué. Esto me recuerda al ciber.', 'Buenas. Y no, no me estoy quedando pelado.', '¡Vamos el Rojo!'],
    gana: ['¡Como en el ciber! Te gané sin mirar.', 'Esto va para Gabito. Te quiero, profe.', 'Ganamos. Ahora que entre el pibe Parmo.'],
    pierde: ['La culpa es de Montiel, como siempre.', 'Perdí porque me distraje revisándome el pelo. Que está todo bien, eh.', 'En el ciber no me pasaba esto.'],
    turno: ['Me toca. Que entre el pibe Parmo.', 'Pensando… como en el examen de Gabito.', 'Media hora más y me voy, como en el ciber.'],
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
  angeles: {
    saludo: ['Llegué haciendo un chassé.', 'Hola, gente. Vengo del ensayo y del laburo, en ese orden.'],
    gana: ['¡Pirueta de la victoria!', 'Gané en O(1).', 'Esto salió más limpio que mi código.'],
    pierde: ['Fue un bug de la coreografía.', 'Me faltó un ensayo. Y un try/catch.', 'Perdí, pero con estilo.'],
    turno: ['Cinco, seis, siete, ocho…', 'Déjenme debuggear la jugada.'],
  },
  angie: {
    saludo: ['Hola, ¿vino Nacho?', 'Llegué. Me trajo Chicha.'],
    gana: ['¡Se lo dedico a Nacho!', '¡Chicha, mirá! ¡Gané!', 'Lo festejo con sushi. Bueno, con wok de pollo.'],
    pierde: ['Por suerte Nacho no estaba mirando.', 'Chicha, consolame.', 'Perdí pensando en Nacho.'],
    turno: ['¿Me toca? Estaba escribiéndole a Nacho.', 'Pará que le pregunto a Chicha.'],
  },
  elidiprimio: {
    saludo: ['¿Qué hacés, wop? ¿Qué hacen, manga de wops?', 'WOOOOOOOOOPP', 'Llegó el wop. Dale MXD.'],
    gana: ['WOOOOOOOOOOOP', '¡Dale MXD, dale dale MXD!', 'Ganamos, wop. Ahora bajen a desayunar.'],
    pierde: ['Tranqui, wop. Vamos que se van los micros.', 'Perdimos, wops. Igual MXD.', 'WOOOP… bueno, no tanto.'],
    turno: ['Dale wop, que se van los micros.', '¡Bajen a desayunar!', 'Dale MXD dale dale MXD.'],
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
