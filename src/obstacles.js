import { LANE_COUNT, laneX } from './road.js';

// Voitures obstacles : un pool de clones du modèle, recyclés (aucune création en cours de jeu).
// Elles roulent dans le même sens que le joueur, mais moins vite : elles se rapprochent donc de lui.
const POOL_SIZE = 10;
const CAR_SPEED = 4; // unités par seconde
const SPAWN_Z = -90; // apparition, loin devant
const DESPAWN_Z = 12; // recyclage, derrière la caméra
const GAP_MIN = 24; // écart entre deux rangées de voitures (en distance relative)
const GAP_MAX = 36;
const DOUBLE_CHANCE = 0.3; // probabilité d'une rangée de 2 voitures (un couloir reste toujours libre)
const WHEEL_RADIUS = 0.36;

// Boîte de collision d'une voiture (repère de la voiture, un peu plus petite que le modèle)
const HALF_WIDTH = 0.82;
const FRONT = -2.15; // l'avant regarde vers -Z
const BACK = 2.3; // roue de secours comprise

export function createObstacles(scene, template) {
  const cars = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const object = template.clone(true); // géométries et matériau partagés
    object.visible = false;
    scene.add(object);
    const wheels = [];
    object.traverse((child) => {
      if (child.name.includes('_Wheel_')) wheels.push(child);
    });
    cars.push({ object, wheels, active: false });
  }

  let untilNextRow = 0;

  function spawn(lane) {
    const car = cars.find((c) => !c.active);
    if (!car) return;
    car.active = true;
    car.object.position.set(laneX(lane), 0, SPAWN_Z);
    car.object.visible = true;
  }

  function spawnRow() {
    const lanes = [...Array(LANE_COUNT).keys()].sort(() => Math.random() - 0.5);
    const count = Math.random() < DOUBLE_CHANCE ? 2 : 1;
    for (let i = 0; i < count; i++) spawn(lanes[i]);
  }

  // speed : vitesse de défilement de la route (vitesse du joueur)
  function update(delta, speed) {
    const approach = (speed - CAR_SPEED) * delta;

    untilNextRow -= approach;
    if (untilNextRow <= 0) {
      spawnRow();
      untilNextRow = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
    }

    const spin = (CAR_SPEED * delta) / WHEEL_RADIUS;
    for (const car of cars) {
      if (!car.active) continue;
      car.object.position.z += approach;
      for (const wheel of car.wheels) wheel.rotation.x -= spin;
      if (car.object.position.z > DESPAWN_Z) {
        car.active = false;
        car.object.visible = false;
      }
    }
  }

  // Collision avec une boîte alignée sur les axes (x, zMin, zMax, demi-largeur) du joueur
  function hits(x, halfWidth, zMin, zMax) {
    for (const car of cars) {
      if (!car.active) continue;
      const p = car.object.position;
      if (
        Math.abs(p.x - x) < HALF_WIDTH + halfWidth &&
        p.z + FRONT < zMax &&
        p.z + BACK > zMin
      ) {
        return true;
      }
    }
    return false;
  }

  function reset() {
    for (const car of cars) {
      car.active = false;
      car.object.visible = false;
    }
    untilNextRow = 0;
  }

  return { update, hits, reset };
}
