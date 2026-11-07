// API de la carrera: /api/carrera/… (ver shared/salas.js y lib/carrera.js)
import { carrera } from './lib/carrera.js';

export const handle = (request) => carrera.handle(request);
