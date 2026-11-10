// Seguir a tu lobby desde cualquier página: si el líder entra a una sala (aunque la arme desde
// adentro del juego), los demás de su lobby van solos a la misma sala. Lo carga cada juego y el portal.
// /royale/sala/ABC → /royale/?sala=ABC: esa dirección siempre la sirve el hosting (el juego acomoda la URL solo)
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
  async function mirar() {
    if (document.hidden) return;
    try {
      const r = await fetch('/api/club/grupo?' + q, { cache: 'no-store' });
      if (!r.ok) return;
      const { grupo } = await r.json();
      if (!grupo || grupo.miembros.length < 2) return;
      const aca = enSala();
      if (grupo.soyLider) {
        // el líder entró a una sala: avisarle a la lobby
        if (aca && grupo.ir?.url !== aca) {
          await fetch('/api/club/grupo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pid, nombre, accion: 'jugar', url: aca }) });
        }
        return;
      }
      const ir = grupo.ir;
      const visto = Number(sessionStorage.getItem(VISTO)) || 0;
      if (ir && ir.ts > visto && ir.url !== aca) {
        const sala = ir.url.match(/^\/([a-z]{3,12})\/(?:sala|mesa|game)\/([A-Za-z0-9-]{3,24})$/);
        if (sala) {
          let lista = false;
          for (let i = 0; i < 5 && !lista; i++) {
            try { lista = (await fetch(`/api/${sala[1]}/salas/${sala[2]}?pid=${encodeURIComponent(pid)}`, { cache: 'no-store' })).ok; } catch {}
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
  setInterval(mirar, 3000);
}
