// API del haxball: /api/haxball/… (ver shared/salas.js y lib/haxball.js)
import { haxball } from './lib/haxball.js';

export const handle = (request) => haxball.handle(request);
