// Mode Livraison : réseau de routes inspiré d'un quartier de Cotonou (Ségbeya / Kpondehou / Akpakpa).
// Données seules, pas encore utilisées par le jeu. Repère de la carte, en mètres :
// x vers l'est (droite), y vers le sud (bas), origine en haut à gauche. Toutes les rues sont droites
// et orientées nord-sud ou est-ouest (le jeu ne sait tourner qu'à 90°).

export const MAP_WIDTH = 640;
export const MAP_HEIGHT = 520;

// Deux types de route : petites rues pavées (3 couloirs, celles du jeu actuel) et grandes routes
// goudronnées (4 couloirs). Largeur de couloir 2 m, trottoirs de 1,5 m de chaque côté.
export const ROAD_TYPES = {
  small: { lanes: 3, surface: 'pavés' },
  big: { lanes: 4, surface: 'goudron' },
};
export const LANE_WIDTH = 2;
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

// Noms de quartiers (affichage seulement)
export const DISTRICTS = [
  { name: 'AYELAWADJE', x: 320, y: 90 },
  { name: 'SÉGBEYA', x: 135, y: 305 },
  { name: 'KPONDEHOU', x: 440, y: 205 },
  { name: 'SENADE', x: 360, y: 335 },
];
