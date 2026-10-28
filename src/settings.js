import { cleanSettings } from './gameSettings.js';

// Réglages du jeu choisis dans l'interface admin (voir gameSettings.js), lus au lancement auprès du serveur
// (/api/config) pour tous les joueurs. Le lancement attend au plus LOAD_TIMEOUT ; sans réponse (hors ligne,
// serveur de développement), on reprend les derniers réglages reçus sur cet appareil, sinon les valeurs par défaut.
const LOAD_TIMEOUT = 1500; // ms
const CACHE_KEY = 'ctnrace-settings';

async function loadSettings() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store', signal: AbortSignal.timeout(LOAD_TIMEOUT) });
    if (!response.ok) throw new Error(`Erreur ${response.status}`);
    const data = await response.json();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // stockage indisponible : pas de copie locale
    }
    return data;
  } catch {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY));
    } catch {
      return null;
    }
  }
}

export const settings = cleanSettings(await loadSettings());
