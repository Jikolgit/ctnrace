// Données du joueur gardées dans le navigateur (localStorage) et copiées dans Firebase (cloudSave.js).
// Ce petit module ne charge pas Firebase : missions.js, wallet.js et garage.js l'appellent à chaque changement,
// cloudSave.js (chargé à part, plus lourd) écoute et envoie la sauvegarde.

// Clés localStorage des données sauvegardées
export const SAVE_KEYS = {
  unlockedMission: 'ctnRacer.unlockedMission',
  bike: 'ctnrace-bike',
  money: 'ctnrace-money',
};
const SAVED_AT_KEY = 'ctnrace-saved-at'; // date (ms) du dernier changement local

export const SAVE_EVENT = 'ctnrace-save';

// À appeler après avoir modifié une donnée sauvegardée
export function requestSave() {
  try {
    localStorage.setItem(SAVED_AT_KEY, String(Date.now()));
  } catch {
    // stockage indisponible
  }
  window.dispatchEvent(new Event(SAVE_EVENT));
}

export function localSavedAt() {
  try {
    return Number(localStorage.getItem(SAVED_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function setLocalSavedAt(time) {
  try {
    localStorage.setItem(SAVED_AT_KEY, String(time));
  } catch {
    // stockage indisponible
  }
}
