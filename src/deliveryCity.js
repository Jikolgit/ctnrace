import * as THREE from 'three';
import { applyWorldBend } from './worldBend.js';
import {
  CHUNK_LENGTH, ROAD_REPEAT, SIDEWALK_HEIGHT, createPavedMaterial, sidewalkMaterial,
} from './road.js';
import { SIDEWALK_WIDTH, ROAD_TYPES, STATIONS } from './deliveryMap.js';
import { stationLot } from './stations.js';
import { NORTH, EAST, SOUTH, WEST, DIR_X, DIR_Y, halfWidth, medianWidth, isHorizontal } from './network.js';

// Mode Livraison : la ville entière, construite une fois au démarrage (pas de recyclage : le réseau est fixe).
// Petites rues pavées (3 couloirs), grandes routes goudronnées (4 couloirs), ruelles à petits pavés (2 couloirs), carrefours, trottoirs et
// bâtiments (boîtes) le long de chaque rue. Repère : x de la carte → X, y de la carte → Z.
//
// Angles de rue : les rangées de bâtiments des rues horizontales vont jusqu'au trottoir de la rue
// transversale, avec un dernier bâtiment profond (DEPTH_MAX) qui forme l'angle ; celles des rues
// verticales s'arrêtent DEPTH_MAX plus tôt (pas de façades superposées). Là où le carrefour n'a pas de
// rue d'un côté (T, L), la rangée continue jusqu'au centre et rejoint celle d'en face.

const LENGTH_MIN = 4; // longueur d'un bâtiment le long de la rue
const LENGTH_MAX = 11;
const DEPTH_MIN = 5; // profondeur en s'éloignant de la rue
const DEPTH_MAX = 10;
const HEIGHT_MIN = 4;
const HEIGHT_MAX = 22;
const GAP_CHANCE = 0.4; // probabilité d'une ruelle avant un bâtiment
const GAP_MIN = 0.5;
const GAP_MAX = 1.5;
const ASPHALT_TILE = 6; // longueur (m) couverte par la texture du goudron
export const MEDIAN_HEIGHT = 0.2; // hauteur de la bordure du terre-plein central
const LAMP_SPACING = 25; // m : écart entre deux lampadaires sur le terre-plein
const LAMP_MARGIN = 5; // m : pas de lampadaire tout près d'un carrefour

const randomRange = (min, max) => min + Math.random() * (max - min);

// Mêmes façades que la ville du mode Défis (city.js)
const BUILDING_COLORS = [0xb8b2a7, 0x9c8f80, 0xc9a27e, 0x8a9199, 0xa0624b, 0xd8d2c4, 0x6f7782, 0xbfae8e];
const ASPHALT_COLOR = '#45484d';

// Goudron d'une grande route dessiné dans un canvas : largeur de la chaussée (terre-plein compris) ×
// ASPHALT_TILE m. Deux chaussées de lanes / 2 couloirs séparées par le terre-plein (median m, couvert par
// la bordure en 3D) : ligne blanche discontinue entre les couloirs d'un même sens, lignes blanches
// continues le long des trottoirs et du terre-plein (marquage blanc, comme au Bénin).
function createAsphaltTexture(lanes, median, laneWidth) {
  const PX = 32; // pixels par mètre
  const width = lanes * laneWidth + median;
  const canvas = document.createElement('canvas');
  canvas.width = width * PX;
  canvas.height = ASPHALT_TILE * PX;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = ASPHALT_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Grain du goudron
  for (let i = 0; i < 1600; i++) {
    const shade = 50 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
  }
  const line = 0.12 * PX;
  const carriageway = (lanes / 2) * laneWidth; // largeur d'une chaussée (m)
  ctx.fillStyle = '#f0f0f0';
  for (const start of [0, carriageway + median]) {
    // Tirets entre les couloirs de la chaussée : 3 m de tiret, 3 m d'espace
    for (let i = 1; i < lanes / 2; i++) {
      ctx.fillRect((start + i * laneWidth) * PX - line / 2, 0, line, canvas.height / 2);
    }
    // Lignes continues des deux bords de la chaussée (trottoir et terre-plein)
    ctx.fillRect((start + 0.15) * PX, 0, line, canvas.height);
    ctx.fillRect((start + carriageway - 0.15) * PX - line, 0, line, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Petits pavés des ruelles dessinés dans un canvas : rangées de pavés rectangulaires en quinconce, posées en
// travers de la ruelle, joints sombres, teintes gris-brun variées. La tuile couvre COBBLE_TILE × COBBLE_TILE m
// et se raccorde dans les deux sens (nombre pair de rangées, pavés coupés au bord redessinés de l'autre côté).
const COBBLE_TILE = 2;
function createCobbleTexture() {
  const SIZE = 256;
  const ROWS = 10; // pavés de 20 cm de large
  const PER_ROW = 7; // et d'environ 29 cm de long
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3f3b35'; // joints
  ctx.fillRect(0, 0, SIZE, SIZE);
  const rowHeight = SIZE / ROWS;
  const stoneWidth = SIZE / PER_ROW;
  const GAP = 3;
  for (let row = 0; row < ROWS; row++) {
    const offset = row % 2 ? stoneWidth / 2 : 0; // quinconce
    for (let i = 0; i < PER_ROW; i++) {
      const shade = 118 + Math.floor(Math.random() * 40);
      const color = `rgb(${shade + 8},${shade},${shade - 12})`;
      const x = i * stoneWidth + offset;
      const y = row * rowHeight;
      // Le pavé qui dépasse à droite est aussi dessiné à gauche (raccord horizontal)
      for (const shift of [0, -SIZE]) {
        const gradient = ctx.createLinearGradient(0, y, 0, y + rowHeight);
        gradient.addColorStop(0, `rgba(255,255,255,0.18)`); // arête éclairée
        gradient.addColorStop(0.5, 'rgba(255,255,255,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.25)'); // arête dans l'ombre
        ctx.beginPath();
        ctx.roundRect(x + shift + GAP / 2, y + GAP / 2, stoneWidth - GAP, rowHeight - GAP, 4);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Plan horizontal de width (X) × depth (Z), centré en (x, z), avec des UV [0, uMax] × [0, vMax]
function flatPlane(width, depth, uMax, vMax) {
  const geometry = new THREE.PlaneGeometry(width, depth, 1, Math.max(1, Math.round(depth / 2)));
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uMax, uv.getY(i) * vMax);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// parent : groupe qui porte la ville (déplacé/tourné par main.js pour que le joueur reste en 0)
export function createDeliveryCity(parent, graph) {
  const group = new THREE.Group();
  parent.add(group);

  const pavedMaterial = createPavedMaterial(ROAD_REPEAT);
  const asphaltMaterial = applyWorldBend(
    new THREE.MeshStandardMaterial({ map: createAsphaltTexture(ROAD_TYPES.big.lanes, ROAD_TYPES.big.median, ROAD_TYPES.big.laneWidth), roughness: 0.95, metalness: 0 })
  );
  const cobbleMaterial = applyWorldBend(
    new THREE.MeshStandardMaterial({ map: createCobbleTexture(), roughness: 0.95, metalness: 0 })
  );
  const plainAsphalt = applyWorldBend(
    new THREE.MeshStandardMaterial({ color: ASPHALT_COLOR, roughness: 0.95, metalness: 0 })
  );

  // Chaussée d'une rue sur la portion [u1, u2] (distance depuis le bout ouest / nord de la rue)
  function addSurface(road, u1, u2) {
    const length = u2 - u1;
    if (length <= 0.01) return;
    const width = 2 * halfWidth(road);
    let geometry;
    let material;
    if (road.type === 'big') {
      geometry = flatPlane(width, length, 1, length / ASPHALT_TILE);
      material = asphaltMaterial;
    } else if (road.type === 'alley') {
      geometry = flatPlane(width, length, width / COBBLE_TILE, length / COBBLE_TILE);
      material = cobbleMaterial;
    } else {
      geometry = flatPlane(width, length, width / 2, length / CHUNK_LENGTH);
      material = pavedMaterial;
    }
    const mesh = new THREE.Mesh(geometry, material);
    const mid = (u1 + u2) / 2;
    if (isHorizontal(road)) {
      mesh.position.set(road.x1 + mid, 0, road.y);
      mesh.rotation.y = Math.PI / 2;
    } else {
      mesh.position.set(road.x, 0, road.y1 + mid);
    }
    group.add(mesh);
  }

  // Trottoirs et bâtiments : boîtes 1 × 1 × 1 redimensionnées, regroupées en InstancedMesh
  const sidewalks = []; // matrices
  const medianCurbs = []; // bordures du terre-plein central des grandes routes
  const medianGrass = []; // herbe sur le terre-plein
  const lampSpots = []; // lampadaires du terre-plein : { x, z, angle } (angle : direction du bras, voir streetLights.js)
  const buildings = BUILDING_COLORS.map(() => []);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const noRotation = new THREE.Quaternion();

  // Boîte alignée sur les axes, de (x1, z1) à (x2, z2), de hauteur height
  function box(list, x1, x2, z1, z2, height) {
    position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    scale.set(Math.abs(x2 - x1), height, Math.abs(z2 - z1));
    list.push(matrix.compose(position, noRotation, scale).clone());
  }
  // Parcelles des stations essence : aucun bâtiment ne doit y empiéter
  const lots = STATIONS.map(stationLot);
  const onLot = (x1, x2, z1, z2) =>
    lots.some((lot) =>
      Math.max(x1, x2) > lot.x1 && Math.min(x1, x2) < lot.x2 && Math.max(z1, z2) > lot.y1 && Math.min(z1, z2) < lot.y2
    );
  const building = (x1, x2, z1, z2, height) => {
    if (onLot(x1, x2, z1, z2)) return;
    box(buildings[Math.floor(Math.random() * buildings.length)], x1, x2, z1, z2, height);
  };

  // Remplit [from, to] de bâtiments de LENGTH_MIN à LENGTH_MAX, avec des ruelles éventuelles ;
  // piece(début, longueur, premier, dernier) place chaque bâtiment
  function fill(from, to, piece) {
    let u = from;
    let first = true;
    while (to - u > 0.01) {
      if (!first && Math.random() < GAP_CHANCE && to - u > GAP_MAX + 2 * LENGTH_MIN) {
        u += randomRange(GAP_MIN, GAP_MAX);
      }
      let length = randomRange(LENGTH_MIN, LENGTH_MAX);
      if (to - u - length < LENGTH_MIN) length = to - u; // le dernier finit pile au bout
      piece(u, length, first, u + length >= to - 0.01);
      u += length;
      first = false;
    }
  }

  // Demi-largeur de la rue qui croise `road` au nœud (0 s'il n'y en a pas)
  const crossHalf = (node, road) => {
    const cross = isHorizontal(road) ? node.v : node.h;
    return cross ? halfWidth(cross) : 0;
  };

  // Chaque bras du graphe (une seule fois : de l'ouest vers l'est, du nord vers le sud)
  for (const a of graph.nodes) {
    for (const d of [EAST, SOUTH]) {
      const arm = a.arms[d];
      if (!arm) continue;
      const b = arm.node;
      const road = arm.road;
      const horizontal = isHorizontal(road);
      const hw = halfWidth(road);
      const base = horizontal ? a.x - road.x1 : a.y - road.y1; // u du nœud a sur la rue

      // Chaussée et trottoirs, entre les carrefours
      const u1 = base + crossHalf(a, road);
      const u2 = base + arm.length - crossHalf(b, road);
      addSurface(road, u1, u2);

      // Terre-plein central (grandes routes) : bordure en béton surélevée, herbe dessus ; interrompu aux
      // carrefours pour pouvoir tourner
      const median = medianWidth(road);
      if (median > 0 && u2 - u1 > 0.01) {
        const m = median / 2;
        const g = m - 0.25; // bordure de 25 cm de chaque côté de l'herbe
        if (horizontal) {
          box(medianCurbs, road.x1 + u1, road.x1 + u2, road.y - m, road.y + m, MEDIAN_HEIGHT);
          box(medianGrass, road.x1 + u1 + 0.25, road.x1 + u2 - 0.25, road.y - g, road.y + g, MEDIAN_HEIGHT + 0.02);
        } else {
          box(medianCurbs, road.x - m, road.x + m, road.y1 + u1, road.y1 + u2, MEDIAN_HEIGHT);
          box(medianGrass, road.x - g, road.x + g, road.y1 + u1 + 0.25, road.y1 + u2 - 0.25, MEDIAN_HEIGHT + 0.02);
        }
        // Lampadaires au milieu du terre-plein, régulièrement espacés (centrés entre les deux carrefours) ;
        // le bras va d'un côté puis de l'autre, pour éclairer les deux chaussées
        const free = u2 - u1 - 2 * LAMP_MARGIN;
        if (free >= 0) {
          const count = Math.floor(free / LAMP_SPACING) + 1;
          const start = u1 + LAMP_MARGIN + (free - (count - 1) * LAMP_SPACING) / 2;
          for (let i = 0; i < count; i++) {
            const u = start + i * LAMP_SPACING;
            const toward = i % 2 ? 1 : -1; // côté du bras : nord / sud (rue horizontale), ouest / est (verticale)
            if (horizontal) lampSpots.push({ x: road.x1 + u, z: road.y, angle: (-toward * Math.PI) / 2 });
            else lampSpots.push({ x: road.x, z: road.y1 + u, angle: toward < 0 ? Math.PI : 0 });
          }
        }
      }

      // Côtés : pour une rue horizontale nord (-1) et sud (+1) ; pour une verticale ouest (-1) et est (+1)
      for (const side of [-1, 1]) {
        const sideDir = horizontal ? (side < 0 ? NORTH : SOUTH) : side < 0 ? WEST : EAST;
        // Point (x, z) à la distance u le long de la rue et au décalage latéral v (côté side)
        const at = (u, v) =>
          horizontal ? [road.x1 + u, road.y + side * v] : [road.x + side * v, road.y1 + u];

        // Trottoir
        const [sx1, sz1] = at(u1, hw);
        const [sx2, sz2] = at(u2, hw + SIDEWALK_WIDTH);
        if (u2 - u1 > 0.01) box(sidewalks, sx1, sx2, sz1, sz2, SIDEWALK_HEIGHT);

        // Rangée de bâtiments : s'arrête avant une rue transversale de ce côté, sinon va jusqu'au centre
        const corner = horizontal ? 0 : DEPTH_MAX; // les rues verticales laissent l'angle aux horizontales
        const openA = !!a.arms[sideDir];
        const openB = !!b.arms[sideDir];
        const from = base + (openA ? crossHalf(a, road) + SIDEWALK_WIDTH + corner : 0);
        const to = base + arm.length - (openB ? crossHalf(b, road) + SIDEWALK_WIDTH + corner : 0);
        const facade = hw + SIDEWALK_WIDTH;
        fill(from, to, (u, length, first, last) => {
          const deep = horizontal && ((first && openA) || (last && openB));
          const depth = deep ? DEPTH_MAX : randomRange(DEPTH_MIN, DEPTH_MAX);
          const [x1, z1] = at(u, facade);
          const [x2, z2] = at(u + length, facade + depth);
          building(x1, x2, z1, z2, randomRange(HEIGHT_MIN, HEIGHT_MAX));
        });
      }
    }
  }

  for (const node of graph.nodes) {
    // Impasse (bord de la carte) : un mur de bâtiments ferme la rue
    if (node.deadEnd) {
      const d = node.arms.findIndex(Boolean);
      const road = node.arms[d].road;
      const half = halfWidth(road) + SIDEWALK_WIDTH + DEPTH_MAX;
      const depth = randomRange(DEPTH_MIN, DEPTH_MAX);
      // Le mur part du nœud, à l'opposé du bras
      const bx = node.x - DIR_X[d] * depth;
      const bz = node.y - DIR_Y[d] * depth;
      if (DIR_X[d] !== 0) building(node.x, bx, node.y - half, node.y + half, randomRange(10, HEIGHT_MAX));
      else building(node.x - half, node.x + half, node.y, bz, randomRange(10, HEIGHT_MAX));
      continue;
    }
    if (!node.h || !node.v) continue;

    // Carrefour : chaussée (goudron dès qu'une grande route y passe), coins de trottoir, et trottoir
    // en travers des côtés sans rue (T, L)
    const hx = halfWidth(node.v); // demi-largeur en X (rue verticale)
    const hz = halfWidth(node.h); // demi-largeur en Z (rue horizontale)
    const big = node.h.type === 'big' || node.v.type === 'big';
    const geometry = big ? flatPlane(2 * hx, 2 * hz, 1, 1) : flatPlane(2 * hx, 2 * hz, hx, (2 * hz) / CHUNK_LENGTH);
    const crossing = new THREE.Mesh(geometry, big ? plainAsphalt : pavedMaterial);
    crossing.position.set(node.x, 0, node.y);
    group.add(crossing);

    const sw = SIDEWALK_WIDTH;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        box(sidewalks, node.x + sx * hx, node.x + sx * (hx + sw), node.y + sz * hz, node.y + sz * (hz + sw), SIDEWALK_HEIGHT);
      }
    }
    if (!node.arms[NORTH]) box(sidewalks, node.x - hx, node.x + hx, node.y - hz - sw, node.y - hz, SIDEWALK_HEIGHT);
    if (!node.arms[SOUTH]) box(sidewalks, node.x - hx, node.x + hx, node.y + hz, node.y + hz + sw, SIDEWALK_HEIGHT);
    if (!node.arms[WEST]) box(sidewalks, node.x - hx - sw, node.x - hx, node.y - hz, node.y + hz, SIDEWALK_HEIGHT);
    if (!node.arms[EAST]) box(sidewalks, node.x + hx, node.x + hx + sw, node.y - hz, node.y + hz, SIDEWALK_HEIGHT);
  }

  // Une boîte 1 × 1 × 1 posée au sol, partagée par les trottoirs et les bâtiments
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  unitBox.translate(0, 0.5, 0);
  function instanced(material, matrices) {
    if (!matrices.length) return;
    const mesh = new THREE.InstancedMesh(unitBox, material, matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  instanced(sidewalkMaterial, sidewalks);
  instanced(applyWorldBend(new THREE.MeshStandardMaterial({ color: 0xc9c5bb, roughness: 0.9, metalness: 0 })), medianCurbs);
  instanced(applyWorldBend(new THREE.MeshStandardMaterial({ color: 0x5f8a3a, roughness: 1, metalness: 0 })), medianGrass);
  BUILDING_COLORS.forEach((color, i) =>
    instanced(applyWorldBend(new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 })), buildings[i])
  );

  group.userData.lampSpots = lampSpots; // placés par streetLights.js une fois le modèle chargé
  return group;
}
