import * as THREE from 'three';
import { ROADS, ROAD_TYPES, LANE_WIDTH, SIDEWALK_WIDTH } from './deliveryMap.js';

// Mode Livraison : graphe du réseau de routes (deliveryMap.js) et parcours du joueur dans ce réseau.
//
// Repère : x de la carte → X de Three.js, y de la carte (vers le sud) → Z. Le nord est donc vers -Z.
// Directions : 0 = nord, 1 = est, 2 = sud, 3 = ouest (sens horaire : +1 = tourner à droite).
// theta (comme track.js) = -d × 90° : direction = (-sin θ, 0, -cos θ).

export const NORTH = 0;
export const EAST = 1;
export const SOUTH = 2;
export const WEST = 3;
// Déplacement sur la carte pour chaque direction
export const DIR_X = [0, 1, 0, -1];
export const DIR_Y = [-1, 0, 1, 0];

export const halfWidth = (road) => (ROAD_TYPES[road.type].lanes * LANE_WIDTH) / 2;
export const isHorizontal = (road) => road.y !== undefined;

// Nœuds : carrefours et bouts de rue (impasses au bord de la carte). Chaque nœud connaît sa rue
// horizontale (h) et verticale (v) et ses « bras » : arms[d] = { node, road, length } ou null.
export function buildGraph() {
  const nodes = new Map();
  const nodeAt = (x, y) => {
    const key = `${x},${y}`;
    if (!nodes.has(key)) nodes.set(key, { x, y, h: null, v: null, arms: [null, null, null, null] });
    return nodes.get(key);
  };

  for (const road of ROADS) {
    // Points de la rue : ses deux bouts et ses croisements avec les rues perpendiculaires
    const along = isHorizontal(road) ? [road.x1, road.x2] : [road.y1, road.y2];
    for (const other of ROADS) {
      if (isHorizontal(other) === isHorizontal(road)) continue;
      if (isHorizontal(road)) {
        if (other.x >= road.x1 && other.x <= road.x2 && road.y >= other.y1 && road.y <= other.y2) along.push(other.x);
      } else if (other.y >= road.y1 && other.y <= road.y2 && road.x >= other.x1 && road.x <= other.x2) {
        along.push(other.y);
      }
    }
    const points = [...new Set(along)].sort((a, b) => a - b);
    const list = points.map((p) => (isHorizontal(road) ? nodeAt(p, road.y) : nodeAt(road.x, p)));
    for (const node of list) node[isHorizontal(road) ? 'h' : 'v'] = road;

    // Bras entre deux points consécutifs (de l'ouest vers l'est, ou du nord vers le sud)
    const [forward, backward] = isHorizontal(road) ? [EAST, WEST] : [SOUTH, NORTH];
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      const length = points[i] - points[i - 1];
      a.arms[forward] = { node: b, road, length };
      b.arms[backward] = { node: a, road, length };
    }
  }

  const all = [...nodes.values()];
  for (const node of all) {
    node.deadEnd = node.arms.filter(Boolean).length === 1;
    // Rayon du virage (ligne médiane) : plus large si une grande route passe par le carrefour
    node.radius = Math.max(node.h ? halfWidth(node.h) : 0, node.v ? halfWidth(node.v) : 0);
  }
  return { nodes: all, nodeAt: (x, y) => nodes.get(`${x},${y}`) };
}

// Point de départ du joueur : carrefour Rue 1451 × Route de l'Ouémé, en direction du nord
const START = { x: 240, y: 500, dir: NORTH, after: 6 }; // after : mètres après la sortie du carrefour
const BEHIND = 40; // une rue est oubliée quand le joueur est à cette distance après son virage

// Parcours dans le réseau, même interface que track.js : update, reset, pose, legAt, choose, pendingLeg.
// Une « rue » (leg) va du centre d'un carrefour au centre du suivant. Dans le carrefour d'arrivée, le joueur
// tourne (-1 gauche, +1 droite) sur un quart de cercle de rayon node.radius, ou va tout droit (0) s'il
// n'a rien choisi. Si tout droit est impossible (carrefour en T ou en L), il va dans le mur.
// Les bras qui mènent à une impasse (bord de la carte) ne sont jamais proposés.
export function createNetworkTrack(graph) {
  const legs = [];

  // from : nœud de départ ; d : direction ; theta : angle correspondant ; startOffset : distance après le
  // centre de from où commence la ligne droite (rayon du virage précédent) ; sStart : s à cet endroit.
  // theta n'est pas recalculé depuis d (-d × 90°) : il continue celui de la rue précédente (± 90°), sinon il
  // sauterait d'un tour complet entre le nord et l'ouest et la caméra, qui le suit avec retard, ferait
  // un tour autour de la moto.
  function createLeg(from, d, theta, startOffset, sStart) {
    const arm = from.arms[d];
    const to = arm.node;
    const options = [];
    for (const turn of [-1, 0, 1]) {
      const next = to.arms[(d + turn + 4) % 4];
      if (next && !next.node.deadEnd) options.push(turn);
    }
    // Rue transversale au carrefour d'arrivée : son trottoir d'en face est le « mur » si on va tout droit
    const cross = d === EAST || d === WEST ? to.v : to.h;
    const radius = to.radius;
    const sArcStart = sStart + arm.length - startOffset - radius;
    return {
      from,
      to,
      d,
      road: arm.road,
      lanes: ROAD_TYPES[arm.road.type].lanes,
      origin: new THREE.Vector3(from.x, 0, from.y),
      theta,
      dir: new THREE.Vector3(-Math.sin(theta), 0, -Math.cos(theta)),
      right: new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta)),
      length: arm.length,
      startOffset,
      radius,
      options,
      turn: undefined,
      sStart,
      sArcStart,
      sEnd: Infinity, // fixé au choix du virage
      // Distance après sArcStart où l'avant de la moto touche le mur d'en face (main.js)
      wallHit: radius + (cross ? halfWidth(cross) : 0) + SIDEWALK_WIDTH - 0.85,
    };
  }

  // Virage choisi au carrefour au bout de la dernière rue (-1, +1, ou 0 = tout droit)
  function choose(dir) {
    const leg = legs[legs.length - 1];
    if (leg.turn !== undefined) return;
    leg.turn = dir;
    if (!leg.options.includes(dir)) return; // tout droit impossible : la moto va dans le mur
    leg.sEnd = leg.sArcStart + (dir === 0 ? 2 * leg.radius : (leg.radius * Math.PI) / 2);
    legs.push(createLeg(leg.to, (leg.d + dir + 4) % 4, leg.theta - dir * (Math.PI / 2), leg.radius, leg.sEnd));
  }

  function legAt(s) {
    for (const leg of legs) {
      if (s < leg.sEnd) return leg;
    }
    return legs[legs.length - 1];
  }

  // Position (out) du point du parcours à la distance s, décalé latéralement de lateral (> 0 : à droite).
  // Renvoie la direction theta à cet endroit.
  function pose(s, lateral, out) {
    const leg = legAt(s);
    let theta = leg.theta;
    if (s <= leg.sArcStart || !leg.turn) {
      // Ligne droite (ou tout droit dans le carrefour)
      out.copy(leg.origin).addScaledVector(leg.dir, leg.startOffset + (s - leg.sStart));
    } else {
      const r = leg.radius;
      const angle = Math.min((s - leg.sArcStart) / r, Math.PI / 2);
      theta = leg.theta - leg.turn * angle;
      // Centre du quart de cercle : coin intérieur du carrefour
      out
        .copy(leg.origin)
        .addScaledVector(leg.dir, leg.length - r)
        .addScaledVector(leg.right, leg.turn * r);
      out.x -= leg.turn * r * Math.cos(theta);
      out.z += leg.turn * r * Math.sin(theta);
    }
    out.x += lateral * Math.cos(theta);
    out.z -= lateral * Math.sin(theta);
    return theta;
  }

  // Sans choix à l'entrée du carrefour : tout droit. Oublie les rues laissées loin derrière.
  function update(s) {
    const last = legs[legs.length - 1];
    if (last.turn === undefined && s >= last.sArcStart) choose(0);
    while (legs.length > 1 && legs[0].sEnd + BEHIND < s) legs.shift();
  }

  function reset(s) {
    legs.length = 0;
    const start = graph.nodeAt(START.x, START.y);
    legs.push(createLeg(start, START.dir, (-START.dir * Math.PI) / 2, start.radius, s - START.after));
  }

  // Rue en attente du choix du joueur (la dernière), ou null si le choix est fait
  function pendingLeg() {
    const leg = legs[legs.length - 1];
    return leg.turn === undefined ? leg : null;
  }

  return { update, reset, pose, legAt, choose, pendingLeg };
}
