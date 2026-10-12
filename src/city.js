import * as THREE from 'three';
import { applyWorldBend } from './worldBend.js';
import { LANE_COUNT, LANE_WIDTH } from './road.js';

// Décor de ville : trottoirs et bâtiments (simples boîtes) de chaque côté de la route.
// Les bâtiments défilent comme la route et sont recyclés : une fois derrière la caméra,
// un bâtiment repart au bout de sa rangée avec une nouvelle taille et une nouvelle couleur.

const ROAD_EDGE = (LANE_COUNT * LANE_WIDTH) / 2; // bord de la route : x = ±3
const SIDEWALK_WIDTH = 1.5;
const SIDEWALK_HEIGHT = 0.12;
const BUILDING_START = ROAD_EDGE + SIDEWALK_WIDTH; // façades alignées au bord du trottoir

const FAR_Z = -130; // au-delà du brouillard : les bâtiments y apparaissent sans être vus
const RECYCLE_Z = 12; // bâtiment entièrement derrière la caméra (z = 6)
const BUILDINGS_PER_SIDE = 24;

// Dimensions aléatoires (mètres)
const LENGTH_MIN = 4; // longueur le long de la route
const LENGTH_MAX = 11;
const DEPTH_MIN = 5; // profondeur en s'éloignant de la route
const DEPTH_MAX = 10;
const HEIGHT_MIN = 4;
const HEIGHT_MAX = 22;
const GAP_MAX = 1.5; // ruelle éventuelle entre deux bâtiments

const randomRange = (min, max) => min + Math.random() * (max - min);

// Une seule géométrie de cube 1 × 1 × 1, base posée au sol : chaque bâtiment la redimensionne
const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
buildingGeometry.translate(0, 0.5, 0);

// Palette de façades (béton, brique, crépi...), matériaux partagés
const BUILDING_COLORS = [0xb8b2a7, 0x9c8f80, 0xc9a27e, 0x8a9199, 0xa0624b, 0xd8d2c4, 0x6f7782, 0xbfae8e];
const buildingMaterials = BUILDING_COLORS.map((color) =>
  applyWorldBend(new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }))
);

// Trottoirs et sol : fixes et de couleur unie, ils n'ont pas besoin de défiler.
// Beaucoup de subdivisions en longueur pour qu'ils suivent la courbure du monde.
const STRIP_LENGTH = RECYCLE_Z - FAR_Z;
const STRIP_SEGMENTS = 60;
const sidewalkMaterial = applyWorldBend(
  new THREE.MeshStandardMaterial({ color: 0xa9a9a4, roughness: 1, metalness: 0 })
);
const groundMaterial = applyWorldBend(
  new THREE.MeshStandardMaterial({ color: 0x5c5c5c, roughness: 1, metalness: 0 })
);

function createStrips(scene, side) {
  const centerZ = (RECYCLE_Z + FAR_Z) / 2;

  const sidewalk = new THREE.Mesh(
    new THREE.BoxGeometry(SIDEWALK_WIDTH, SIDEWALK_HEIGHT, STRIP_LENGTH, 1, 1, STRIP_SEGMENTS),
    sidewalkMaterial
  );
  sidewalk.position.set(side * (ROAD_EDGE + SIDEWALK_WIDTH / 2), SIDEWALK_HEIGHT / 2, centerZ);
  scene.add(sidewalk);

  // Sol sous les bâtiments (visible dans les ruelles), jusqu'à 40 m de la route
  const groundWidth = 40;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundWidth, STRIP_LENGTH, 1, STRIP_SEGMENTS),
    groundMaterial
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(side * (BUILDING_START + groundWidth / 2), 0.01, centerZ);
  scene.add(ground);
}

export function createCity(scene) {
  const rows = [];

  for (const side of [-1, 1]) {
    createStrips(scene, side);

    const row = { side, buildings: [], farthestZ: RECYCLE_Z };
    for (let i = 0; i < BUILDINGS_PER_SIDE; i++) {
      const building = new THREE.Mesh(buildingGeometry, buildingMaterials[0]);
      scene.add(building);
      row.buildings.push(building);
      placeBuilding(row, building);
    }
    rows.push(row);
  }

  // Place un bâtiment juste après le plus lointain de sa rangée, avec une taille et une couleur au hasard
  function placeBuilding(row, building) {
    const length = randomRange(LENGTH_MIN, LENGTH_MAX);
    const depth = randomRange(DEPTH_MIN, DEPTH_MAX);
    const height = randomRange(HEIGHT_MIN, HEIGHT_MAX);
    const gap = Math.random() < 0.4 ? randomRange(0.5, GAP_MAX) : 0;

    building.scale.set(depth, height, length);
    building.position.set(
      row.side * (BUILDING_START + depth / 2),
      0,
      row.farthestZ - gap - length / 2
    );
    building.material = buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)];
    row.farthestZ = building.position.z - length / 2;
  }

  // Fait défiler les bâtiments vers le joueur et recycle ceux dépassés
  function update(delta, speed) {
    const step = speed * delta;

    for (const row of rows) {
      row.farthestZ += step;
      for (const building of row.buildings) {
        building.position.z += step;
        if (building.position.z - building.scale.z / 2 > RECYCLE_Z) {
          placeBuilding(row, building);
        }
      }
    }
  }

  return { update };
}
