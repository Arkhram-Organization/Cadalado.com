// Seguir a tu lobby desde cualquier página: si el líder entra a una sala (aunque la arme desde
// adentro del juego), los demás de su lobby van solos a la misma sala. Lo carga cada juego y el portal.
// /royale/sala/ABC → /royale/?sala=ABC: esa dirección siempre la sirve el hosting (el juego acomoda la URL solo)
import { pedirClub, clubEnVivo, alCambiarLobby } from './club-vivo.js';
const aIndice = (url) => String(url).replace(/^\/([a-z]{3,12})\/(sala|mesa)\/([A-Za-z0-9-]{3,24})\/?$/, '/$1/?$2=$3');
const PID = 'cadalado.pid';
const VISTO = 'cadalado.grupo.ir';
const enSala = () => /^\/[a-z]{3,12}\/(sala|mesa|game)\/[A-Za-z0-9-]{3,24}\/?$/.test(location.pathname) ? location.pathname.replace(/\/$/, '') : null;
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

export function seguirGrupo() {
  if (location.pathname === '/' || window.__grupoLobby || window.__siguiendoGrupo) return; // la portada ya lo hace
  window.__siguiendoGrupo = true;
  const pid = leer(PID);
  if (!pid) return;
  let look = null;
  try { look = JSON.parse(leer('cadalado.look')); } catch {}
  const nombre = leer('cadalado.nombre') || 'Invitado';
  const q = `pid=${encodeURIComponent(pid)}&nombre=${encodeURIComponent(nombre)}${look ? '&look=' + encodeURIComponent(JSON.stringify(look)) : ''}`;
  // solo hace falta mirar seguido si estás con alguien en la lobby (solo, cada 20 s alcanza para enterarte)
  let enGrupo = false, ultima = 0;
  async function mirar() {
    if (document.hidden) return;
    if (Date.now() - ultima < (clubEnVivo() ? 20000 : enGrupo ? 4000 : 20000)) return;
    ultima = Date.now();
    try {
      const { grupo, now } = await pedirClub('/api/club/grupo', { q: Object.fromEntries(new URLSearchParams(q)) });
      enGrupo = !!grupo && grupo.miembros.length >= 2;
      // para el menú de pausa (Cambiar de juego con la lobby)
      window.__lobby = grupo ? { miembros: grupo.miembros.length, soyLider: grupo.soyLider, juego: grupo.juego, config: grupo.config || {}, lider: grupo.miembros.find((m) => m.lider)?.nombre || '' } : null;
      if (!enGrupo) return;
      const aca = enSala();
      if (grupo.soyLider) {
        // el líder entró a una sala: avisarle a la lobby
        if (aca && grupo.ir?.url !== aca) {
          await pedirClub('/api/club/grupo', { b: { pid, nombre, accion: 'jugar', url: aca } });
        }
        return;
      }
      const ir = grupo.ir;
      const visto = Number(sessionStorage.getItem(VISTO)) || 0;
      if (ir && ir.ts > visto && (now || Date.now()) - ir.ts < 60000 && ir.url !== aca) {
        const sala = ir.url.match(/^\/([a-z]{3,12})\/(?:sala|mesa|game)\/([A-Za-z0-9-]{3,24})$/);
        if (sala) {
          let lista = false;
          for (let i = 0; i < 5 && !lista; i++) {
            try { lista = (await fetch((sala[1] === 'ajedrez' ? `/ajedrez/api/games/${sala[2]}` : sala[1] === 'truco' ? `/api/truco/rooms/${sala[2]}` : `/api/${sala[1]}/salas/${sala[2]}`) + `?pid=${encodeURIComponent(pid)}`, { cache: 'no-store' })).ok; } catch {}
            if (!lista) await new Promise(resolve => setTimeout(resolve, 500));
          }
          if (!lista) return; // se vuelve a intentar en la próxima consulta
        }
        sessionStorage.setItem(VISTO, String(ir.ts));
        const lider = grupo.miembros.find((m) => m.lider)?.nombre || 'Tu lobby';
        const aviso = document.createElement('div');
        aviso.textContent = `${lider} armó una partida: te llevamos…`;
        aviso.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:9999;background:#1d211b;color:#efede4;border:1px solid #c5f04a;border-radius:10px;padding:12px 16px;font:600 14px Barlow,Arial,sans-serif;box-shadow:0 12px 30px #000a';
        document.body.append(aviso);
        setTimeout(() => (location.href = aIndice(ir.url)), 900);
      } else if (ir) sessionStorage.setItem(VISTO, String(Math.max(visto, ir.ts)));
    } catch {}
  }
  mirar();
  setInterval(mirar, 1000);
  // en vivo, el club avisa cuando la lobby cambia (por ejemplo, el líder armó una partida)
  alCambiarLobby(() => { ultima = 0; mirar(); });
}
