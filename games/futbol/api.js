// API de La Canchita: /api/futbol/… (ver shared/salas.js y lib/futbol.js)
import { futbol } from './lib/futbol.js';

export const handle = (request) => futbol.handle(request);
