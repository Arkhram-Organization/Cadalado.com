// API de Empujón: /api/empujon/… (ver shared/salas.js y lib/empujon.js)
import { empujon } from './lib/empujon.js';

export const handle = (request) => empujon.handle(request);
