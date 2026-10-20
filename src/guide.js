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
// La ligne est fixe sur la route, comme un marquage au sol : elle ne suit pas les changements de couloir de la
// moto. Elle commence juste devant la roue avant et raccourcit à mesure que la moto avance, jusqu'à
// l'objectif. Le chemin n'est recalculé que lorsque la moto change de rue ou que les objectifs changent
// (géométrie créée une fois, aucune allocation dans la boucle de jeu).

const LINE_WIDTH = 0.9; // m (à peu près la largeur de la moto)
const LINE_HEIGHT = 0.05; // juste au-dessus de la chaussée
const MAX_POINTS = 64;
// Chevrons (comme une bande de flèches au sol) qui défilent vers l'objectif
const COLOR = 0x29c5ff; // bleu cyan
const EDGE_COLOR = 0xe8fbff; // liseré presque blanc
const CHEVRON_SPACING = 1.1; // m entre deux chevrons
const CHEVRON_THICKNESS = 0.42; // part de l'intervalle occupée par un chevron (0..1)
const CHEVRON_ANGLE = 0.45; // recul des bords du chevron par rapport à sa pointe (en intervalles)
const SCROLL_SPEED = 1.6; // m/s : défilement des chevrons vers l'objectif
const OPACITY = 0.9;
const START_AHEAD = 1.3; // m : la ligne commence à cette distance devant le centre de la moto (juste devant la roue avant)

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
  // Coordonnées du ruban pour le shader : x = position en travers (-1 à +1), y = distance le long du chemin (m)
  const lineCoords = new Float32Array(segmentsMax * 4 * 2);
  const lineAttribute = new THREE.BufferAttribute(lineCoords, 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('lineCoord', lineAttribute);
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setDrawRange(0, 0);
  const material = applyWorldBend(
    new THREE.MeshBasicMaterial({
      color: COLOR,
      transparent: true,
      opacity: OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  // Chevrons dessinés dans le shader : bandes en V (pointe vers l'objectif) répétées le long du chemin, qui
  // glissent avec le temps (uScroll) ; entre deux chevrons, le ruban est transparent
  const uScroll = { value: 0 };
  const bend = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    bend(shader, renderer);
    shader.uniforms.uScroll = uScroll;
    shader.uniforms.uEdgeColor = { value: new THREE.Color(EDGE_COLOR) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 lineCoord;\nvarying vec2 vLineCoord;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLineCoord = lineCoord;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vLineCoord;
        uniform float uScroll;
        uniform vec3 uEdgeColor;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Position dans l'intervalle courant : les bords (|x| = 1) sont en retrait de la pointe (x = 0)
        float q = fract((vLineCoord.y - uScroll) / ${CHEVRON_SPACING.toFixed(3)} + abs(vLineCoord.x) * ${CHEVRON_ANGLE.toFixed(3)});
        if (q > ${CHEVRON_THICKNESS.toFixed(3)}) discard;
        // Liseré clair à l'avant et à l'arrière du chevron
        float edge = min(q, ${CHEVRON_THICKNESS.toFixed(3)} - q);
        diffuseColor.rgb = mix(uEdgeColor, diffuseColor.rgb, smoothstep(0.02, 0.07, edge));`
      );
  };
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
    // Distance depuis le carrefour de départ de la rue ; pendant la traversée de ce carrefour, la moto n'a pas
    // encore atteint le début de la rue (valeur négative) : on compte 0
    const travelled = Math.max(0, leg.startOffset + (s - leg.sStart));
    let best = null;
    // Objectif plus loin sur la rue actuelle : tout droit (u = -1 : objectif pas sur cette rue)
    for (const t of objectives) {
      const u = targetOnArm(t, leg.from, leg.d, leg.from.arms[leg.d]);
      if (u >= 0 && u > travelled && (!best || u - travelled < best.cost)) best = { cost: u - travelled, target: t, end: null };
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

  // À chaque image : track = parcours du réseau, s = position de la moto. Le chemin (ligne brisée) n'est
  // recalculé que lorsque la moto change de rue ou que les objectifs changent ; le ruban, lui, est recoupé à
  // chaque image pour commencer juste devant la roue avant : il raccourcit à mesure que la moto avance.
  function update(track, s, time = 0) {
    if (!objectives.length) return;
    uScroll.value = time * SCROLL_SPEED;
    const leg = track.aheadLeg(s);
    if (dirty || leg !== routeLeg) {
      route = computeRoute(leg, s);
      routeLeg = leg;
      dirty = false;
      if (route) buildPath(leg);
    }
    if (!route) {
      mesh.visible = false;
      return;
    }
    // Distance déjà parcourue depuis l'entrée de la rue (début de la ligne), plus l'avance devant la roue
    buildRibbon(s - leg.sStart + START_AHEAD);
  }

  // Ligne brisée : entrée de la rue (couloir de droite), coins des carrefours, objectif
  function buildPath(leg) {
    pointCount = 0;
    let road = leg.road;
    const entry = laneOffset(road);
    addPoint(
      leg.from.x + leg.startOffset * DIR_X[leg.d] + entry * rightX(leg.d),
      leg.from.y + leg.startOffset * DIR_Y[leg.d] + entry * rightY(leg.d)
    );
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
  }

  // Ruban : un quadrilatère par segment de la ligne brisée, sans les trim premiers mètres (déjà dépassés).
  // Les segments sont prolongés d'une demi-largeur aux raccords (pas de trou dans les virages), mais pas au
  // début : la ligne commence pile à l'endroit voulu.
  function buildRibbon(trim) {
    const half = LINE_WIDTH / 2;
    let segments = 0;
    let skipped = 0; // longueur des segments entièrement dépassés
    let along = 0; // distance le long du chemin au début du segment (les chevrons restent liés à la route)
    for (let i = 0; i < pointCount - 1; i++) {
      let x1 = points[2 * i];
      let y1 = points[2 * i + 1];
      const x2 = points[2 * i + 2];
      const y2 = points[2 * i + 3];
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (length < 0.01) continue;
      const dx = (x2 - x1) / length;
      const dy = (y2 - y1) / length;
      let back = half; // prolongement vers l'arrière (raccord avec le segment précédent)
      const segmentStart = along;
      along += length;
      if (skipped + length <= trim) {
        skipped += length;
        continue;
      }
      let startAt = segmentStart; // distance le long du chemin du premier point dessiné
      if (trim > skipped) {
        // Segment coupé : il commence devant la roue avant
        x1 += dx * (trim - skipped);
        y1 += dy * (trim - skipped);
        startAt += trim - skipped;
        skipped = trim;
        back = 0;
      } else if (segments === 0) {
        back = 0;
      }
      const c = segments * 8;
      lineCoords[c] = 1;
      lineCoords[c + 1] = startAt - back;
      lineCoords[c + 2] = -1;
      lineCoords[c + 3] = startAt - back;
      lineCoords[c + 4] = 1;
      lineCoords[c + 5] = along + half;
      lineCoords[c + 6] = -1;
      lineCoords[c + 7] = along + half;
      const nx = -dy * half;
      const ny = dx * half;
      const o = segments * 12;
      positions[o] = x1 - dx * back + nx;
      positions[o + 1] = LINE_HEIGHT;
      positions[o + 2] = y1 - dy * back + ny;
      positions[o + 3] = x1 - dx * back - nx;
      positions[o + 4] = LINE_HEIGHT;
      positions[o + 5] = y1 - dy * back - ny;
      positions[o + 6] = x2 + dx * half + nx;
      positions[o + 7] = LINE_HEIGHT;
      positions[o + 8] = y2 + dy * half + ny;
      positions[o + 9] = x2 + dx * half - nx;
      positions[o + 10] = LINE_HEIGHT;
      positions[o + 11] = y2 + dy * half - ny;
      segments++;
    }
    positionAttribute.needsUpdate = true;
    lineAttribute.needsUpdate = true;
    geometry.setDrawRange(0, segments * 6);
    mesh.visible = segments > 0;
  }

  return { setObjectives, update };
}
