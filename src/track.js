import * as THREE from 'three';
import { ROAD_HALF_WIDTH, CHUNK_LENGTH } from './road.js';

// Parcours : une suite de « rues » (lignes droites) reliées par des carrefours.
// Chaque rue part du centre d'un carrefour (origin) dans une direction (theta) et se termine
// au centre du carrefour suivant :
//  - carrefour en L : un seul côté possible (options = [-1] gauche ou [+1] droite) ;
//  - carrefour en T : les deux côtés (options = [-1, +1]).
// C'est le joueur qui choisit le virage (choose) dans les derniers mètres avant le carrefour.
// Les rues qui partent du prochain carrefour (une par option, les « branches ») sont créées à l'avance
// pour qu'on les voie en approchant ; au choix, la branche prise devient la rue suivante et l'autre
// disparaît. Sans choix, la moto continue tout droit (turn = 0) : elle va dans le mur.
//
// La position le long du parcours est une distance s (mètres) mesurée sur la ligne médiane.
// Dans un virage, la ligne médiane suit un quart de cercle de rayon TURN_RADIUS centré sur le
// coin intérieur du carrefour : chaque couloir garde sa place (intérieur serré, extérieur large).
//
// Repère : theta = rotation autour de Y ; direction = (-sin θ, 0, -cos θ) (θ = 0 : vers -Z),
// droite = (cos θ, 0, -sin θ). Tourner à droite = θ - 90°.

export const TURN_RADIUS = ROAD_HALF_WIDTH;
const ARC_LENGTH = (TURN_RADIUS * Math.PI) / 2;

const MIN_CHUNKS = 4; // longueur d'une rue : 4 à 9 tronçons de route de 20 m (+ le carrefour)
const MAX_CHUNKS = 9;
const T_CHANCE = 0.4; // probabilité d'un carrefour en T
const BEHIND = 40; // une rue est retirée quand le joueur est à cette distance après son virage

// listener : { add(leg), remove(leg) } appelés quand une rue apparaît / disparaît
export function createTrack(listener) {
  const legs = []; // rues du chemin suivi ; la dernière attend le choix du joueur

  // prev : rue précédente (null pour la première) ; dir : virage pris au carrefour de départ
  function createLeg(prev, dir) {
    const chunkCount = MIN_CHUNKS + Math.floor(Math.random() * (MAX_CHUNKS - MIN_CHUNKS + 1));
    const length = 2 * TURN_RADIUS + chunkCount * CHUNK_LENGTH; // de centre de carrefour à centre de carrefour

    let options;
    if (Math.random() < T_CHANCE) {
      options = [-1, 1];
    } else {
      let side = Math.random() < 0.5 ? -1 : 1;
      // Jamais trois virages du même côté imposés à la suite : le parcours reviendrait sur ses pas
      if (prev && dir === side && prev.prevTurn === side) side = -side;
      options = [side];
    }

    const theta = prev ? prev.theta - dir * (Math.PI / 2) : 0;
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
      options,
      isT: options.length === 2,
      turn: undefined, // virage choisi au carrefour d'arrivée : -1, +1, ou 0 (tout droit, dans le mur)
      branches: null,
      prevTurn: dir, // 0 : première rue, pas de carrefour au départ
      sStart,
      sArcStart,
      sEnd: sArcStart + ARC_LENGTH,
    };
  }

  // Crée les rues possibles après le carrefour au bout de leg
  function createBranches(leg) {
    leg.branches = new Map();
    for (const dir of leg.options) {
      const branch = createLeg(leg, dir);
      leg.branches.set(dir, branch);
      listener.add(branch);
    }
  }

  // Virage choisi au carrefour au bout de la dernière rue (-1, +1, ou 0 = pas de virage)
  function choose(dir) {
    const leg = legs[legs.length - 1];
    if (leg.turn !== undefined) return;
    leg.turn = dir;
    for (const [side, branch] of leg.branches) {
      if (side !== dir) listener.remove(branch);
    }
    if (dir !== 0) {
      const next = leg.branches.get(dir);
      legs.push(next);
      createBranches(next);
    }
    leg.branches = null;
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
    let theta = leg.theta;
    if (s <= leg.sArcStart || !leg.turn) {
      // Ligne droite (ou pas de virage : on continue tout droit dans le carrefour)
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

  // Applique l'absence de choix à l'entrée du carrefour et retire les rues laissées loin derrière
  function update(s) {
    if (legs.length === 0) {
      legs.push(createLeg(null, 0));
      listener.add(legs[0]);
      createBranches(legs[0]);
    }
    const last = legs[legs.length - 1];
    if (last.turn === undefined && s >= last.sArcStart) choose(0);
    while (legs.length > 1 && legs[0].sEnd + BEHIND < s) {
      listener.remove(legs.shift());
    }
  }

  function reset(s) {
    for (const leg of legs) {
      listener.remove(leg);
      if (leg.branches) for (const branch of leg.branches.values()) listener.remove(branch);
    }
    legs.length = 0;
    update(s);
  }

  // Rue en attente du choix du joueur (la dernière), ou null si le choix est fait
  function pendingLeg() {
    const leg = legs[legs.length - 1];
    return leg.turn === undefined ? leg : null;
  }

  return { update, reset, pose, legAt, choose, pendingLeg };
}
