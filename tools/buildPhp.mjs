// Construit la version du jeu pour un hébergement PHP (Apache, cPanel…) dans dist-php/ : le jeu (vite build, déjà
// lancé par « npm run build:php ») + les fonctions serveur PHP du dossier php/ (api/*.php, .htaccess) + api/lib/
// shared.json (packs de Fric et réglages par défaut, tirés de src/fric.js et src/gameSettings.js : les fonctions PHP
// utilisent ainsi les mêmes prix et les mêmes réglages que le jeu). Tout le contenu de dist-php/ s'envoie tel quel
// dans le dossier public du site (public_html).
import { cpSync, writeFileSync } from 'node:fs';
import { FRIC_PACKS } from '../src/fric.js';
import { SETTINGS, DEFAULT_SETTINGS, MAX_DELIVERIES, MAX_REWARD } from '../src/gameSettings.js';

const root = new URL('../', import.meta.url);
const out = new URL('dist-php/', root);
cpSync(new URL('php/', root), out, { recursive: true });
const shared = {
  fricPacks: FRIC_PACKS,
  settings: SETTINGS.map(({ key, type }) => ({ key, type })),
  defaults: DEFAULT_SETTINGS,
  maxDeliveries: MAX_DELIVERIES,
  maxReward: MAX_REWARD,
};
writeFileSync(new URL('api/lib/shared.json', out), JSON.stringify(shared, null, 2));
console.log('dist-php/ prêt : à envoyer dans le dossier public du site (public_html)');
