import { SAVE_KEYS, requestSave } from './saveQueue.js';
import { settings } from './settings.js';
import { MISSION_COUNT, baseMission, DEFAULT_PICKUP, DELIVERY_POOL } from './missionData.js';

// Mode Livraison : missions numérotées. Terminer une mission débloque la suivante.
// La progression (dernière mission débloquée) est gardée dans le navigateur (localStorage) ; si le
// stockage est indisponible (navigation privée...), seule la mission 1 est ouverte.
// Données des missions : missionData.js ; réglages de chaque mission (active, nombre de livraisons, gain, départ
// chargé ou non) : interface admin, réglage « missions » (gameSettings.js), appliqués ici.
export {
  CITY_COUNT,
  MISSIONS_PER_CITY,
  MISSION_COUNT,
  BIKE_CAPACITY,
  cityName,
  missionCity,
  missionInCity,
} from './missionData.js';

const STORAGE_KEY = SAVE_KEYS.unlockedMission;

// Réglages de l'admin pour la mission n
const missionSettings = (n) => settings.missions[n - 1];

// Mission désactivée dans l'admin : affichée « indisponible », non jouable, sautée par la progression
export const missionEnabled = (n) => missionSettings(n).enabled;

// Mission n telle qu'elle se joue : { pickup, deliveries, reward, timeLimit }.
//  - deliveries : les N premiers points de la mission (N choisi dans l'admin), complétés si besoin par d'autres
//    points connus (DELIVERY_POOL, sans doublon) ;
//  - pickup : point de chargement si l'admin demande d'aller chercher les produits (celui de la mission, sinon
//    DEFAULT_PICKUP) ; absent si les produits sont déjà chargés au départ ;
//  - reward : Fric gagnés par produit livré.
export function missionData(n) {
  const base = baseMission(n);
  const config = missionSettings(n);
  const deliveries = base.deliveries.slice(0, config.deliveries);
  for (const spot of DELIVERY_POOL) {
    if (deliveries.length >= config.deliveries) break;
    if (!deliveries.some((d) => d.name === spot.name)) deliveries.push(spot);
  }
  return {
    pickup: config.loaded ? null : (base.pickup ?? DEFAULT_PICKUP),
    deliveries,
    reward: config.reward,
    timeLimit: base.timeLimit,
  };
}

// Numéro de la dernière mission débloquée (1 au minimum)
export function unlockedMission() {
  try {
    const value = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    return Number.isInteger(value) ? Math.min(Math.max(value, 1), MISSION_COUNT) : 1;
  } catch {
    return 1;
  }
}

// Mission n jouable : active, et débloquée. Les missions désactivées ne bloquent pas la suite : la progression les
// saute (si l'admin désactive la mission où en est le joueur, la suivante active s'ouvre)
export function missionPlayable(n) {
  if (!missionEnabled(n)) return false;
  let reach = unlockedMission();
  while (reach < MISSION_COUNT && !missionEnabled(reach)) reach++;
  return n <= reach;
}

// À appeler quand la mission n est terminée : débloque la mission active suivante
export function completeMission(n) {
  let next = n + 1;
  while (next < MISSION_COUNT && !missionEnabled(next)) next++;
  if (next <= unlockedMission() || n >= MISSION_COUNT) return;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
    requestSave(); // copie dans Firebase (cloudSave.js)
  } catch {
    // stockage indisponible : la progression n'est pas gardée
  }
}
