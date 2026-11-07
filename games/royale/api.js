// API del battle royale: /api/royale/… (ver shared/salas.js y lib/royale.js)
import { royale } from './lib/royale.js';

export const handle = (request) => royale.handle(request);
