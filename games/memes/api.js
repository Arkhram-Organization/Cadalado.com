// API de Make it Meme: /api/memes/… (ver shared/salas.js)
import { memes } from './lib/memes.js';

export const handle = (request) => memes.handle(request);
