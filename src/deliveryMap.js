// Mode Livraison : réseaux de routes inspirés de Cotonou. Deux cartes : la 1 (ci-dessous : quartier Ségbeya /
// Kpondehou / Akpakpa, 640 × 520 m) et la 2 (deliveryMap2.js : Cotonou et sa lagune, deux rives et deux ponts,
// 900 × 720 m). setDeliveryMap(numéro) choisit celle qu'utilise le jeu (voir la fin du fichier).
// Repère de la carte, en mètres :
// x vers l'est (droite), y vers le sud (bas), origine en haut à gauche. Toutes les rues sont droites
// et orientées nord-sud ou est-ouest (le jeu ne sait tourner qu'à 90°).

import { CITY_2 } from './deliveryMap2.js';

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

// Carte 1. Chaque rue : segment horizontal (y fixe, de x1 à x2) ou vertical (x fixe, de y1 à y2)
const ROADS_1 = [
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
const PLACES_1 = [
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
const STATIONS_1 = [
  { name: 'Station Ségbeya', road: 'Rue 1254', at: 135, side: -1 },
  { name: 'Station Senade', road: 'Rue 1614', at: 520, side: 1 },
];

// Noms de quartiers (affichage seulement)
const DISTRICTS_1 = [
  { name: 'AYELAWADJE', x: 320, y: 90 },
  { name: 'SÉGBEYA', x: 135, y: 305 },
  { name: 'KPONDEHOU', x: 440, y: 205 },
  { name: 'SENADE', x: 360, y: 335 },
];

// Les cartes. start : carrefour de départ du joueur et direction (0 = nord, 1 = est, 2 = sud, 3 = ouest), after =
// mètres après la sortie du carrefour. water (facultatif) : bande d'eau nord-sud { x1, x2 } que seuls les ponts
// (rues qui la traversent) franchissent. parks : zones d'herbe { x1, y1, x2, y2 } sans bâtiments (décor).
const CITY_1 = {
  width: 640,
  height: 520,
  start: { x: 240, y: 500, dir: 0, after: 6 }, // carrefour Rue 1451 × Route de l'Ouémé, vers le nord
  water: null,
  parks: [],
  roads: ROADS_1,
  places: PLACES_1,
  stations: STATIONS_1,
  districts: DISTRICTS_1,
};
const MAPS = { 1: CITY_1, 2: CITY_2 };

// Carte en cours : exportée en « live bindings » (les autres fichiers voient la nouvelle valeur après un
// setDeliveryMap). Au chargement : la carte 1. Les fichiers qui en dépendent (réseau, ville, mini-carte...) doivent
// être reconstruits après un changement de carte (main.js, useCity).
export let MAP_WIDTH = CITY_1.width;
export let MAP_HEIGHT = CITY_1.height;
export let MAP_START = CITY_1.start;
export let WATER = CITY_1.water;
export let PARKS = CITY_1.parks;
export let ROADS = CITY_1.roads;
export let PLACES = CITY_1.places;
export let STATIONS = CITY_1.stations;
export let DISTRICTS = CITY_1.districts;
export let MAP_NUMBER = 1;

export function setDeliveryMap(number) {
  const map = MAPS[number] ?? CITY_1;
  MAP_NUMBER = MAPS[number] ? number : 1;
  MAP_WIDTH = map.width;
  MAP_HEIGHT = map.height;
  MAP_START = map.start;
  WATER = map.water;
  PARKS = map.parks;
  ROADS = map.roads;
  PLACES = map.places;
  STATIONS = map.stations;
  DISTRICTS = map.districts;
}
