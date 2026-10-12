import { LANE_COUNT, laneX } from './road.js';

// Voitures obstacles : un pool de clones du modèle, recyclés (aucune création en cours de jeu).
// Elles roulent dans le même sens que le joueur, mais moins vite : elles se rapprochent donc de lui.
// Chaque voiture est repérée sur le parcours (track.js) : distance s et couloir.
// Une seule voiture à la fois à un endroit donné (jamais deux côte à côte).
//
// Pas de voiture dans les CAR_FREE_ZONE derniers mètres avant un carrefour, et jamais dans un virage.
// Pour cela, on choisit d'abord l'endroit du parcours où le joueur croisera la prochaine voiture
// (« rencontre »), dans une ligne droite et hors de cette zone, puis on fait apparaître la voiture
// à la position d'où, en roulant, elle sera rejointe à cet endroit.
const POOL_SIZE = 10;
const CAR_SPEED = 4; // unités par seconde
const SPAWN_AHEAD = 90; // apparition au plus loin devant le joueur (dans le brouillard)
const DESPAWN_BEHIND = 12; // recyclage, derrière la caméra
const ENCOUNTER_GAP_MIN = 36; // distance (parcourue par le joueur) entre deux voitures croisées
const ENCOUNTER_GAP_MAX = 54;
const FIRST_ENCOUNTER = 135; // première voiture croisée environ 11 s après le départ
const CAR_FREE_ZONE = 30; // mètres sans voiture avant chaque carrefour
const AFTER_CORNER = 25; // pas de rencontre dans les premiers mètres après un carrefour (la voiture
// apparaît alors pendant le virage, cachée derrière l'angle de rue)
const WHEEL_RADIUS = 0.36;

// Boîte de collision d'une voiture (repère de la voiture, un peu plus petite que le modèle)
const HALF_WIDTH = 0.82;
const FRONT = -2.15; // l'avant regarde vers -Z
const BACK = 2.3; // roue de secours comprise

const randomRange = (min, max) => min + Math.random() * (max - min);

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

  let playerS = 0;
  let nextEncounter = null; // s où le joueur croisera la prochaine voiture

  // Fait apparaître la prochaine voiture quand c'est le moment (au plus une par image)
  function trySpawn(speed) {
    const leg = track.legAt(nextEncounter);

    // La voiture doit être entièrement dépassée avant la zone sans voiture du carrefour
    if (nextEncounter + BACK - FRONT > leg.sArcStart - CAR_FREE_ZONE) {
      // Rencontre reportée dans la rue suivante, dès que le joueur a choisi son virage
      if (!leg.turn) return;
      nextEncounter = leg.sEnd + AFTER_CORNER;
      return;
    }
    if (nextEncounter < leg.sStart + AFTER_CORNER) {
      nextEncounter = leg.sStart + AFTER_CORNER;
      return;
    }

    // Rencontre déjà dépassée (ne devrait pas arriver) : on passe à la suivante
    if (nextEncounter < playerS + 1) {
      nextEncounter += randomRange(ENCOUNTER_GAP_MIN, ENCOUNTER_GAP_MAX);
      return;
    }

    // Position de départ c telle que la voiture (CAR_SPEED) et le joueur (speed) se rejoignent en
    // nextEncounter : (rencontre - c) / CAR_SPEED = (rencontre - joueur) / speed
    const start = nextEncounter - ((nextEncounter - playerS) * CAR_SPEED) / speed;
    if (start - playerS > SPAWN_AHEAD) return; // trop tôt : elle serait visible hors du brouillard
    // Elle doit partir de la même rue (elle ne prend pas les virages) : sinon, attendre un peu
    if (start < leg.sStart + 3) return;

    const car = cars.find((c) => !c.active);
    if (car) {
      car.active = true;
      car.s = start;
      car.x = laneX(Math.floor(Math.random() * LANE_COUNT));
      car.object.visible = true;
    }
    nextEncounter += randomRange(ENCOUNTER_GAP_MIN, ENCOUNTER_GAP_MAX);
  }

  // speed : vitesse du joueur ; s : position du joueur sur le parcours
  function update(delta, speed, s) {
    playerS = s;
    if (nextEncounter === null) nextEncounter = s + FIRST_ENCOUNTER;
    trySpawn(speed);

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
    nextEncounter = null;
  }

  return { update, hits, reset };
}
