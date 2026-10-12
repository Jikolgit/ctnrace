import * as THREE from 'three';
import { applyWorldBend } from './worldBend.js';
import { atlas, ROAD_RECT, ROAD_ASPECT } from './atlas.js';

// Couloirs
export const LANE_COUNT = 3;
export const LANE_WIDTH = 2;
export const laneX = (index) => (index - (LANE_COUNT - 1) / 2) * LANE_WIDTH;

// Tronçons de route recyclés
const CHUNK_LENGTH = 20;
const CHUNK_SEGMENTS = 10;
const CHUNK_COUNT = 6;
const LOOP_LENGTH = CHUNK_LENGTH * CHUNK_COUNT;
const RECYCLE_Z = 10 + CHUNK_LENGTH / 2; // tronçon entièrement derrière la caméra

// Géométries et matériaux partagés par tous les tronçons (aucune allocation en jeu)
const laneGeometry = new THREE.PlaneGeometry(
  LANE_WIDTH,
  CHUNK_LENGTH,
  1,
  CHUNK_SEGMENTS
);

// Pavés : motif pris dans l'atlas bikeTXT.jpg. Un motif couvre la largeur d'un couloir ; le nombre
// de répétitions en longueur est entier pour que le motif se raccorde d'un tronçon à l'autre.
// Une texture d'atlas ne peut pas se répéter seule : le shader replie les UV dans la zone des pavés
// (fract), et textureGrad garde le bon niveau de détail aux jonctions (sinon une ligne apparaît).
// La répétition passe par un uniform : on utilise directement l'atlas partagé (pas de copie de la
// texture, qui était signalée "sans image" tant que bikeTXT.jpg n'était pas chargé).
const ROAD_REPEAT = new THREE.Vector2(1, Math.round(CHUNK_LENGTH / (LANE_WIDTH * ROAD_ASPECT)));

const laneMaterial = applyWorldBend(
  new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.9, metalness: 0 })
);
const bend = laneMaterial.onBeforeCompile;
laneMaterial.onBeforeCompile = (shader, renderer) => {
  bend(shader, renderer);
  shader.uniforms.uRoadRect = { value: ROAD_RECT };
  shader.uniforms.uRoadRepeat = { value: ROAD_REPEAT };
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
const laneMaterials = Array(LANE_COUNT).fill(laneMaterial);

function createChunk() {
  const chunk = new THREE.Group();

  for (let i = 0; i < LANE_COUNT; i++) {
    const lane = new THREE.Mesh(laneGeometry, laneMaterials[i]);
    lane.rotation.x = -Math.PI / 2;
    lane.position.x = laneX(i);
    chunk.add(lane);
  }

  return chunk;
}

export function createRoad(scene) {
  const chunks = [];

  for (let i = 0; i < CHUNK_COUNT; i++) {
    const chunk = createChunk();
    chunk.position.z = -i * CHUNK_LENGTH;
    scene.add(chunk);
    chunks.push(chunk);
  }

  // Fait défiler la route vers le joueur et recycle les tronçons dépassés
  function update(delta, speed) {
    const step = speed * delta;

    for (const chunk of chunks) {
      chunk.position.z += step;

      if (chunk.position.z > RECYCLE_Z) {
        chunk.position.z -= LOOP_LENGTH;
      }
    }
  }

  return { update };
}
