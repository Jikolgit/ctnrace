import * as THREE from 'three';
import { applyWorldBend } from './worldBend.js';
import { atlas, ROAD_RECT, ROAD_ASPECT } from './atlas.js';

// Couloirs
export const LANE_COUNT = 3;
export const LANE_WIDTH = 2;
export const laneX = (index) => (index - (LANE_COUNT - 1) / 2) * LANE_WIDTH;
export const ROAD_HALF_WIDTH = (LANE_COUNT * LANE_WIDTH) / 2; // bord de la route : ±3

// Trottoirs
export const SIDEWALK_WIDTH = 1.5;
const SIDEWALK_HEIGHT = 0.12;
const SIDEWALK_EDGE = ROAD_HALF_WIDTH + SIDEWALK_WIDTH; // ±4,5 : début des bâtiments

// Tronçons de route : une rue (track.js) est une suite de tronçons de 20 m, puis un carrefour
export const CHUNK_LENGTH = 20;
const CHUNK_SEGMENTS = 10; // subdivisions en longueur, pour suivre la courbure du monde

// Pavés : motif pris dans l'atlas bikeTXT.jpg. Un motif couvre la largeur d'un couloir ; le nombre
// de répétitions en longueur est entier pour que le motif se raccorde d'un tronçon à l'autre.
// Une texture d'atlas ne peut pas se répéter seule : le shader replie les UV dans la zone des pavés
// (fract), et textureGrad garde le bon niveau de détail aux jonctions (sinon une ligne apparaît).
// La répétition passe par un uniform : on utilise directement l'atlas partagé (pas de copie de la
// texture, qui était signalée "sans image" tant que bikeTXT.jpg n'était pas chargé).
const ROAD_REPEAT = new THREE.Vector2(1, Math.round(CHUNK_LENGTH / (LANE_WIDTH * ROAD_ASPECT)));

function createPavedMaterial(repeat) {
  const material = applyWorldBend(
    new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.9, metalness: 0 })
  );
  const bend = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    bend(shader, renderer);
    shader.uniforms.uRoadRect = { value: ROAD_RECT };
    shader.uniforms.uRoadRepeat = { value: repeat };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uRoadRect;\nuniform vec2 uRoadRepeat;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec2 tiledUv = vMapUv * uRoadRepeat;
          vec2 roadUv = uRoadRect.xy + fract(tiledUv) * uRoadRect.zw;
          vec2 roadDx = dFdx(tiledUv) * uRoadRect.zw;
          vec2 roadDy = dFdy(tiledUv) * uRoadRect.zw;
          diffuseColor *= textureGrad(map, roadUv, roadDx, roadDy);
        #endif`
      );
  };
  // Deux matériaux de pavés ont des répétitions différentes : programmes distincts
  material.customProgramCacheKey = () => `paved-${repeat.x}-${repeat.y}`;
  return material;
}

const laneMaterial = createPavedMaterial(ROAD_REPEAT);
// Carrefour carré (largeur de la route des deux côtés) : même taille de pavés que les couloirs
const ROAD_WIDTH = 2 * ROAD_HALF_WIDTH;
const crossingMaterial = createPavedMaterial(
  new THREE.Vector2(LANE_COUNT, (ROAD_REPEAT.y * ROAD_WIDTH) / CHUNK_LENGTH)
);

const sidewalkMaterial = applyWorldBend(
  new THREE.MeshStandardMaterial({ color: 0xa9a9a4, roughness: 1, metalness: 0 })
);

// Géométries partagées (aucune allocation en jeu)
const laneGeometry = new THREE.PlaneGeometry(LANE_WIDTH, CHUNK_LENGTH, 1, CHUNK_SEGMENTS);
laneGeometry.rotateX(-Math.PI / 2);
const crossingGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_WIDTH, 1, 3);
crossingGeometry.rotateX(-Math.PI / 2);
const sidewalkGeometry = new THREE.BoxGeometry(SIDEWALK_WIDTH, SIDEWALK_HEIGHT, CHUNK_LENGTH, 1, 1, CHUNK_SEGMENTS);
sidewalkGeometry.translate(0, SIDEWALK_HEIGHT / 2, 0);
const blockGeometry = new THREE.BoxGeometry(1, SIDEWALK_HEIGHT, 1); // morceaux de trottoir des carrefours
blockGeometry.translate(0, SIDEWALK_HEIGHT / 2, 0);

// Tronçon droit : 3 couloirs + 2 trottoirs. Repère local : la route va vers -Z.
function createChunk() {
  const chunk = new THREE.Group();
  for (let i = 0; i < LANE_COUNT; i++) {
    const lane = new THREE.Mesh(laneGeometry, laneMaterial);
    lane.position.x = laneX(i);
    chunk.add(lane);
  }
  for (const side of [-1, 1]) {
    const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
    sidewalk.position.x = side * (ROAD_HALF_WIDTH + SIDEWALK_WIDTH / 2);
    chunk.add(sidewalk);
  }
  return chunk;
}

// Morceau de trottoir rectangulaire entre (x1, z1) et (x2, z2), dans le repère du carrefour
function addBlock(group, x1, x2, z1, z2) {
  const block = new THREE.Mesh(blockGeometry, sidewalkMaterial);
  block.scale.set(Math.abs(x2 - x1), 1, Math.abs(z2 - z1));
  block.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
  group.add(block);
}

// Carrefour d'un virage à droite (centre en 0, on arrive par +Z en roulant vers -Z, on repart vers +X).
// Un virage à gauche utilise le même carrefour en miroir (scale.x = -1).
function createCorner() {
  const corner = new THREE.Group();
  corner.add(new THREE.Mesh(crossingGeometry, crossingMaterial));
  const r = ROAD_HALF_WIDTH;
  const e = SIDEWALK_EDGE;
  addBlock(corner, -e, -r, -e, r); // côté extérieur (gauche), jusqu'au fond
  addBlock(corner, -r, r, -e, -r); // fond du carrefour, face à la rue d'arrivée
  addBlock(corner, r, e, r, e); // petit coin intérieur
  return corner;
}

// Carrefour en T : on arrive par +Z, on repart vers -X ou +X ; le fond (côté -Z) est fermé.
function createTCorner() {
  const corner = new THREE.Group();
  corner.add(new THREE.Mesh(crossingGeometry, crossingMaterial));
  const r = ROAD_HALF_WIDTH;
  const e = SIDEWALK_EDGE;
  addBlock(corner, -r, r, -e, -r); // fond du carrefour, face à la rue d'arrivée
  addBlock(corner, r, e, r, e); // coins intérieurs, de part et d'autre de la rue d'arrivée
  addBlock(corner, -e, -r, r, e);
  return corner;
}

// Pool d'objets : créés à la demande puis réutilisés
function createPool(scene, factory) {
  const free = [];
  return {
    get() {
      const object = free.pop() ?? factory();
      object.visible = true;
      scene.add(object);
      return object;
    },
    release(object) {
      object.visible = false;
      free.push(object);
    },
  };
}

// world : groupe qui porte tout le décor (il est déplacé/tourné pour que le joueur reste en 0)
export function createRoad(world) {
  const chunks = createPool(world, createChunk);
  const corners = createPool(world, createCorner);
  const tCorners = createPool(world, createTCorner);
  // Préremplissage : évite de créer des objets pendant la partie
  const warm = [];
  for (let i = 0; i < 30; i++) warm.push(chunks.get());
  warm.forEach((c) => chunks.release(c));
  for (let i = 0; i < 4; i++) corners.release(corners.get());
  for (let i = 0; i < 4; i++) tCorners.release(tCorners.get());

  function addLeg(leg) {
    leg.roadPieces = [];
    for (let i = 0; i < leg.chunkCount; i++) {
      const chunk = chunks.get();
      chunk.position
        .copy(leg.origin)
        .addScaledVector(leg.dir, ROAD_HALF_WIDTH + (i + 0.5) * CHUNK_LENGTH);
      chunk.rotation.y = leg.theta;
      leg.roadPieces.push(chunk);
    }
    const corner = leg.isT ? tCorners.get() : corners.get();
    corner.position.copy(leg.origin).addScaledVector(leg.dir, leg.length);
    corner.rotation.y = leg.theta;
    corner.scale.x = leg.isT ? 1 : leg.options[0]; // carrefour en L : miroir pour un virage à gauche
    leg.corner = corner;
  }

  function removeLeg(leg) {
    for (const chunk of leg.roadPieces) chunks.release(chunk);
    (leg.isT ? tCorners : corners).release(leg.corner);
  }

  return { addLeg, removeLeg };
}
