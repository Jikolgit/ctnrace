// Réglages du jeu modifiables depuis l'interface admin (/admin), sans toucher au code. Fichier partagé par le jeu
// (src/settings.js), la page admin (admin/admin.js) et les fonctions serveur (api/config.js, api/admin.js) : pas
// d'accès au navigateur ni à Node ici.
//
// Pour ajouter un réglage : une ligne dans SETTINGS (clé, libellé, type, valeur par défaut), puis l'utiliser dans le
// jeu via `settings.<clé>` (src/settings.js). Types : 'boolean' (case à cocher), 'hour' (null = heure réelle de
// Cotonou, sinon heure fixe en heures décimales : 19,5 = 19 h 30).
export const SETTINGS = [
  { key: 'cartoon', label: 'Effet cartoon des motos (aplats de lumière + contour noir)', type: 'boolean', default: true },
  { key: 'hour', label: 'Heure du jeu (ciel, brouillard, lampadaires, phares)', type: 'hour', default: null },
];

export const DEFAULT_SETTINGS = Object.fromEntries(SETTINGS.map((setting) => [setting.key, setting.default]));

// Réglages vérifiés : seules les clés connues, avec une valeur du bon type (sinon la valeur par défaut)
export function cleanSettings(input) {
  const clean = { ...DEFAULT_SETTINGS };
  if (!input || typeof input !== 'object') return clean;
  for (const setting of SETTINGS) {
    const value = input[setting.key];
    if (setting.type === 'boolean' && typeof value === 'boolean') clean[setting.key] = value;
    if (setting.type === 'hour') {
      if (value === null) clean[setting.key] = null;
      else if (typeof value === 'number' && value >= 0 && value < 24) clean[setting.key] = Math.round(value * 60) / 60;
    }
  }
  return clean;
}
