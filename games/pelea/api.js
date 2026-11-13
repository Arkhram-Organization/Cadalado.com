// API de Piña Final: /api/pelea/… (ver shared/salas.js y lib/pelea.js)
import { pelea } from './lib/pelea.js';

export const handle = (request) => pelea.handle(request);
