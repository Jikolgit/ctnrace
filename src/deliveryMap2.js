// Carte 2 du mode Livraison : Cotonou et sa lagune. Deux rives (ouest : Aidjedo, Marché Dantokpa ; est : Ségbeya,
// Senade, Hôtel du Lac) séparées par une lagune de 100 m de large, reliées par DEUX ponts : le pont nord (grand pont
// goudronné à 4 couloirs, Boulevard Saint Michel) et le pont sud (3 couloirs, goudronné entre les deux quais).
// 900 × 720 m, soit deux fois la surface de la carte 1. Même repère et mêmes règles que deliveryMap.js. Plan :
// docs/carte-ville-2.png. Les numéros de rues (Rue 13xx) et l'emplacement des stations sont des propositions.
// Toutes les rues finissent sur une autre rue (aucune impasse).
//
// Les ponts : rues qui traversent l'eau (water). Pas de bâtiments au-dessus de l'eau ; les trottoirs du pont
// ont un garde-corps.
const ROADS_2 = [
  // Grandes routes goudronnées
  { name: "Route du Nord (ouest)", type: 'big', y: 40, x1: 60, x2: 360 },
  { name: "Route du Nord (est)", type: 'big', y: 40, x1: 540, x2: 840 },
  { name: "Route de la Lagune (ouest)", type: 'big', y: 680, x1: 60, x2: 360 },
  { name: "Route de la Lagune (est)", type: 'big', y: 680, x1: 540, x2: 840 },
  { name: "Boulevard Saint Michel – Pont nord", type: 'big', y: 250, x1: 60, x2: 840 },
  { name: "Avenue de Dantokpa", type: 'big', x: 200, y1: 40, y2: 680 },
  { name: "Quai ouest", type: 'big', x: 360, y1: 40, y2: 680 },
  { name: "Rue 1403", type: 'big', x: 540, y1: 40, y2: 680 },
  { name: "Avenue de Ségbeya", type: 'big', x: 740, y1: 40, y2: 680 },

  // Petites rues pavées (le pont sud est goudronné entre les deux quais : asphalt = [x1, x2])
  { name: "Rue 1380", type: 'small', x: 60, y1: 40, y2: 680 },
  { name: "Rue 1392", type: 'small', x: 130, y1: 110, y2: 600 },
  { name: "Rue 1394", type: 'small', x: 280, y1: 110, y2: 600 },
  { name: "Rue 1385", type: 'small', y: 110, x1: 60, x2: 360 },
  { name: "Rue 1396", type: 'small', y: 180, x1: 130, x2: 280 },
  { name: "Rue 1387", type: 'small', y: 330, x1: 60, x2: 360 },
  { name: "Rue 1389", type: 'small', y: 420, x1: 130, x2: 360 },
  { name: "Rue 1391", type: 'small', y: 600, x1: 60, x2: 360 },
  { name: "Rue du Lac – Pont sud", type: 'small', y: 520, x1: 60, x2: 840, asphalt: [360, 540] },
  { name: "Rue 1430", type: 'small', x: 840, y1: 40, y2: 680 },
  { name: "Rue 1415", type: 'small', x: 640, y1: 130, y2: 600 },
  { name: "Rue 1417", type: 'small', x: 800, y1: 130, y2: 600 },
  { name: "Rue 1405", type: 'small', y: 130, x1: 540, x2: 840 },
  { name: "Rue 1407", type: 'small', y: 330, x1: 540, x2: 840 },
  { name: "Rue 1409", type: 'small', y: 430, x1: 540, x2: 740 },
  { name: "Rue 1411", type: 'small', y: 600, x1: 540, x2: 840 },

  // Ruelles
  { name: "Ruelle du marché", type: 'alley', y: 290, x1: 200, x2: 360 },
  { name: "Ruelle 1", type: 'alley', x: 320, y1: 250, y2: 330 },
  { name: "Ruelle de Saint Michel", type: 'alley', y: 560, x1: 130, x2: 280 },
  { name: "Ruelle du Lac", type: 'alley', y: 560, x1: 540, x2: 640 },
  { name: "Ruelle 2", type: 'alley', x: 690, y1: 330, y2: 430 },
];

const PLACES_2 = [
  { name: "Marché Dantokpa", x: 325, y: 160 },
  { name: "Azalaï Hôtel", x: 325, y: 622 },
  { name: "Cosmos Electronic", x: 590, y: 195 },
  { name: "Hôtel du Lac", x: 590, y: 478 },
];

const STATIONS_2 = [
  { name: "Station Dantokpa", road: "Avenue de Dantokpa", at: 375, side: -1 },
  { name: "Station du Lac", road: "Rue 1403", at: 380, side: 1 },
];

const DISTRICTS_2 = [
  { name: "AIDJEDO", x: 280, y: 75 },
  { name: "COTONOU", x: 265, y: 656 },
  { name: "SÉGBEYA", x: 690, y: 85 },
  { name: "SENADE", x: 590, y: 290 },
];

export const CITY_2 = {
  width: 900,
  height: 720,
  start: { x: 200, y: 680, dir: 0, after: 6 }, // carrefour Avenue de Dantokpa × Route de la Lagune (ouest), vers le nord
  water: { x1: 400, x2: 500 },
  parks: [{ x1: 552, y1: 446, x2: 628, y2: 508 }], // parc de l'Hôtel du Lac
  roads: ROADS_2,
  places: PLACES_2,
  stations: STATIONS_2,
  districts: DISTRICTS_2,
};
