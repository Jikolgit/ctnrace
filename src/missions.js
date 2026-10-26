// Mode Livraison : missions numérotées. Terminer une mission débloque la suivante.
// La progression (dernière mission débloquée) est gardée dans le navigateur (localStorage) ; si le
// stockage est indisponible (navigation privée...), seule la mission 1 est ouverte.

export const MISSION_COUNT = 15;
const STORAGE_KEY = 'ctnRacer.unlockedMission';

// Capacité de la moto : nombre maximal de produits transportés à la fois. Une mission qui en compte plus
// demande plusieurs allers-retours au point de chargement. (Plus tard : motos à débloquer, plus grandes.)
export const BIKE_CAPACITY = 3;

// Contenu des missions. pickup (facultatif) : point de chargement où l'on prend les produits avant de
// pouvoir livrer (sans pickup, les produits sont déjà chargés au départ : mission 1, l'introduction).
// timeLimit (facultatif) : délai en secondes pour tout livrer, sinon Game Over.
// Chaque point (chargement ou livraison) est au bord d'une rue de deliveryMap.js :
//  - road : nom de la rue ; at : position le long de la rue (y pour une rue verticale, x pour une horizontale) ;
//  - side : côté du trottoir où l'on livre (rue verticale : -1 ouest, +1 est ; horizontale : -1 nord, +1 sud).
// Garder les points à une vingtaine de mètres au moins des carrefours (place pour freiner).
const MISSIONS = [
  {
    // Mission 1 (introduction) : les 2 produits sont déjà chargés au départ
    deliveries: [
      { name: 'Ferrari Lounge', road: 'Rue 1520', at: 392, side: -1 }, // entre Rue 1614 et la ruelle
      { name: 'Hôtel Mavilla', road: 'Rue 1402', at: 405, side: -1 },
    ],
  },
  {
    // Mission 2 : charger les 3 produits au Marché Dantokpa, puis les livrer dans le nord et l'est du quartier
    pickup: { name: 'Marché Dantokpa', road: 'Rue Bel Air', at: 470, side: -1 },
    deliveries: [
      { name: 'Nora Hôtel', road: 'Rue 1650', at: 200, side: 1 },
      { name: 'Boutique Kpondehou', road: 'Rue 1460', at: 300, side: 1 },
      { name: 'Akpakpa', road: 'Rue 1180', at: 440, side: -1 },
    ],
  },
  {
    // Mission 3 : 4 produits pour une moto de 3 places : un second passage à l'entrepôt est nécessaire
    pickup: { name: 'Entrepôt Ségbeya', road: 'Rue 1310', at: 300, side: 1 },
    deliveries: [
      { name: 'Pharmacie Senade', road: 'Rue 1614', at: 360, side: -1 },
      { name: 'École Kpondehou', road: 'Rue 1460', at: 190, side: -1 },
      { name: 'Boulangerie Ayelawadje', road: 'Rue 1180', at: 320, side: 1 },
      { name: 'Résidence Royale', road: 'Rue 1660', at: 450, side: 1 },
    ],
  },
  null, // mission 4 : pas encore écrite (reprend la mission 1)
  {
    // Mission 5 : 1 produit urgent, chargé au Marché Dantokpa et livré à Akpakpa en moins de 2 minutes
    pickup: { name: 'Marché Dantokpa', road: 'Rue Bel Air', at: 470, side: -1 },
    deliveries: [{ name: 'Akpakpa', road: 'Rue 1180', at: 440, side: -1 }],
    timeLimit: 120,
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
