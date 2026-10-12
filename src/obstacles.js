import { LANE_COUNT, laneX } from './road.js';

// Voitures obstacles : un pool de clones du modèle, recyclés (aucune création en cours de jeu).
// Elles roulent dans le même sens que le joueur, mais moins vite : elles se rapprochent donc de lui.
// Chaque voiture est repérée sur le parcours (track.js) : distance s et couloir ; elle suit les virages.
const POOL_SIZE = 10;
const CAR_SPEED = 4; // unités par seconde
const SPAWN_AHEAD = 90; // apparition, loin devant le joueur (en distance le long du parcours)
const DESPAWN_BEHIND = 12; // recyclage, derrière la caméra
const GAP_MIN = 24; // écart entre deux rangées de voitures (en distance relative)
const GAP_MAX = 36;
const DOUBLE_CHANCE = 0.3; // probabilité d'une rangée de 2 voitures (un couloir reste toujours libre)
const WHEEL_RADIUS = 0.36;

// Boîte de collision d'une voiture (repère de la voiture, un peu plus petite que le modèle)
const HALF_WIDTH = 0.82;
const FRONT = -2.15; // l'avant regarde vers -Z
const BACK = 2.3; // roue de secours comprise

// world : groupe qui porte le décor ; track : le parcours
export function createObstacles(world, template, track) {
  const cars = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const object = template.clone(true); // géométries et matériau partagés
    object.visible = false;
    world.add(object);
    const wheels = [];
    object.traverse((child) => {
      if (child.name.includes('_Wheel_')) wheels.push(child);
    });
    cars.push({ object, wheels, active: false, s: 0, x: 0 });
  }

  let untilNextRow = 0;
  let playerS = 0;

  function spawn(lane) {
    const car = cars.find((c) => !c.active);
    if (!car) return;
    car.active = true;
    car.s = playerS + SPAWN_AHEAD;
    car.x = laneX(lane);
    car.object.visible = true;
  }

  function spawnRow() {
    const lanes = [...Array(LANE_COUNT).keys()].sort(() => Math.random() - 0.5);
    const count = Math.random() < DOUBLE_CHANCE ? 2 : 1;
    for (let i = 0; i < count; i++) spawn(lanes[i]);
  }

  // speed : vitesse du joueur ; s : position du joueur sur le parcours
  function update(delta, speed, s) {
    playerS = s;
    untilNextRow -= (speed - CAR_SPEED) * delta;
    if (untilNextRow <= 0) {
      spawnRow();
      untilNextRow = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
    }

    const spin = (CAR_SPEED * delta) / WHEEL_RADIUS;
    for (const car of cars) {
      if (!car.active) continue;
      car.s += CAR_SPEED * delta;
      if (car.s < playerS - DESPAWN_BEHIND) {
        car.active = false;
        car.object.visible = false;
        continue;
      }
      car.object.rotation.y = track.pose(car.s, car.x, car.object.position);
      for (const wheel of car.wheels) wheel.rotation.x -= spin;
    }
  }

  // Collision avec la boîte du joueur : x (décalage latéral), zMin/zMax (avant/arrière, vers -Z)
  function hits(x, halfWidth, zMin, zMax) {
    for (const car of cars) {
      if (!car.active) continue;
      const z = playerS - car.s; // position de la voiture dans le repère du joueur (devant = négatif)
      if (
        Math.abs(car.x - x) < HALF_WIDTH + halfWidth &&
        z + FRONT < zMax &&
        z + BACK > zMin
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
