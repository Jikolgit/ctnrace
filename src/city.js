import * as THREE from 'three';
import { applyWorldBend } from './worldBend.js';
import { ROAD_HALF_WIDTH, SIDEWALK_WIDTH } from './road.js';

// Décor de ville : bâtiments (simples boîtes) le long de chaque rue du parcours (track.js).
// Les bâtiments d'une rue sont posés quand la rue apparaît et rendus au pool quand elle disparaît.
//
// Aux carrefours :
//  - côté où part une rue (les deux côtés pour un T) : la rangée s'arrête au trottoir de la rue
//    transversale ; son dernier bâtiment est profond (DEPTH_MAX) pour former l'angle de rue ;
//  - côté fermé (carrefour en L) : la rangée continue jusqu'au bout du carrefour ;
//  - au bout de la rue, des bâtiments hauts ferment le carrefour (« mur ») : on le voit approcher et on
//    comprend que la route tourne. Il appartient à la rue d'arrivée : il reste en place quel que soit
//    le virage choisi. Les rues suivantes commencent donc leurs rangées après ce mur.

const BUILDING_START = ROAD_HALF_WIDTH + SIDEWALK_WIDTH; // façades alignées au bord du trottoir : ±4,5

// Dimensions aléatoires (mètres)
const LENGTH_MIN = 4; // longueur le long de la rue
const LENGTH_MAX = 11;
const DEPTH_MIN = 5; // profondeur en s'éloignant de la rue
const DEPTH_MAX = 10;
const HEIGHT_MIN = 4;
const HEIGHT_MAX = 22;
const END_WALL_HEIGHT_MIN = 10; // bâtiments qui ferment le bout d'une rue
const END_WALL_HALF_WIDTH = BUILDING_START + DEPTH_MAX; // le mur couvre aussi les angles de rue
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

  // Bâtiment dans le repère de la rue leg : centre à la distance u le long de la rue et au décalage
  // latéral v ; width = taille latérale, length = taille le long de la rue
  function placeBuilding(leg, u, v, width, length, height) {
    const building = getBuilding();
    building.scale.set(width, height, length);
    building.position.copy(leg.origin).addScaledVector(leg.dir, u).addScaledVector(leg.right, v);
    building.rotation.y = leg.theta;
    building.material = buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)];
    leg.buildings.push(building);
  }

  // Remplit [from, to] de morceaux de LENGTH_MIN à LENGTH_MAX, avec des ruelles éventuelles (gaps) ;
  // piece(début, longueur, estLeDernier) place chaque morceau
  function fill(from, to, gaps, piece) {
    let u = from;
    while (to - u > 0.01) {
      if (gaps && Math.random() < GAP_CHANCE && to - u > GAP_MAX + 2 * LENGTH_MIN) {
        u += randomRange(GAP_MIN, GAP_MAX);
      }
      let length = randomRange(LENGTH_MIN, LENGTH_MAX);
      if (to - u - length < LENGTH_MIN) length = to - u; // le dernier finit pile au bout
      piece(u, length, u + length >= to - 0.01);
      u += length;
    }
  }

  function addLeg(leg) {
    leg.buildings = [];

    for (const side of [-1, 1]) {
      // Première rue : commence derrière la caméra ; sinon après le mur du carrefour précédent
      const uStart = leg.prevTurn === 0 ? -10 : END_WALL_HALF_WIDTH;
      // Côté où part une rue : s'arrête à la rue transversale ; côté fermé : jusqu'au bout
      const open = leg.options.includes(side);
      const uEnd = open ? leg.length - BUILDING_START : leg.length + BUILDING_START;

      fill(uStart, uEnd, true, (u, length, last) => {
        const depth = open && last ? DEPTH_MAX : randomRange(DEPTH_MIN, DEPTH_MAX);
        const height = randomRange(HEIGHT_MIN, HEIGHT_MAX);
        placeBuilding(leg, u + length / 2, side * (BUILDING_START + depth / 2), depth, length, height);
      });
    }

    // Mur au bout de la rue, de l'autre côté du carrefour, sur toute la largeur (sans ruelle : on verrait
    // le ciel au travers)
    const depth = randomRange(DEPTH_MIN, DEPTH_MAX);
    fill(-END_WALL_HALF_WIDTH, END_WALL_HALF_WIDTH, false, (v, width) => {
      const height = randomRange(END_WALL_HEIGHT_MIN, HEIGHT_MAX);
      placeBuilding(leg, leg.length + BUILDING_START + depth / 2, v + width / 2, width, depth, height);
    });
  }

  function removeLeg(leg) {
    for (const building of leg.buildings) {
      building.visible = false;
      free.push(building);
    }
  }

  return { addLeg, removeLeg };
}
