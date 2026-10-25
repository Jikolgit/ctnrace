// Mode Livraison : réseau de routes inspiré d'un quartier de Cotonou (Ségbeya / Kpondehou / Akpakpa).
// Repère de la carte, en mètres :
// x vers l'est (droite), y vers le sud (bas), origine en haut à gauche. Toutes les rues sont droites
// et orientées nord-sud ou est-ouest (le jeu ne sait tourner qu'à 90°).

export const MAP_WIDTH = 640;
export const MAP_HEIGHT = 520;

// Trois types de route : petites rues pavées (3 couloirs), grandes routes goudronnées (4 couloirs) et
// ruelles (2 couloirs, petits pavés, raccourcis). Largeur de couloir 2 m (laneWidth pour une autre largeur),
// trottoirs de 1,5 m de chaque côté.
// Les grandes routes ont un terre-plein central (median, en m) : 2 couloirs de chaque côté, et on ne peut
// rouler que dans les 2 couloirs de son sens (on roule à droite). Le terre-plein s'interrompt aux carrefours.
// uturn : demi-tour possible aux carrefours (pas dans les ruelles).
export const ROAD_TYPES = {
  small: { lanes: 3, surface: 'pavés', uturn: true },
  big: { lanes: 4, surface: 'goudron', median: 2, laneWidth: 3, uturn: true }, // 4 couloirs + terre-plein : 14 m au total
  alley: { lanes: 2, surface: 'petits pavés', laneWidth: 2 }, // étroites : les voitures n'y vont jamais
};
// 3 m : les véhicules les plus larges (car_2, car_3 : ~3 m) tiennent dans un couloir (avant : 2 m, et 2,5 m sur
// les grandes routes)
export const LANE_WIDTH = 3;
export const SIDEWALK_WIDTH = 1.5;

// Chaque rue : segment horizontal (y fixe, de x1 à x2) ou vertical (x fixe, de y1 à y2)
export const ROADS = [
  // Grandes routes goudronnées : le cadre du quartier
  { name: "Route d'Ayelawadje", type: 'big', y: 40, x1: 40, x2: 640 },
  { name: 'Route de l’Ouémé', type: 'big', y: 500, x1: 40, x2: 640 },
  { name: 'Rue 1451', type: 'big', x: 240, y1: 40, y2: 500 },
  { name: 'Rue 1854', type: 'big', x: 560, y1: 40, y2: 500 },

  // Petites rues pavées
  { name: 'Rue Bel Air', type: 'small', x: 100, y1: 40, y2: 500 },
  { name: 'Rue 1180', type: 'small', y: 140, x1: 100, x2: 560 },
  { name: 'Rue 1254', type: 'small', y: 240, x1: 100, x2: 560 },
  { name: 'Rue 1614', type: 'small', y: 370, x1: 100, x2: 560 },
  { name: 'Rue 1650', type: 'small', y: 440, x1: 100, x2: 240 },
  { name: 'Rue 1660', type: 'small', y: 440, x1: 400, x2: 560 },
  { name: 'Rue 1310', type: 'small', x: 170, y1: 140, y2: 370 },
  { name: 'Rue 1520', type: 'small', x: 320, y1: 240, y2: 500 },
  { name: 'Rue 1402', type: 'small', x: 400, y1: 40, y2: 500 },
  { name: 'Rue 1460', type: 'small', x: 480, y1: 140, y2: 370 },

  // Ruelles (raccourcis)
  { name: 'Ruelle du Lounge', type: 'alley', y: 420, x1: 240, x2: 320 },
];

// Lieux remarquables : futurs points de départ / d'arrivée des livraisons
export const PLACES = [
  { name: 'Marché Dantokpa', x: 70, y: 470 },
  { name: 'Nora Hôtel', x: 205, y: 470 },
  { name: 'Ferrari Lounge', x: 285, y: 410 },
  { name: 'Hôtel Mavilla', x: 360, y: 405 },
  { name: 'Résidence Royale', x: 450, y: 470 },
  { name: 'Akpakpa', x: 470, y: 90 },
];

// Stations essence (modèle StationEssence, voir stations.js) : au bord d'une rue, comme les points de
// livraison (road, at = position le long de la rue, side = côté du trottoir). Le plein (100 %) se fait sur le
// point d'arrêt devant la station. Loin des carrefours : la parcelle fait 20 m le long de la rue.
export const STATIONS = [
  { name: 'Station Ségbeya', road: 'Rue 1254', at: 135, side: -1 },
  { name: 'Station Senade', road: 'Rue 1614', at: 520, side: 1 },
];

// Noms de quartiers (affichage seulement)
export const DISTRICTS = [
  { name: 'AYELAWADJE', x: 320, y: 90 },
  { name: 'SÉGBEYA', x: 135, y: 305 },
  { name: 'KPONDEHOU', x: 440, y: 205 },
  { name: 'SENADE', x: 360, y: 335 },
];
