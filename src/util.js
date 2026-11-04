export function cleanName(name) {
  const s = String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
  return s || 'Invitado';
}

export function cleanPid(pid) {
  const s = String(pid ?? '');
  return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : null;
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export function newGameId(len = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRoomCode(len = 5) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
