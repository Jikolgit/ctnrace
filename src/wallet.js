// Mode Livraison : argent du joueur (dollars), gardé d'une partie à l'autre dans le navigateur (localStorage),
// comme la progression des missions.
import { SAVE_KEYS, requestSave } from './saveQueue.js';

const STORAGE_KEY = SAVE_KEYS.money;

export const DELIVERY_REWARD = 10; // $ par produit livré
export const FUEL_PRICE = 5; // $ le plein à la station essence

let money = 0;
try {
  const value = parseInt(localStorage.getItem(STORAGE_KEY), 10);
  if (Number.isInteger(value) && value > 0) money = value;
} catch {
  // stockage indisponible : on part de 0
}

export const getMoney = () => money;

// Ajoute (ou retire, si amount < 0) de l'argent ; renvoie le nouveau solde
export function addMoney(amount) {
  money = Math.max(0, money + amount);
  try {
    localStorage.setItem(STORAGE_KEY, String(money));
  } catch {
    // stockage indisponible : le solde n'est pas gardé
  }
  requestSave(); // copie dans Firebase (cloudSave.js)
  return money;
}

// Solde repris de la sauvegarde Firebase (cloudSave.js)
export function setMoney(value) {
  money = Math.max(0, Math.floor(value) || 0);
}
