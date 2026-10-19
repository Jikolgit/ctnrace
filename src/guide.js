import * as THREE from 'three';
import { applyWorldBend } from './worldBend.js';
import { ROADS, ROAD_TYPES } from './deliveryMap.js';
import { DIR_X, DIR_Y, halfWidth, laneWidthOf, isHorizontal } from './network.js';
import { deliveryPosition } from './deliveryPoints.js';

// Mode Livraison (premières missions) : ligne de guidage tracée sur la route, de la moto jusqu'à l'objectif le
// plus proche (chargement, ou livraison restante), par le chemin le plus court dans le réseau. Elle suit le
// couloir de droite de chaque rue et respecte les règles de conduite : pas de demi-tour en pleine rue,
// demi-tour aux carrefours seulement là où il est permis (grandes routes et rues pavées, pas les ruelles).
//
// Le chemin est recalculé quand la moto change de rue ou quand les objectifs changent ; à chaque image, seul
// le tracé est remis à jour (géométrie créée une fois, aucune allocation dans la boucle de jeu).

const LINE_WIDTH = 0.5; // m
const LINE_HEIGHT = 0.05; // juste au-dessus de la chaussée
const MAX_POINTS = 64;
const COLOR = 0x29c5ff;

// Décalage du couloir de droite par rapport à l'axe de la rue
const laneOffset = (road) => halfWidth(road) - laneWidthOf(road) / 2;
// Vecteur « droite » (repère de la carte) pour la direction d (0 nord, 1 est, 2 sud, 3 ouest)
const rightX = (d) => DIR_X[(d + 1) % 4];
const rightY = (d) => DIR_Y[(d + 1) % 4];

// parent : groupe de la ville de Livraison (repère de la carte : x → X, y → Z)
export function createGuide(parent) {
  // Ruban : un quadrilatère par segment de la ligne brisée
  const segmentsMax = MAX_POINTS - 1;
  const positions = new Float32Array(segmentsMax * 4 * 3);
  const indices = new Uint16Array(segmentsMax * 6);
  for (let i = 0; i < segmentsMax; i++) indices.set([4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 2, 4 * i + 1, 4 * i + 3], 6 * i);
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setDrawRange(0, 0);
  const material = applyWorldBend(
    new THREE.MeshBasicMaterial({ color: COLOR, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  parent.add(mesh);

  let objectives = []; // { road, at, pos: { x, y } }
  let route = null; // { target, chain: [{ node, inDir, outDir }] }
  let routeLeg = null; // rue (leg du parcours) pour laquelle le chemin a été calculé
  let dirty = true;
  const points = new Float32Array(MAX_POINTS * 2); // ligne brisée (x, y de la carte)
  let pointCount = 0;
  const playerPoint = new THREE.Vector3();

  // Objectifs : liste de points { road, at, side } (missions.js) ; liste vide = pas de ligne
  function setObjectives(list) {
    objectives = list.map((o) => ({ road: ROADS.find((r) => r.name === o.road), at: o.at, pos: deliveryPosition(o) }));
    dirty = true;
    if (!objectives.length) {
      route = null;
      mesh.visible = false;
    }
  }

  // Distance depuis node de l'objectif t s'il est sur le bras (node → direction d), sinon -1
  function targetOnArm(t, node, d, arm) {
    if (arm.road !== t.road) return -1;
    const from = isHorizontal(t.road) ? node.x : node.y;
    const sign = isHorizontal(t.road) ? DIR_X[d] : DIR_Y[d];
    const u = (t.at - from) * sign;
    return u > 0 && u < arm.length ? u : -1;
  }

  // Chemin le plus court depuis la moto (rue leg, position s) vers l'objectif le plus proche (Dijkstra sur les
  // états « carrefour + direction d'arrivée »)
  function computeRoute(leg, s) {
    const travelled = leg.startOffset + (s - leg.sStart);
    let best = null;
    // Objectif plus loin sur la rue actuelle : tout droit
    for (const t of objectives) {
      const u = targetOnArm(t, leg.from, leg.d, leg.from.arms[leg.d]);
      if (u > travelled && (!best || u - travelled < best.cost)) best = { cost: u - travelled, target: t, end: null };
    }
    const key = (node, d) => `${node.x},${node.y},${d}`;
    const dist = new Map();
    const prev = new Map();
    const queue = [{ node: leg.to, d: leg.d, cost: Math.max(0, leg.length - travelled) }];
    dist.set(key(leg.to, leg.d), queue[0].cost);
    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const state = queue.shift();
      if (state.cost > dist.get(key(state.node, state.d))) continue;
      if (best && state.cost >= best.cost) break;
      const arrivedOn = state.node.arms[(state.d + 2) % 4]?.road; // rue par laquelle on arrive
      for (let out = 0; out < 4; out++) {
        const arm = state.node.arms[out];
        if (!arm || arm.node.deadEnd) continue;
        // Demi-tour au carrefour : seulement si la rue d'arrivée le permet
        if (out === (state.d + 2) % 4 && !(arrivedOn && ROAD_TYPES[arrivedOn.type].uturn)) continue;
        for (const t of objectives) {
          const u = targetOnArm(t, state.node, out, arm);
          if (u >= 0 && (!best || state.cost + u < best.cost)) {
            best = { cost: state.cost + u, target: t, end: { node: state.node, d: state.d, out } };
          }
        }
        const cost = state.cost + arm.length;
        const k = key(arm.node, out);
        if (cost < (dist.get(k) ?? Infinity)) {
          dist.set(k, cost);
          prev.set(k, { node: state.node, d: state.d, out });
          queue.push({ node: arm.node, d: out, cost });
        }
      }
    }
    if (!best) return null;
    // Suite des carrefours à franchir, du plus proche au dernier
    const chain = [];
    if (best.end) {
      let step = best.end;
      chain.unshift({ node: step.node, inDir: step.d, outDir: step.out });
      let k = key(step.node, step.d);
      while (prev.has(k)) {
        step = prev.get(k);
        chain.unshift({ node: step.node, inDir: step.d, outDir: step.out });
        k = key(step.node, step.d);
      }
    }
    return { target: best.target, chain };
  }

  function addPoint(x, y) {
    if (pointCount >= MAX_POINTS) return;
    points[2 * pointCount] = x;
    points[2 * pointCount + 1] = y;
    pointCount++;
  }

  // À chaque image : track = parcours du réseau, s = position de la moto, lateral = son décalage latéral
  function update(track, s, lateral) {
    if (!objectives.length) return;
    const leg = track.aheadLeg(s);
    if (dirty || leg !== routeLeg) {
      route = computeRoute(leg, s);
      routeLeg = leg;
      dirty = false;
    }
    if (!route) {
      mesh.visible = false;
      return;
    }

    // Ligne brisée : moto, coins des carrefours (couloir de droite), objectif
    pointCount = 0;
    track.pose(s, lateral, playerPoint);
    addPoint(playerPoint.x, playerPoint.z);
    let road = leg.road;
    for (let i = 0; i < route.chain.length; i++) {
      const { node, inDir, outDir } = route.chain[i];
      const outRoad = node.arms[outDir].road;
      const a = laneOffset(road);
      const b = laneOffset(outRoad);
      if ((inDir + outDir) % 2 === 1) {
        // Virage à 90° : intersection des deux couloirs de droite
        addPoint(node.x + a * rightX(inDir) + b * rightX(outDir), node.y + a * rightY(inDir) + b * rightY(outDir));
      } else {
        // Tout droit ou demi-tour : on passe d'un couloir à l'autre au centre du carrefour
        addPoint(node.x + a * rightX(inDir), node.y + a * rightY(inDir));
        addPoint(node.x + b * rightX(outDir), node.y + b * rightY(outDir));
      }
      road = outRoad;
    }
    addPoint(route.target.pos.x, route.target.pos.y);

    // Ruban : un quadrilatère par segment, prolongé d'une demi-largeur aux deux bouts (raccords sans trou)
    const half = LINE_WIDTH / 2;
    let segments = 0;
    for (let i = 0; i < pointCount - 1; i++) {
      const x1 = points[2 * i];
      const y1 = points[2 * i + 1];
      const x2 = points[2 * i + 2];
      const y2 = points[2 * i + 3];
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (length < 0.01) continue;
      const dx = (x2 - x1) / length;
      const dy = (y2 - y1) / length;
      const nx = -dy * half;
      const ny = dx * half;
      const o = segments * 12;
      positions[o] = x1 - dx * half + nx;
      positions[o + 1] = LINE_HEIGHT;
      positions[o + 2] = y1 - dy * half + ny;
      positions[o + 3] = x1 - dx * half - nx;
      positions[o + 4] = LINE_HEIGHT;
      positions[o + 5] = y1 - dy * half - ny;
      positions[o + 6] = x2 + dx * half + nx;
      positions[o + 7] = LINE_HEIGHT;
      positions[o + 8] = y2 + dy * half + ny;
      positions[o + 9] = x2 + dx * half - nx;
      positions[o + 10] = LINE_HEIGHT;
      positions[o + 11] = y2 + dy * half - ny;
      segments++;
    }
    positionAttribute.needsUpdate = true;
    geometry.setDrawRange(0, segments * 6);
    mesh.visible = segments > 0;
  }

  return { setObjectives, update };
}
