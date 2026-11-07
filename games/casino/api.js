// API del casino: /api/casino/… (ver shared/salas.js y lib/casino.js)
import { casino } from './lib/casino.js';

export const handle = (request) => casino.handle(request);
