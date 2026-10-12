import { LANE_COUNT, laneX } from './road.js';

// Voitures obstacles : un pool de clones du modèle, recyclés (aucune création en cours de jeu).
// Elles roulent dans le même sens que le joueur, mais moins vite : elles se rapprochent donc de lui.
// Chaque voiture est repérée sur le parcours (track.js) : distance s et couloir.
// Elles ne prennent jamais les virages : à l'approche d'un carrefour, elles ralentissent et s'arrêtent
// juste avant, le temps que le joueur les dépasse ; elles disparaissent une fois derrière lui.
const POOL_SIZE = 10;
const CAR_SPEED = 4; // unités par seconde
const SPAWN_AHEAD = 90; // apparition, loin devant le joueur (en distance le long du parcours)
const DESPAWN_BEHIND = 12; // recyclage, derrière la caméra
const GAP_MIN = 24; // écart entre deux rangées de voitures (en distance relative)
const GAP_MAX = 36;
const DOUBLE_CHANCE = 0.3; // probabilité d'une rangée de 2 voitures (un couloir reste toujours libre)
const WHEEL_RADIUS = 0.36;

// Arrêt avant les carrefours
const CORNER_STOP = 3; // l'avant de la voiture s'arrête à 3 m de l'entrée du carrefour
const SLOW_DISTANCE = 12; // la voiture commence à ralentir à cette distance de son point d'arrêt
const FOLLOW_GAP = 1.5; // espace laissé derrière une voiture arrêtée dans le même couloir
const AFTER_CORNER = 6; // une rangée qui apparaîtrait dans un carrefour est placée après lui
const CORNER_MAX_LANES = 2; // au plus 2 couloirs avec des voitures arrêtées au même carrefour
const CORNER_MARGIN = 25; // marge pour décider qu'une rangée arrivera au carrefour avant le joueur

// Boîte de collision d'une voiture (repère de la voiture, un peu plus petite que le modèle)
const HALF_WIDTH = 0.82;
const FRONT = -2.15; // l'avant regarde vers -Z
const BACK = 2.3; // roue de secours comprise
const CAR_LENGTH = BACK - FRONT;

// Point d'arrêt (position s du centre de la voiture) avant le carrefour au bout de la rue leg
const stopPoint = (leg) => leg.sArcStart - CORNER_STOP + FRONT;

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
    cars.push({ object, wheels, active: false, s: 0, x: 0, lane: 0 });
  }

  let untilNextRow = 0;
  let playerS = 0;
  let playerSpeed = 0;
  const lanes = [...Array(LANE_COUNT).keys()];

  // Voiture la plus proche devant la position s, dans le couloir lane (null s'il n'y en a pas)
  function carAhead(lane, s) {
    let nearest = null;
    for (const car of cars) {
      if (car.active && car.lane === lane && car.s > s && (!nearest || car.s < nearest.s)) {
        nearest = car;
      }
    }
    return nearest;
  }

  function spawn(lane, s) {
    // Pas de voiture qui apparaîtrait dans une autre (file arrêtée devant un carrefour)
    for (const other of cars) {
      if (other.active && other.lane === lane && Math.abs(other.s - s) < CAR_LENGTH + FOLLOW_GAP) return;
    }
    const car = cars.find((c) => !c.active);
    if (!car) return;
    car.active = true;
    car.s = s;
    car.lane = lane;
    car.x = laneX(lane);
    car.object.visible = true;
  }

  function spawnRow() {
    let s = playerS + SPAWN_AHEAD;
    let leg = track.legAt(s);
    if (s > stopPoint(leg)) {
      // Trop près du carrefour (ou dedans) : la rangée apparaît au début de la rue suivante,
      // seulement si le joueur a déjà choisi son virage (sinon on ne sait pas encore où elle sera)
      if (!leg.turn) return;
      s = leg.sEnd + AFTER_CORNER;
      leg = track.legAt(s);
    }

    lanes.sort(() => Math.random() - 0.5);
    const count = Math.random() < DOUBLE_CHANCE ? 2 : 1;

    // La rangée atteindra-t-elle le carrefour avant que le joueur la dépasse ?
    // (le joueur rattrape une voiture après qu'elle a parcouru SPAWN_AHEAD × CAR_SPEED / (écart de vitesse))
    const catchUp = (SPAWN_AHEAD * CAR_SPEED) / Math.max(playerSpeed - CAR_SPEED, 0.1);
    const reachesCorner = s + catchUp > stopPoint(leg) - CORNER_MARGIN;
    leg.cornerLanes ??= new Set();

    let spawned = 0;
    for (const lane of lanes) {
      if (spawned === count) break;
      if (reachesCorner) {
        // Les voitures arrêtées au carrefour laissent toujours au moins un couloir libre
        if (!leg.cornerLanes.has(lane) && leg.cornerLanes.size >= CORNER_MAX_LANES) continue;
        leg.cornerLanes.add(lane);
      }
      spawn(lane, s);
      spawned++;
    }
  }

  // speed : vitesse du joueur ; s : position du joueur sur le parcours
  function update(delta, speed, s) {
    playerS = s;
    playerSpeed = speed;
    untilNextRow -= (speed - CAR_SPEED) * delta;
    if (untilNextRow <= 0) {
      spawnRow();
      untilNextRow = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
    }

    for (const car of cars) {
      if (!car.active) continue;

      // Position à ne pas dépasser : avant le carrefour, ou derrière la voiture qui précède
      let limit = stopPoint(track.legAt(car.s));
      const ahead = carAhead(car.lane, car.s);
      if (ahead) limit = Math.min(limit, ahead.s - CAR_LENGTH - FOLLOW_GAP);

      // Pleine vitesse loin du point d'arrêt, puis ralentissement progressif jusqu'à l'arrêt
      const room = Math.max(limit - car.s, 0);
      const carSpeed = CAR_SPEED * Math.min(room / SLOW_DISTANCE, 1);
      car.s += carSpeed * delta;

      if (car.s < playerS - DESPAWN_BEHIND) {
        car.active = false;
        car.object.visible = false;
        continue;
      }
      car.object.rotation.y = track.pose(car.s, car.x, car.object.position);
      const spin = (carSpeed * delta) / WHEEL_RADIUS;
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
