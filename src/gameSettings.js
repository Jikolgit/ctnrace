// Réglages du jeu modifiables depuis l'interface admin (/admin), sans toucher au code. Fichier partagé par le jeu
// (src/settings.js), la page admin (admin/admin.js) et les fonctions serveur (api/config.js, api/admin.js) : pas
// d'accès au navigateur ni à Node ici.
//
import { MISSION_COUNT, MAX_DELIVERIES, missionDefaults } from './missionData.js';

// Pour ajouter un réglage : une ligne dans SETTINGS (clé, libellé, type, valeur par défaut), puis l'utiliser dans le
// jeu via `settings.<clé>` (src/settings.js). Types : 'boolean' (case à cocher), 'text' (texte d'une ligne, maxLength caractères au plus, jamais vide), 'hour' (null = heure réelle de
// Cotonou, sinon heure fixe en heures décimales : 19,5 = 19 h 30), 'missions' (tableau des MISSION_COUNT missions :
// { enabled, deliveries (1 à MAX_DELIVERIES), reward (Fric par produit livré), fuelPrice (Fric le plein), loaded (produits déjà chargés au
// départ, sinon à aller chercher au point de chargement) }, tableau dans la page admin).
export const SETTINGS = [
  {
    key: 'gameName',
    label: "Nom du jeu (menu principal, écran de chargement, onglet) ; la 2e partie en orange : dernier mot, ou à partir de la dernière majuscule",
    type: 'text',
    default: 'ctnRacer', // nom de développement
    maxLength: 30,
  },
  { key: 'cartoon', label: 'Effet cartoon des motos (aplats de lumière + contour noir)', type: 'boolean', default: true },
  { key: 'speedometer', label: 'Compteur de vitesse (en bas à gauche pendant la partie)', type: 'boolean', default: true },
  { key: 'unlockAll', label: 'Débloquer toutes les missions et toutes les villes (pour tester)', type: 'boolean', default: false },
  { key: 'hour', label: 'Heure du jeu (ciel, brouillard, lampadaires, phares)', type: 'hour', default: null },
  {
    key: 'missions',
    label: 'Missions (mode Livraison)',
    type: 'missions',
    default: Array.from({ length: MISSION_COUNT }, (_, i) => missionDefaults(i + 1)),
  },
];

// Nom du jeu coupé en deux pour le logo (2e partie en orange) : dernier mot s'il y en a plusieurs, sinon à partir de
// la dernière majuscule (« ctnRacer » → « ctn » + « Racer »), sinon tout en blanc. Même règle dans le petit script
// de index.html (écran de chargement).
export function splitGameName(name) {
  const space = name.lastIndexOf(' ');
  const cut = space > 0 ? space + 1 : Math.max(0, ...[...name].map((c, i) => (i > 0 && /\p{Lu}/u.test(c) ? i : 0)));
  return cut > 0 ? [name.slice(0, cut), name.slice(cut)] : [name, ''];
}

export { MAX_DELIVERIES };
export const MAX_REWARD = 100000;
const isInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export const DEFAULT_SETTINGS = Object.fromEntries(SETTINGS.map((setting) => [setting.key, setting.default]));

// Réglages vérifiés : seules les clés connues, avec une valeur du bon type (sinon la valeur par défaut)
export function cleanSettings(input) {
  const clean = { ...DEFAULT_SETTINGS };
  if (!input || typeof input !== 'object') return clean;
  for (const setting of SETTINGS) {
    const value = input[setting.key];
    if (setting.type === 'boolean' && typeof value === 'boolean') clean[setting.key] = value;
    if (setting.type === 'text' && typeof value === 'string') {
      // Une ligne, sans caractères de contrôle ; longueur en caractères (comme mb_strlen du PHP)
      const text = value.replace(/\s+/g, ' ').trim();
      if (text && [...text].length <= setting.maxLength && !/\p{Cc}/u.test(text)) clean[setting.key] = text;
    }
    if (setting.type === 'hour') {
      if (value === null) clean[setting.key] = null;
      else if (typeof value === 'number' && value >= 0 && value < 24) clean[setting.key] = Math.round(value * 60) / 60;
    }
    if (setting.type === 'missions') {
      // Mission par mission, champ par champ : une valeur absente ou invalide garde sa valeur par défaut
      clean[setting.key] = setting.default.map((defaults, i) => {
        const mission = Array.isArray(value) && value[i] && typeof value[i] === 'object' ? value[i] : {};
        return {
          enabled: typeof mission.enabled === 'boolean' ? mission.enabled : defaults.enabled,
          deliveries: isInt(mission.deliveries, 1, MAX_DELIVERIES) ? mission.deliveries : defaults.deliveries,
          reward: isInt(mission.reward, 0, MAX_REWARD) ? mission.reward : defaults.reward,
          fuelPrice: isInt(mission.fuelPrice, 0, MAX_REWARD) ? mission.fuelPrice : defaults.fuelPrice,
          loaded: typeof mission.loaded === 'boolean' ? mission.loaded : defaults.loaded,
        };
      });
    }
  }
  return clean;
}
