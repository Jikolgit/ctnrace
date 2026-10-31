// Données des missions du mode Livraison (sans navigateur ni stockage : lues aussi par l'interface admin et le
// serveur, via gameSettings.js). La progression et les réglages appliqués sont dans missions.js.

// Les missions se font dans plusieurs villes (CITY_COUNT), MISSIONS_PER_CITY chacune. Numérotation globale :
// missions 1 à 10 = ville 1, 11 à 20 = ville 2, etc. (affichées 1 à 10 dans chaque ville). La progression suit
// cet ordre : la ville 2 s'ouvre quand la dernière mission de la ville 1 est terminée. Chaque ville se joue sur
// une carte (MAP_OF_CITY, deliveryMap.js) : la ville 1 sur la carte 1 (Ségbeya / Kpondehou), la ville 2 sur la
// carte 2 (Cotonou et sa lagune). La ville 3 n'a pas encore de carte : elle reprend la carte 1.
export const CITY_COUNT = 3;
export const MISSIONS_PER_CITY = 10;
export const MISSION_COUNT = CITY_COUNT * MISSIONS_PER_CITY;
export const cityName = (city) => `Ville ${city}`;
// Carte (deliveryMap.js) sur laquelle se joue chaque ville
const MAP_OF_CITY = { 1: 1, 2: 2, 3: 1 };
export const cityMapNumber = (city) => MAP_OF_CITY[city] ?? 1;
// Ville d'une mission (numéro global) et son numéro dans la ville
export const missionCity = (n) => Math.ceil(n / MISSIONS_PER_CITY);
export const missionInCity = (n) => ((n - 1) % MISSIONS_PER_CITY) + 1;

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
const CITY_1_MISSIONS = [
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


// Ville 2 (carte 2 : Cotonou et sa lagune, voir deliveryMap2.js). Le point de départ est à l'ouest, au carrefour
// Avenue de Dantokpa × Route de la Lagune. Les deux rives ne communiquent que par les deux ponts.
const CITY_2_MISSIONS = [
  {
    // Mission 1 de la ville 2 (introduction) : 2 produits déjà chargés, livrés sur la rive ouest
    deliveries: [
      { name: 'Azalaï Hôtel', road: 'Route de la Lagune (ouest)', at: 290, side: -1 },
      { name: 'Marché Dantokpa', road: 'Quai ouest', at: 165, side: -1 },
    ],
  },
  {
    // Mission 2 : charger 3 produits au Marché Dantokpa, puis traverser le pont nord pour livrer sur la rive est
    pickup: { name: 'Marché Dantokpa', road: 'Quai ouest', at: 165, side: -1 },
    deliveries: [
      { name: 'Cosmos Electronic', road: 'Rue 1403', at: 190, side: 1 },
      { name: 'Pharmacie Senade', road: 'Rue 1407', at: 590, side: -1 },
      { name: 'Hôtel du Lac', road: 'Rue 1403', at: 475, side: 1 },
    ],
  },
  {
    // Mission 3 : 4 produits pour une moto de 3 places (deux passages à l'entrepôt), livrés sur les deux rives
    pickup: { name: 'Entrepôt Dantokpa', road: 'Avenue de Dantokpa', at: 470, side: 1 },
    deliveries: [
      { name: 'Boulangerie Aidjedo', road: 'Rue 1385', at: 240, side: -1 },
      { name: 'École Ségbeya', road: 'Rue 1405', at: 690, side: 1 },
      { name: 'Pharmacie Senade', road: 'Rue 1407', at: 590, side: -1 },
      { name: 'Hôtel du Lac', road: 'Rue 1403', at: 475, side: 1 },
    ],
  },
  {
    // Mission 4 : 1 produit urgent, chargé au Marché Dantokpa et livré à l'Hôtel du Lac, de l'autre côté de la
    // lagune, en moins de 2 minutes 30
    pickup: { name: 'Marché Dantokpa', road: 'Quai ouest', at: 165, side: -1 },
    deliveries: [{ name: 'Hôtel du Lac', road: 'Rue 1403', at: 475, side: 1 }],
    timeLimit: 150,
  },
];

// Missions écrites de chaque ville, complétées par des « null » jusqu'à MISSIONS_PER_CITY (cases pas encore écrites)
const padCity = (list) => [...list, ...Array(MISSIONS_PER_CITY - list.length).fill(null)];
export const MISSIONS = [...padCity(CITY_1_MISSIONS), ...padCity(CITY_2_MISSIONS)];

// Mission écrite n. Une mission pas encore écrite reprend la première mission de sa ville (l'introduction), et
// une ville sans aucune mission écrite (la ville 3) reprend la mission 1 de la ville 1
const firstOfCity = (city) => MISSIONS[(city - 1) * MISSIONS_PER_CITY] ?? MISSIONS[0];
export const baseMission = (n) => MISSIONS[n - 1] ?? firstOfCity(missionCity(n));

// Réglages modifiables dans l'interface admin (gameSettings.js, réglage « missions ») : gain par produit livré
// (DEFAULT_REWARD), point de chargement des missions sans le leur quand l'admin demande d'aller chercher les
// produits (defaultPickup, propre à chaque ville), et réserve de points de livraison de la ville (deliveryPool) :
// tous ceux de ses missions écrites, sans doublon, pour compléter une mission dont l'admin augmente le nombre de
// livraisons.
export const DEFAULT_REWARD = 50; // Fric par produit livré
export const DEFAULT_FUEL_PRICE = 20; // Fric le plein à la station essence
const DEFAULT_PICKUPS = {
  1: { name: 'Marché Dantokpa', road: 'Rue Bel Air', at: 470, side: -1 },
  2: CITY_2_MISSIONS[1].pickup,
};
export const defaultPickup = (city) => DEFAULT_PICKUPS[city] ?? DEFAULT_PICKUPS[1];
const poolOf = (city) => [
  ...new Map(
    MISSIONS.slice((city - 1) * MISSIONS_PER_CITY, city * MISSIONS_PER_CITY)
      .filter(Boolean)
      .flatMap((m) => m.deliveries)
      .map((d) => [d.name, d])
  ).values(),
];
// Ville sans mission écrite : la réserve de la ville 1
export const deliveryPool = (city) => {
  const pool = poolOf(city);
  return pool.length ? pool : poolOf(1);
};
// Plus grand nombre de livraisons possible dans une mission (réglage admin) : la plus grande réserve
export const MAX_DELIVERIES = Math.max(...Array.from({ length: CITY_COUNT }, (_, i) => deliveryPool(i + 1).length));

// Réglages par défaut de la mission n : active, nombre de livraisons et départ (produits déjà chargés ou à aller
// chercher) tels qu'écrits ci-dessus, gain par livraison et prix du plein
export const missionDefaults = (n) => {
  const mission = baseMission(n);
  return {
    enabled: true,
    deliveries: mission.deliveries.length,
    reward: DEFAULT_REWARD,
    fuelPrice: DEFAULT_FUEL_PRICE,
    loaded: !mission.pickup,
  };
};
