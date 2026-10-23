import * as THREE from 'three';
import { psxMaterial } from './psx.js';
import { ROAD_TYPES } from './deliveryMap.js';
import { EAST, SOUTH, isHorizontal, medianWidth, laneWidthOf } from './network.js';

// Mode Livraison : bidons d'essence posés sur les rues du réseau. La moto les ramasse en roulant dessus ;
// un bidon ramassé réapparaît aussitôt ailleurs, loin du joueur. Nombre fixe de bidons (pool, aucune
// création en cours de partie). Image public/jerrycan.png affichée en sprite (toujours face à la caméra).

const CAN_COUNT = 5; // bidons présents en même temps sur la carte (les stations essence font le plein)
const CAN_SIZE = 1.1; // taille du sprite (m)
const CAN_HEIGHT = 0.8; // hauteur du centre du sprite au-dessus de la route
const BOB_AMPLITUDE = 0.12; // léger flottement vertical
const BOB_SPEED = 3;
const PICKUP_RADIUS = 1.2; // distance (m) en dessous de laquelle la moto ramasse le bidon
const MARGIN = 20; // pas de bidon à moins de 20 m d'un carrefour
const RESPAWN_MIN_DISTANCE = 120; // un bidon réapparaît à au moins 120 m du joueur
const START_MIN_DISTANCE = 40; // au départ, aucun bidon tout près du joueur

const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}jerrycan.png`);
texture.colorSpace = THREE.SRGBColorSpace;

// parent : groupe de la ville de Livraison (repère de la carte : x → X, y → Z) ; graph : network.js
export function createFuelCans(parent, graph) {
  const material = psxMaterial(new THREE.SpriteMaterial({ map: texture, transparent: true }));

  // Rues où poser des bidons : chaque bras du graphe (une seule fois), sauf ceux qui mènent à une impasse
  // et ceux trop courts pour garder la marge autour des carrefours
  const arms = [];
  let totalLength = 0;
  for (const node of graph.nodes) {
    for (const d of [EAST, SOUTH]) {
      const arm = node.arms[d];
      if (!arm || node.deadEnd || arm.node.deadEnd || arm.length <= 2 * MARGIN) continue;
      arms.push({ from: node, arm });
      totalLength += arm.length - 2 * MARGIN;
    }
  }

  const cans = [];
  for (let i = 0; i < CAN_COUNT; i++) {
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(CAN_SIZE, CAN_SIZE, 1);
    parent.add(sprite);
    cans.push({ sprite, x: 0, z: 0, phase: Math.random() * Math.PI * 2 });
  }

  // Place le bidon sur une rue au hasard (proportionnellement à la longueur), dans un couloir au hasard,
  // à au moins minDistance du point (px, pz)
  function place(can, px, pz, minDistance) {
    for (let attempt = 0; attempt < 30; attempt++) {
      let pick = Math.random() * totalLength;
      let chosen = arms[arms.length - 1];
      for (const item of arms) {
        pick -= item.arm.length - 2 * MARGIN;
        if (pick <= 0) {
          chosen = item;
          break;
        }
      }
      const { from, arm } = chosen;
      const lanes = ROAD_TYPES[arm.road.type].lanes;
      let lateral = (Math.floor(Math.random() * lanes) - (lanes - 1) / 2) * laneWidthOf(arm.road);
      lateral += (Math.sign(lateral) * medianWidth(arm.road)) / 2; // couloirs écartés par le terre-plein
      const u = MARGIN + Math.random() * (arm.length - 2 * MARGIN);
      if (isHorizontal(arm.road)) {
        can.x = from.x + u;
        can.z = from.y + lateral;
      } else {
        can.x = from.x + lateral;
        can.z = from.y + u;
      }
      if (Math.hypot(can.x - px, can.z - pz) >= minDistance) break;
    }
    can.sprite.position.set(can.x, CAN_HEIGHT, can.z);
  }

  // Nouvelle partie : tous les bidons replacés, aucun tout près du joueur (px, pz)
  function reset(px, pz) {
    for (const can of cans) place(can, px, pz, START_MIN_DISTANCE);  }

  // Flottement des bidons et ramassage par la moto en (px, pz) (repère de la carte).
  // Renvoie le nombre de bidons ramassés pendant cette image.
  function update(time, px, pz) {
    let picked = 0;
    for (const can of cans) {
      can.sprite.position.y = CAN_HEIGHT + BOB_AMPLITUDE * Math.sin(time * BOB_SPEED + can.phase);
      if (Math.hypot(can.x - px, can.z - pz) < PICKUP_RADIUS) {
        picked++;
        place(can, px, pz, RESPAWN_MIN_DISTANCE);
      }
    }
    return picked;
  }

  return { reset, update };
}
