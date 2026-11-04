// Función de Vercel del club: cuentas, historial, amigos y chats. El código está en shared/.
import { handle } from '../shared/club-api.js';

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
