// Mode Livraison : missions numérotées. Terminer une mission débloque la suivante.
// La progression (dernière mission débloquée) est gardée dans le navigateur (localStorage) ; si le
// stockage est indisponible (navigation privée...), seule la mission 1 est ouverte.

export const MISSION_COUNT = 5;
const STORAGE_KEY = 'ctnRacer.unlockedMission';

// Contenu des missions. Chaque livraison est un point au bord d'une rue de deliveryMap.js :
//  - road : nom de la rue ; at : position le long de la rue (y pour une rue verticale, x pour une horizontale) ;
//  - side : côté du trottoir où l'on livre (rue verticale : -1 ouest, +1 est ; horizontale : -1 nord, +1 sud).
// Garder les points à une vingtaine de mètres au moins des carrefours (place pour freiner).
const MISSIONS = [
  {
    // Mission 1 : les 3 produits sont déjà chargés au départ
    deliveries: [
      { name: 'Ferrari Lounge', road: 'Rue 1520', at: 392, side: -1 }, // entre Rue 1614 et la ruelle
      { name: 'Hôtel Mavilla', road: 'Rue 1402', at: 405, side: -1 },
      { name: 'Résidence Royale', road: 'Rue 1660', at: 450, side: 1 },
    ],
  },
];

// Données de la mission n (les missions pas encore écrites reprennent la mission 1)
export const missionData = (n) => MISSIONS[n - 1] ?? MISSIONS[0];

// Numéro de la dernière mission débloquée (1 au minimum)
export function unlockedMission() {
  try {
    const value = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    return Number.isInteger(value) ? Math.min(Math.max(value, 1), MISSION_COUNT) : 1;
  } catch {
    return 1;
  }
}

// À appeler quand la mission n est terminée : débloque la mission n + 1
export function completeMission(n) {
  if (n + 1 <= unlockedMission() || n >= MISSION_COUNT) return;
  try {
    localStorage.setItem(STORAGE_KEY, String(n + 1));
  } catch {
    // stockage indisponible : la progression n'est pas gardée
  }
}
