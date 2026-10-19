import { ROADS, SIDEWALK_WIDTH, STATIONS } from './deliveryMap.js';
import { halfWidth, isHorizontal } from './network.js';

// Mode Livraison : stations essence (modèle StationEssence de models.glb). Chaque station occupe une
// parcelle au bord d'une rue, façade (pompes) tournée vers la rue, au ras du trottoir. On fait le plein
// (100 %) en s'arrêtant sur le point d'arrêt bleu devant elle (deliveryPoints.js, sorte 'fuel').
//
// Repère du modèle (glTF) : la façade (Blender -Y) regarde vers +Z. Emprise mesurée dans le GLB :
// x de -8,5 à 9,6 m, z de -8,5 à 6,5 m, hauteur 12,2 m.
const MODEL_FRONT_Z = 6.5; // façade
const MODEL_CENTER_X = 0.55; // milieu de la façade en largeur
export const LOT_HALF_LENGTH = 10; // demi-longueur de la parcelle le long de la rue (pas de bâtiment dedans)
export const LOT_DEPTH = 16; // profondeur de la parcelle depuis la façade

// Rue, direction de la rue vers la station, et distance de la façade à l'axe de la rue
function frame(station) {
  const road = ROADS.find((r) => r.name === station.road);
  if (!road) throw new Error(`Rue inconnue : ${station.road}`);
  return { road, facade: halfWidth(road) + SIDEWALK_WIDTH };
}

// Parcelle de la station dans le repère de la carte : { x1, x2, y1, y2 } (bâtiments interdits dedans)
export function stationLot(station) {
  const { road, facade } = frame(station);
  const near = facade;
  const far = facade + LOT_DEPTH;
  if (isHorizontal(road)) {
    const [a, b] = [road.y + station.side * near, road.y + station.side * far];
    return { x1: station.at - LOT_HALF_LENGTH, x2: station.at + LOT_HALF_LENGTH, y1: Math.min(a, b), y2: Math.max(a, b) };
  }
  const [a, b] = [road.x + station.side * near, road.x + station.side * far];
  return { x1: Math.min(a, b), x2: Math.max(a, b), y1: station.at - LOT_HALF_LENGTH, y2: station.at + LOT_HALF_LENGTH };
}

// Pose les stations (clones du modèle) dans parent (groupe de la ville de Livraison)
export function placeStations(parent, template) {
  for (const station of STATIONS) {
    const { road, facade } = frame(station);
    // Rotation qui tourne la façade (+Z du modèle) vers la rue
    let rotation;
    if (isHorizontal(road)) {
      rotation = station.side < 0 ? 0 : Math.PI; // nord de la rue : façade vers le sud (+Z)
    } else {
      rotation = station.side < 0 ? Math.PI / 2 : -Math.PI / 2; // ouest de la rue : façade vers l'est (+X)
    }
    // Point de la façade (milieu) : au ras du trottoir, en face de « at »
    const fx = isHorizontal(road) ? station.at : road.x + station.side * facade;
    const fy = isHorizontal(road) ? road.y + station.side * facade : station.at;
    // Origine du modèle = point de façade - rotation(point de façade dans le repère du modèle)
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const lx = MODEL_CENTER_X;
    const lz = MODEL_FRONT_Z;
    const rx = lx * cos + lz * sin;
    const rz = -lx * sin + lz * cos;
    const model = template.clone(true); // géométrie et matériau partagés
    model.position.set(fx - rx, 0, fy - rz);
    model.rotation.set(0, rotation, 0);
    parent.add(model);
  }
}
