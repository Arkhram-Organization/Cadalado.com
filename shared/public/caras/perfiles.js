// Personajes del elenco hechos a partir de sus modelos de Meshy: cara y torso salen de las capturas
// (ver datos.js); el resto del cuerpo se arma con estas medidas y colores (muestreados de las mismas capturas).
import { DATOS } from './datos.js';

const CUERPOS = {
  mati: {
    cinto: .78, hombros: .215, cintura: .175, prenda: '#18181b', mangas: 'corta', cuello: 'chomba',
    pantalon: '#17171a', zapatos: '#121212', reloj: '#0e0e10', celular: true, pose: 'celular',
  },
  glinsky: { prenda: '#a2cbf2', mangas: 'corta', puno: '#a2cbf2', pantalon: '#7a695d', cinturon: '#764e37', zapatos: '#8d532e' },
  julo: { brazo: .085, prenda: '#141516', mangas: 'corta', puno: '#141516', pantalon: '#6b6e73', cinturon: '#7a4b2c', zapatos: '#7a4422', botas: true },
  dobro: { prenda: '#1b1a1a', mangas: 'larga', puno: '#f2efe9', pantalon: '#1b1a1a', cinturon: '#8a5a35', zapatos: '#8f5531' },
  faur: { prenda: '#535256', mangas: 'larga', puno: '#a9cdef', pantalon: '#7b665b', cinturon: '#6e4a33', zapatos: '#6a3c26', kipa: '#111113', kipaGrande: true },
};

export const PERFILES = Object.fromEntries(
  Object.entries(CUERPOS).map(([id, c]) => [id, { id, ...DATOS[id], ...c, cabezaUrl: new URL(`./${id}-cabeza.webp`, import.meta.url).href, torsoUrl: DATOS[id].torso ? new URL(`./${id}-torso.webp`, import.meta.url).href : null }])
);
