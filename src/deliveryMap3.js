// Carte 3 du mode Livraison : Cadjehoun, Haie Vive et le Port de Cotonou.
// Plan de référence : docs/carte-ville-3.png (960 × 720 m, nord en haut).
// Les coordonnées sont exprimées en mètres depuis l'angle nord-ouest de la carte.
// Les rues restent orthogonales : le moteur de navigation gère les virages à 90°.
const ROADS_3 = [
  // Grandes artères goudronnées avec terre-plein central
  { name: 'Rue 610', type: 'big', y: 40, x1: 60, x2: 900 },
  { name: "Route de l’Aéroport", type: 'big', y: 390, x1: 60, x2: 900 },
  { name: 'Rue 230', type: 'big', y: 520, x1: 60, x2: 900 },
  { name: 'Quai du Port', type: 'big', y: 700, x1: 60, x2: 900 },
  { name: 'Rue 630', type: 'big', x: 400, y1: 40, y2: 700 },

  // Petites rues pavées du quartier Cadjehoun / Haie Vive
  { name: 'Rue 211', type: 'small', x: 60, y1: 40, y2: 620 },
  { name: 'Rue 215', type: 'small', x: 170, y1: 150, y2: 620 },
  { name: 'Rue 217', type: 'small', x: 280, y1: 150, y2: 620 },
  { name: 'Rue 397', type: 'small', y: 150, x1: 60, x2: 400 },
  { name: 'Rue 399', type: 'small', y: 150, x1: 400, x2: 640 },
  { name: 'Rue 395', type: 'small', y: 270, x1: 60, x2: 640 },
  { name: 'Rue 395 Est', type: 'small', y: 270, x1: 780, x2: 900 },
  { name: 'Rue 238', type: 'small', y: 330, x1: 520, x2: 780 },
  { name: 'Rue 232', type: 'small', y: 450, x1: 60, x2: 400 },
  { name: 'Rue 233', type: 'small', y: 620, x1: 60, x2: 400 },
  { name: 'Rue 234', type: 'small', y: 620, x1: 400, x2: 900 },
  { name: 'Rue 920', type: 'small', x: 900, y1: 40, y2: 700 },
  { name: 'Rue 592', type: 'small', x: 520, y1: 270, y2: 700 },
  { name: 'Rue 612', type: 'small', x: 640, y1: 150, y2: 700 },
  { name: 'Rue 614', type: 'small', x: 780, y1: 270, y2: 700 },

  // Voies internes de la zone hospitalière
  { name: 'Rue 900 IA', type: 'small', y: 270, x1: 640, x2: 780 },
  { name: 'Rue 901 IA', type: 'small', y: 350, x1: 520, x2: 780 },
  { name: 'Rue 902 IA', type: 'small', x: 700, y1: 270, y2: 390 },

  // Raccourcis
  { name: 'Allée de Cadjehoun', type: 'alley', y: 230, x1: 170, x2: 400 },
  { name: 'Ruelle du Port', type: 'alley', x: 850, y1: 620, y2: 700 },
];

const PLACES_3 = [
  { name: 'Majestic Cadjehoun', x: 115, y: 95 },
  { name: 'DEI (ancien commissariat)', x: 225, y: 95 },
  { name: 'Sprinkles 365', x: 115, y: 350 },
  { name: 'Hôpital 1', x: 600, y: 310 },
  { name: 'Hôpital 2', x: 700, y: 370 },
  { name: 'Hall des Arts', x: 840, y: 350 },
  { name: 'Cotonou Amazone', x: 465, y: 570 },
  { name: "Statue de l’Amazone", x: 330, y: 600 },
  { name: 'Hôtel Les Orchidées', x: 220, y: 650 },
];

const STATIONS_3 = [
  { name: 'Station Haie Vive', road: 'Rue 217', at: 350, side: 1 },
  { name: 'Station Jean-Paul II', road: 'Rue 614', at: 460, side: -1 },
];

const DISTRICTS_3 = [
  { name: 'CADJEHOUN 1', x: 170, y: 220 },
  { name: 'CADJEHOUN 2', x: 350, y: 220 },
  { name: 'CADJEHOUN', x: 520, y: 220 },
  { name: 'HAIE VIVE', x: 230, y: 350 },
  { name: 'ZONE HOSPITALIÈRE', x: 650, y: 380 },
  { name: 'GBETO', x: 850, y: 480 },
  { name: 'PORT DE COTONOU', x: 700, y: 590 },
];

const ZONES_3 = [
  { kind: 'camp', x1: 660, y1: 60, x2: 890, y2: 260 },
  { kind: 'hospital', x1: 530, y1: 280, x2: 770, y2: 390 },
  { kind: 'park', x1: 420, y1: 440, x2: 505, y2: 530 },
  { kind: 'plaza', x1: 270, y1: 545, x2: 390, y2: 675 },
  { kind: 'port', x1: 520, y1: 545, x2: 900, y2: 690 },
];

export const CITY_3 = {
  width: 960,
  height: 720,
  start: { x: 400, y: 700, dir: 0, after: 6 }, // Quai du Port × Rue 630, vers le nord
  water: null,
  parks: [{ x1: 420, y1: 440, x2: 505, y2: 530 }],
  zones: ZONES_3,
  roads: ROADS_3,
  places: PLACES_3,
  stations: STATIONS_3,
  districts: DISTRICTS_3,
};
