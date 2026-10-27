// Fric : monnaie du jeu (nom provisoire), achetée avec de l'argent réel dans la Boutique (paiement FedaPay, pas
// encore branché). Le solde n'est écrit que par le serveur, dans la fiche Firebase du joueur (champ fric de
// players/{uid}, interdit en écriture au navigateur par les règles Firestore) ; le jeu le lit au démarrage
// (cloudSave.js) et le garde en cache dans le navigateur pour l'afficher tout de suite, même hors ligne.
const CACHE_KEY = 'ctnrace-fric';

// Packs en vente : quantité de Fric et prix en francs CFA
export const FRIC_PACKS = [
  { id: 'fric_4000', fric: 4000, price: 500 },
  { id: 'fric_8000', fric: 8000, price: 900 },
];

let fric = 0;
try {
  fric = Math.max(0, parseInt(localStorage.getItem(CACHE_KEY), 10) || 0);
} catch {
  // stockage indisponible : 0 jusqu'à la lecture de Firebase
}

const listeners = [];

export const getFric = () => fric;

// Écrit 4 000 avec un espace entre les milliers, à la française
export const formatFric = (value) => value.toLocaleString('fr-FR');

// fn(solde) : appelé à chaque changement du solde
export function onFricChange(fn) {
  listeners.push(fn);
  fn(fric);
}

// Solde lu dans la fiche Firebase du joueur
export function setFric(value) {
  fric = Math.max(0, Math.floor(value) || 0);
  try {
    localStorage.setItem(CACHE_KEY, String(fric));
  } catch {
    // stockage indisponible
  }
  for (const fn of listeners) fn(fric);
}
