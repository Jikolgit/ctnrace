import * as THREE from 'three';
import { applyWorldBend } from './worldBend.js';
import { ROAD_HALF_WIDTH, SIDEWALK_WIDTH } from './road.js';

// Décor de ville : bâtiments (simples boîtes) le long de chaque rue du parcours (track.js).
// Les bâtiments d'une rue sont posés quand la rue apparaît et rendus au pool quand elle disparaît.
//
// Aux carrefours (virage à droite, en miroir à gauche) :
//  - côté intérieur du virage : la rangée s'arrête au trottoir de la rue transversale ;
//    son dernier bâtiment est profond (DEPTH_MAX) pour former l'angle de rue ;
//  - côté extérieur : la rangée continue jusqu'au bout du carrefour ;
//  - la rue suivante commence, côté extérieur, par des bâtiments hauts qui ferment le bout de la rue
//    d'arrivée : on voit le mur approcher et on comprend que la route tourne.

const BUILDING_START = ROAD_HALF_WIDTH + SIDEWALK_WIDTH; // façades alignées au bord du trottoir : ±4,5

// Dimensions aléatoires (mètres)
const LENGTH_MIN = 4; // longueur le long de la rue
const LENGTH_MAX = 11;
const DEPTH_MIN = 5; // profondeur en s'éloignant de la rue
const DEPTH_MAX = 10;
const HEIGHT_MIN = 4;
const HEIGHT_MAX = 22;
const END_WALL_HEIGHT_MIN = 10; // bâtiments qui ferment le bout d'une rue
const GAP_CHANCE = 0.4; // probabilité d'une ruelle avant un bâtiment
const GAP_MIN = 0.5;
const GAP_MAX = 1.5;

const randomRange = (min, max) => min + Math.random() * (max - min);

// Une seule géométrie de cube 1 × 1 × 1, base posée au sol : chaque bâtiment la redimensionne
const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
buildingGeometry.translate(0, 0.5, 0);

// Palette de façades (béton, brique, crépi...), matériaux partagés
const BUILDING_COLORS = [0xb8b2a7, 0x9c8f80, 0xc9a27e, 0x8a9199, 0xa0624b, 0xd8d2c4, 0x6f7782, 0xbfae8e];
const buildingMaterials = BUILDING_COLORS.map((color) =>
  applyWorldBend(new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }))
);

// Sol uni sous toute la ville. Il reste fixe sous la caméra (pas dans le groupe world) :
// étant d'une seule couleur, on ne le voit pas « ne pas bouger ».
function createGround(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: 0x5c5c5c, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03; // juste sous la route
  scene.add(ground);
}

export function createCity(scene, world) {
  createGround(scene);

  const free = [];
  function getBuilding() {
    const building = free.pop() ?? new THREE.Mesh(buildingGeometry, buildingMaterials[0]);
    building.visible = true;
    world.add(building);
    return building;
  }
  // Préremplissage du pool : évite de créer des bâtiments pendant la partie
  const warm = [];
  for (let i = 0; i < 220; i++) warm.push(getBuilding());
  for (const building of warm) {
    building.visible = false;
    free.push(building);
  }

  // Bâtiment le long de la rue leg, côté side (-1 gauche, +1 droite), centré en u (distance depuis
  // le centre du carrefour de départ, le long de la rue)
  function placeBuilding(leg, side, u, length, depth, height) {
    const building = getBuilding();
    building.scale.set(depth, height, length);
    building.position
      .copy(leg.origin)
      .addScaledVector(leg.dir, u)
      .addScaledVector(leg.right, side * (BUILDING_START + depth / 2));
    building.rotation.y = leg.theta;
    building.material = buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)];
    leg.buildings.push(building);
  }

  function addLeg(leg) {
    leg.buildings = [];

    for (const side of [-1, 1]) {
      // Début de la rangée
      let u;
      if (leg.prevTurn === 0) u = -10; // première rue : commence derrière la caméra
      else if (side === leg.prevTurn) u = BUILDING_START + DEPTH_MAX; // après l'angle de rue
      else u = -BUILDING_START - DEPTH_MAX; // ferme le bout de la rue précédente

      // Fin de la rangée
      const inner = side === leg.turn;
      const uEnd = inner ? leg.length - BUILDING_START : leg.length + BUILDING_START;

      while (uEnd - u > 0.01) {
        if (Math.random() < GAP_CHANCE && uEnd - u > GAP_MAX + 2 * LENGTH_MIN) {
          u += randomRange(GAP_MIN, GAP_MAX);
        }
        let length = randomRange(LENGTH_MIN, LENGTH_MAX);
        if (uEnd - u - length < LENGTH_MIN) length = uEnd - u; // le dernier finit pile au carrefour
        const last = u + length >= uEnd - 0.01;

        const depth = inner && last ? DEPTH_MAX : randomRange(DEPTH_MIN, DEPTH_MAX);
        let height = randomRange(HEIGHT_MIN, HEIGHT_MAX);
        if (u + length / 2 < BUILDING_START) height = Math.max(height, END_WALL_HEIGHT_MIN);

        placeBuilding(leg, side, u + length / 2, length, depth, height);
        u += length;
      }
    }
  }

  function removeLeg(leg) {
    for (const building of leg.buildings) {
      building.visible = false;
      free.push(building);
    }
  }

  return { addLeg, removeLeg };
}
