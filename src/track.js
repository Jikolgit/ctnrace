import * as THREE from 'three';
import { ROAD_HALF_WIDTH, CHUNK_LENGTH } from './road.js';

// Parcours : une suite de « rues » (lignes droites) reliées par des virages à 90°.
// Chaque rue part du centre d'un carrefour (origin) dans une direction (theta) et se termine
// au centre du carrefour suivant, où elle tourne à gauche (turn = -1) ou à droite (turn = +1).
//
// La position le long du parcours est une distance s (mètres) mesurée sur la ligne médiane.
// Dans un carrefour, la ligne médiane suit un quart de cercle de rayon TURN_RADIUS centré sur le
// coin intérieur du carrefour : chaque couloir garde sa place (intérieur serré, extérieur large).
//
// Repère : theta = rotation autour de Y ; direction = (-sin θ, 0, -cos θ) (θ = 0 : vers -Z),
// droite = (cos θ, 0, -sin θ). Tourner à droite = θ - 90°.

export const TURN_RADIUS = ROAD_HALF_WIDTH;
const ARC_LENGTH = (TURN_RADIUS * Math.PI) / 2;

const MIN_CHUNKS = 4; // longueur d'une rue : 4 à 9 tronçons de route de 20 m (+ le carrefour)
const MAX_CHUNKS = 9;
const AHEAD = 170; // rues créées jusqu'à cette distance devant le joueur
const BEHIND = 40; // une rue est retirée quand le joueur est à cette distance après son virage

// listener : { add(leg), remove(leg) } appelés quand une rue apparaît / disparaît
export function createTrack(listener) {
  const legs = [];

  function createLeg(prev) {
    const chunkCount = MIN_CHUNKS + Math.floor(Math.random() * (MAX_CHUNKS - MIN_CHUNKS + 1));
    const length = 2 * TURN_RADIUS + chunkCount * CHUNK_LENGTH; // de centre de carrefour à centre de carrefour

    let turn = Math.random() < 0.5 ? -1 : 1;
    // Jamais trois virages du même côté à la suite : le parcours reviendrait sur ses pas
    if (prev && prev.turn === turn && prev.prevTurn === turn) turn = -turn;

    const theta = prev ? prev.theta - prev.turn * (Math.PI / 2) : 0;
    const origin = prev
      ? prev.origin.clone().addScaledVector(prev.dir, prev.length)
      : new THREE.Vector3(0, 0, 0);
    const sStart = prev ? prev.sEnd : 0; // s au début de la ligne droite (sortie du carrefour)
    const sArcStart = sStart + length - 2 * TURN_RADIUS; // entrée dans le carrefour d'arrivée

    return {
      origin,
      theta,
      dir: new THREE.Vector3(-Math.sin(theta), 0, -Math.cos(theta)),
      right: new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta)),
      length,
      chunkCount,
      turn,
      prevTurn: prev ? prev.turn : 0, // 0 : première rue, pas de carrefour au départ
      sStart,
      sArcStart,
      sEnd: sArcStart + ARC_LENGTH,
    };
  }

  function legAt(s) {
    for (const leg of legs) {
      if (s < leg.sEnd) return leg;
    }
    return legs[legs.length - 1];
  }

  // Position (out) d'un point du parcours à la distance s, décalé latéralement de lateral
  // (> 0 : à droite). Renvoie la direction theta à cet endroit.
  function pose(s, lateral, out) {
    const leg = legAt(s);
    let theta;
    if (s <= leg.sArcStart) {
      theta = leg.theta;
      out.copy(leg.origin).addScaledVector(leg.dir, TURN_RADIUS + (s - leg.sStart));
    } else {
      const angle = (s - leg.sArcStart) / TURN_RADIUS;
      theta = leg.theta - leg.turn * angle;
      // Centre du quart de cercle : coin intérieur du carrefour
      out
        .copy(leg.origin)
        .addScaledVector(leg.dir, leg.length - TURN_RADIUS)
        .addScaledVector(leg.right, leg.turn * TURN_RADIUS);
      // Puis le rayon, du centre vers la ligne médiane
      out.x -= leg.turn * TURN_RADIUS * Math.cos(theta);
      out.z += leg.turn * TURN_RADIUS * Math.sin(theta);
    }
    out.x += lateral * Math.cos(theta);
    out.z -= lateral * Math.sin(theta);
    return theta;
  }

  // Crée les rues devant le joueur et retire celles laissées loin derrière
  function update(s) {
    if (legs.length === 0) {
      legs.push(createLeg(null));
      listener.add(legs[0]);
    }
    while (legs[legs.length - 1].sStart < s + AHEAD) {
      const leg = createLeg(legs[legs.length - 1]);
      legs.push(leg);
      listener.add(leg);
    }
    while (legs.length > 1 && legs[0].sEnd + BEHIND < s) {
      listener.remove(legs.shift());
    }
  }

  function reset(s) {
    while (legs.length) listener.remove(legs.shift());
    update(s);
  }

  return { update, reset, pose, legAt };
}
