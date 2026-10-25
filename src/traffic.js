import * as THREE from 'three';
import { ROAD_TYPES } from './deliveryMap.js';
import { DIR_X, DIR_Y, halfWidth, laneWidthOf } from './network.js';
import { cloneVehicle } from './vehicles.js';

// Mode Livraison : circulation. Des véhicules (clones de car_1, car_2 et car_3 : vehicles.js, en proportions
// égales) roulent dans le réseau de rues, à droite, dans
// les deux sens. À chaque carrefour, elles vont tout droit, à gauche ou à droite au hasard (courbe), mais ne
// font jamais demi-tour, ne prennent pas les ruelles et ne vont pas vers une impasse.
// Elles sont prudentes : elles s'arrêtent si quelqu'un (voiture ou moto) est juste devant elles et attendent
// qu'un carrefour soit libre pour s'y engager. C'est donc la moto qui peut les percuter (hits) : le joueur
// les évite en freinant ou en changeant de couloir.
//
// Repère : celui de la carte (x → X, y vers le sud → Z), comme le reste de la ville de Livraison.

const CAR_COUNT = 20;
const CRUISE_SPEED = 7; // m/s (la moto roule à 12)
const ACCELERATION = 4; // m/s²
const BRAKING = 9; // m/s²
const SAFE_DISTANCE = 9; // m : distance devant la voiture où elle s'arrête si quelqu'un s'y trouve
const SAFE_WIDTH = 1.6; // m : demi-largeur de ce couloir de sécurité
const JUNCTION_MARGIN = 2; // m : un carrefour est « occupé » si quelqu'un est à moins de rayon + marge du centre
const APPROACH = 6; // m avant l'entrée du carrefour où la voiture vérifie qu'il est libre
const RECYCLE_DISTANCE = 140; // m : une voiture plus loin que ça de la moto est replacée près d'elle
const SPAWN_MIN = 60; // m : distance de réapparition (dans le brouillard, invisible)
const SPAWN_MAX = 120;
const SPAWN_SPACING = 10; // m : distance minimale à une autre voiture à la réapparition
const START_CLEARANCE = 45; // m : pas de voiture à moins de ça de la moto au départ

// Boîte de chaque véhicule : model.halfWidth, model.front, model.back (vehicles.js). Demi-largeur de la moto :
const PLAYER_HALF_WIDTH = 0.35;
const PLAYER_HALF_LENGTH = 0.9;

// Décalage du couloir de droite (le plus à droite) par rapport à l'axe de la rue
const laneOffset = (road) => halfWidth(road) - laneWidthOf(road) / 2;
const rightX = (d) => DIR_X[(d + 1) % 4];
const rightY = (d) => DIR_Y[(d + 1) % 4];
const drivable = (arm) => arm && !arm.node.deadEnd && arm.road.type !== 'alley' && ROAD_TYPES[arm.road.type];

// models : véhicules (vehicles.js, extractVehicles)
export function createTraffic(parent, models, graph) {
  // Bras où les voitures peuvent rouler : { node, d } (départ du carrefour node dans la direction d)
  const starts = [];
  for (const node of graph.nodes) {
    if (node.deadEnd) continue;
    for (let d = 0; d < 4; d++) if (drivable(node.arms[d])) starts.push({ node, d });
  }

  const cars = [];
  for (let i = 0; i < CAR_COUNT; i++) {
    const model = models[i % models.length];
    const { object, wheels } = cloneVehicle(model);
    parent.add(object);
    cars.push({
      object,
      wheels,
      model,
      node: null, // carrefour de départ de la rue
      d: 0, // direction
      u: 0, // distance depuis le centre du carrefour de départ
      speed: 0,
      turning: false,
      // Virage (courbe de Bézier quadratique p0 → p1 → p2) vers la direction nextD
      p0x: 0, p0y: 0, p1x: 0, p1y: 0, p2x: 0, p2y: 0, length: 1, t: 0, nextD: 0, turnNode: null,
      x: 0, y: 0, fx: 0, fy: -1, // position et direction (carte)
    });
  }

  // Place la voiture sur la rue (node, d) à la distance u du carrefour de départ
  function placeOnRoad(car, node, d, u) {
    car.node = node;
    car.d = d;
    car.u = u;
    car.turning = false;
    const off = laneOffset(node.arms[d].road);
    car.x = node.x + u * DIR_X[d] + off * rightX(d);
    car.y = node.y + u * DIR_Y[d] + off * rightY(d);
    car.fx = DIR_X[d];
    car.fy = DIR_Y[d];
  }

  // Replace la voiture au hasard, à une distance de la moto comprise entre min et max
  function spawn(car, px, py, min, max) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const { node, d } = starts[Math.floor(Math.random() * starts.length)];
      const arm = node.arms[d];
      const entry = node.radius;
      const exit = arm.length - arm.node.radius;
      if (exit - entry < 10) continue;
      const u = entry + Math.random() * (exit - entry - 5);
      const x = node.x + u * DIR_X[d];
      const y = node.y + u * DIR_Y[d];
      const distance = Math.hypot(x - px, y - py);
      if (distance < min || distance > max) continue;
      // Pas sur une autre voiture
      if (cars.some((other) => other !== car && other.node && Math.hypot(other.x - x, other.y - y) < SPAWN_SPACING)) continue;
      placeOnRoad(car, node, d, u);
      car.speed = CRUISE_SPEED;
      car.object.visible = true;
      return;
    }
    car.object.visible = false; // pas de place trouvée : réessai plus tard
    car.node = null;
  }

  // Début du virage au carrefour au bout de la rue : choix de la direction suivante (jamais de demi-tour)
  function startTurn(car) {
    const arrival = car.node.arms[car.d].node;
    const options = [];
    for (const turn of [-1, 0, 1]) {
      const out = (car.d + turn + 4) % 4;
      if (drivable(arrival.arms[out])) options.push(out);
    }
    if (!options.length) return false; // impasse : pas de demi-tour, la voiture sera replacée
    const out = options[Math.floor(Math.random() * options.length)];
    const inOff = laneOffset(car.node.arms[car.d].road);
    const outOff = laneOffset(arrival.arms[out].road);
    car.p0x = car.x;
    car.p0y = car.y;
    car.p2x = arrival.x + arrival.radius * DIR_X[out] + outOff * rightX(out);
    car.p2y = arrival.y + arrival.radius * DIR_Y[out] + outOff * rightY(out);
    if (out === car.d) {
      car.p1x = (car.p0x + car.p2x) / 2;
      car.p1y = (car.p0y + car.p2y) / 2;
    } else {
      // Coin : intersection des deux couloirs
      car.p1x = arrival.x + inOff * rightX(car.d) + outOff * rightX(out);
      car.p1y = arrival.y + inOff * rightY(car.d) + outOff * rightY(out);
    }
    // Longueur approchée de la courbe
    let length = 0;
    let lx = car.p0x;
    let ly = car.p0y;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const x = (1 - t) * (1 - t) * car.p0x + 2 * (1 - t) * t * car.p1x + t * t * car.p2x;
      const y = (1 - t) * (1 - t) * car.p0y + 2 * (1 - t) * t * car.p1y + t * t * car.p2y;
      length += Math.hypot(x - lx, y - ly);
      lx = x;
      ly = y;
    }
    car.length = Math.max(length, 0.1);
    car.t = 0;
    car.nextD = out;
    car.turnNode = arrival;
    car.turning = true;
    return true;
  }

  // Ligne d'arrêt avant le carrefour au bout de la rue : la voiture qui attend s'y arrête, l'avant hors du carrefour
  const stopLine = (car) => {
    const arm = car.node.arms[car.d];
    return arm.length - arm.node.radius - car.model.front - 0.5;
  };
  // Voiture engagée dans le carrefour (en train de tourner, ou ligne d'arrêt franchie)
  const committed = (car) => car.turning || car.u > stopLine(car) + 0.01;
  // La voiture attend-elle à l'entrée d'un carrefour (avant la ligne d'arrêt) ?
  const waitingAtJunction = (car) => !committed(car) && car.u > stopLine(car) - APPROACH - 1;

  // Quelqu'un (autre voiture ou moto) dans le couloir de sécurité devant la voiture ? Une voiture qui traverse
  // un carrefour ne s'arrête pas pour celles qui attendent à son entrée (elles l'attendent : interblocage)
  function blockedAhead(car, px, py) {
    const check = (x, y) => {
      const rx = x - car.x;
      const ry = y - car.y;
      const ahead = rx * car.fx + ry * car.fy;
      if (ahead <= 0 || ahead > SAFE_DISTANCE) return false;
      return Math.abs(rx * car.fy - ry * car.fx) < SAFE_WIDTH;
    };
    if (check(px, py)) return true;
    for (const other of cars) {
      if (other === car || !other.node) continue;
      if (car.turning && waitingAtJunction(other)) continue;
      if (check(other.x, other.y)) return true;
    }
    return false;
  }

  // Carrefour occupé ? Par la moto, ou par une voiture en train de le traverser (pas par celles qui attendent à
  // son entrée : elles s'attendraient l'une l'autre indéfiniment)
  function junctionBusy(car, node, px, py) {
    if (Math.hypot(px - node.x, py - node.y) < node.radius + JUNCTION_MARGIN) return true;
    for (const other of cars) {
      if (other === car || !other.node || !committed(other)) continue;
      const toward = other.turning ? other.turnNode : other.node.arms[other.d].node;
      if (toward === node) return true;
    }
    return false;
  }

  // px, py : position de la moto sur la carte
  function update(delta, px, py) {
    for (const car of cars) {
      if (!car.node) {
        spawn(car, px, py, SPAWN_MIN, SPAWN_MAX);
        continue;
      }
      if (Math.hypot(car.x - px, car.y - py) > RECYCLE_DISTANCE) {
        spawn(car, px, py, SPAWN_MIN, SPAWN_MAX);
        continue;
      }

      // Vitesse : arrêt si quelqu'un est devant, ou si le carrefour à franchir est occupé (arrêt à la ligne)
      const arm = car.node.arms[car.d];
      const exit = arm.length - arm.node.radius;
      const line = stopLine(car);
      const busy = !committed(car) && car.u > line - APPROACH && junctionBusy(car, arm.node, px, py);
      const stop = busy || blockedAhead(car, px, py);
      const target = stop ? 0 : CRUISE_SPEED;
      if (car.speed < target) car.speed = Math.min(target, car.speed + ACCELERATION * delta);
      else car.speed = Math.max(target, car.speed - BRAKING * delta);
      const step = car.speed * delta;

      if (!car.turning) {
        car.u = Math.min(car.u + step, exit);
        if (busy && car.u > line) {
          // Carrefour occupé : arrêt net à la ligne (sans déborder dans le carrefour)
          car.u = line;
          car.speed = 0;
        }
        const off = laneOffset(arm.road);
        car.x = car.node.x + car.u * DIR_X[car.d] + off * rightX(car.d);
        car.y = car.node.y + car.u * DIR_Y[car.d] + off * rightY(car.d);
        if (car.u >= exit && !startTurn(car)) {
          spawn(car, px, py, SPAWN_MIN, SPAWN_MAX);
          continue;
        }
      } else {
        car.t = Math.min(1, car.t + step / car.length);
        const t = car.t;
        car.x = (1 - t) * (1 - t) * car.p0x + 2 * (1 - t) * t * car.p1x + t * t * car.p2x;
        car.y = (1 - t) * (1 - t) * car.p0y + 2 * (1 - t) * t * car.p1y + t * t * car.p2y;
        // Direction : dérivée de la courbe
        const dx = 2 * (1 - t) * (car.p1x - car.p0x) + 2 * t * (car.p2x - car.p1x);
        const dy = 2 * (1 - t) * (car.p1y - car.p0y) + 2 * t * (car.p2y - car.p1y);
        const len = Math.hypot(dx, dy);
        if (len > 1e-6) {
          car.fx = dx / len;
          car.fy = dy / len;
        }
        if (t >= 1) {
          const arrival = arm.node;
          placeOnRoad(car, arrival, car.nextD, arrival.radius);
        }
      }

      // Modèle : l'avant des véhicules regarde vers -Z
      car.object.position.set(car.x, 0, car.y);
      car.object.rotation.y = Math.atan2(-car.fx, -car.fy);
      const spin = step / car.model.wheelRadius;
      for (const wheel of car.wheels) wheel.rotation.x -= spin;
    }
  }

  // La moto (px, py) touche-t-elle une voiture ?
  function hits(px, py) {
    for (const car of cars) {
      if (!car.node) continue;
      const rx = px - car.x;
      const ry = py - car.y;
      const along = rx * car.fx + ry * car.fy;
      const lateral = Math.abs(rx * car.fy - ry * car.fx);
      const { halfWidth: hw, front, back } = car.model;
      if (lateral < hw + PLAYER_HALF_WIDTH && along < front + PLAYER_HALF_LENGTH && along > -back - PLAYER_HALF_LENGTH) {
        return true;
      }
    }
    return false;
  }

  // Nouvelle partie : voitures réparties sur la carte, loin de la moto (px, py)
  function reset(px, py) {
    for (const car of cars) spawn(car, px, py, START_CLEARANCE, RECYCLE_DISTANCE - 10);
  }

  return { update, hits, reset, cars };
}
