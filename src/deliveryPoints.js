import * as THREE from 'three';
import { applyWorldBend } from './worldBend.js';
import { ROADS } from './deliveryMap.js';
import { halfWidth, laneWidthOf, isHorizontal } from './network.js';

// Mode Livraison : points de livraison de la mission en cours. Chacun est marqué sur la route par une
// grosse flèche orange qui pointe vers le bas (elle tourne sur elle-même et flotte) au-dessus du couloir
// qui longe le trottoir de livraison, avec un cercle au sol. La moto livre en roulant dessus.

const ARROW_HEIGHT = 1.7; // hauteur du bas de la flèche au-dessus de la route
const BOB_AMPLITUDE = 0.2;
const BOB_SPEED = 3;
const SPIN_SPEED = 1.5; // rad/s
const TRIGGER_RADIUS = 1.4; // distance (m) à laquelle la moto déclenche la livraison
const MAX_POINTS = 8; // flèches créées une fois pour toutes (pool)

// Flèche vers le bas : pointe en 0, hauteur 1,6 m, largeur 1,2 m, épaisseur 0,25 m
function createArrowGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.6, 0.7);
  shape.lineTo(0.25, 0.7);
  shape.lineTo(0.25, 1.6);
  shape.lineTo(-0.25, 1.6);
  shape.lineTo(-0.25, 0.7);
  shape.lineTo(-0.6, 0.7);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false });
  geometry.translate(0, 0, -0.125);
  return geometry;
}

// Position sur la carte (x, y) d'une livraison { road, at, side } : milieu du couloir qui longe le trottoir
export function deliveryPosition(delivery) {
  const road = ROADS.find((r) => r.name === delivery.road);
  if (!road) throw new Error(`Rue inconnue : ${delivery.road}`);
  const lateral = delivery.side * (halfWidth(road) - laneWidthOf(road) / 2);
  return isHorizontal(road)
    ? { x: delivery.at, y: road.y + lateral }
    : { x: road.x + lateral, y: delivery.at };
}

// parent : groupe de la ville de Livraison (repère de la carte : x → X, y → Z)
export function createDeliveryPoints(parent) {
  const arrowGeometry = createArrowGeometry();
  const arrowMaterial = applyWorldBend(
    new THREE.MeshStandardMaterial({ color: 0xe8642a, emissive: 0x7a2a08, roughness: 0.5, metalness: 0 })
  );
  const ringGeometry = new THREE.RingGeometry(0.9, 1.2, 32);
  ringGeometry.rotateX(-Math.PI / 2);
  const ringMaterial = applyWorldBend(
    new THREE.MeshBasicMaterial({ color: 0xe8642a, transparent: true, opacity: 0.8, depthWrite: false })
  );

  // points : { x, y, active, arrow, ring } ; visibles tant qu'ils ne sont pas livrés
  const points = [];
  for (let i = 0; i < MAX_POINTS; i++) {
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    arrow.visible = ring.visible = false;
    parent.add(arrow, ring);
    points.push({ x: 0, y: 0, active: false, arrow, ring, phase: i });
  }
  let count = 0;

  // Nouvelle partie : une flèche par livraison de la mission
  function reset(deliveries) {
    count = deliveries.length;
    points.forEach((point, i) => {
      point.active = i < count;
      point.arrow.visible = point.ring.visible = point.active;
      if (!point.active) return;
      const { x, y } = deliveryPosition(deliveries[i]);
      point.x = x;
      point.y = y;
      point.ring.position.set(x, 0.03, y);
      point.arrow.position.set(x, ARROW_HEIGHT, y);
    });
  }

  // Animation des flèches ; renvoie l'indice du point sur lequel roule la moto (px, pz), ou -1
  function update(time, px, pz) {
    let hit = -1;
    for (let i = 0; i < count; i++) {
      const point = points[i];
      if (!point.active) continue;
      point.arrow.position.y = ARROW_HEIGHT + BOB_AMPLITUDE * Math.sin(time * BOB_SPEED + point.phase);
      point.arrow.rotation.y = time * SPIN_SPEED + point.phase;
      if (hit < 0 && Math.hypot(point.x - px, point.y - pz) < TRIGGER_RADIUS) hit = i;
    }
    return hit;
  }

  // Produit livré : la flèche disparaît
  function remove(i) {
    points[i].active = false;
    points[i].arrow.visible = points[i].ring.visible = false;
  }

  // Points encore à livrer (pour la mini-carte) : liste réutilisée, pas d'allocation par image
  const remaining = [];
  function active() {
    remaining.length = 0;
    for (let i = 0; i < count; i++) if (points[i].active) remaining.push(points[i]);
    return remaining;
  }

  return { reset, update, remove, active };
}
