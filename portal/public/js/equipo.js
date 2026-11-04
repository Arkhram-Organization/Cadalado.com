import { EQUIPO } from './datos.js';
import { iniciarPagina, personas, revelar } from './comun.js';

iniciarPagina();
document.querySelector('[data-equipo]').innerHTML = personas(EQUIPO);
revelar();
