import * as THREE from 'three';
import { glowMaterial, glowDisc } from './glow.js';

// Véhicules de la ville (models.glb) : car_1, car_2, car_3. Ils roulent dans les deux modes (obstacles.js en
// Défis, traffic.js en Livraison), mélangés pour varier la circulation. Chaque modèle a l'avant vers -Z,
// l'origine au sol au milieu du véhicule et des roues nommées « <nom>_Wheel_… ».
//
// Boîte de collision (repère du véhicule, un peu plus petite que le modèle : rétroviseurs et arrondis ne
// comptent pas) : halfWidth (demi-largeur), front (distance de l'origine à l'avant), back (à l'arrière).
// turnSpeed (m/s, facultatif) : vitesse dans les virages à gauche ou à droite de la circulation de Livraison
// (sans : virages à la vitesse de croisière). Le camion, lourd, ralentit avant de tourner.
// Les couleurs viennent de l'atlas bikeTXT.jpg (UV posés par l'utilisateur sur ses palettes).

export const VEHICLES = [
  { name: 'car_1', halfWidth: 0.82, front: 2.15, back: 2.3, wheelRadius: 0.36 }, // Toyota RAV4
  { name: 'car_2', halfWidth: 1.3, front: 2.05, back: 2.3, wheelRadius: 0.37 }, // 3,0 × 4,6 m
  { name: 'car_3', halfWidth: 1.4, front: 2.05, back: 2.75, wheelRadius: 0.52, turnSpeed: 3 }, // camion, 6 roues, 3,2 × 5,0 m
];

// Retire les véhicules de la scène du GLB (ils servent de gabarits), leur applique le matériau (atlas bikeTXT) et
// renvoie [{ object, halfWidth, front, back, wheelRadius }] pour ceux qui existent dans le fichier
export function extractVehicles(root, material) {
  const models = [];
  for (const vehicle of VEHICLES) {
    const object = root.getObjectByName(vehicle.name);
    if (!object) continue;
    object.removeFromParent();
    object.position.set(0, 0, 0); // placés côte à côte dans Blender
    object.traverse((child) => {
      if (child.isMesh) child.material = material;
    });
    addLights(object);
    models.push({ ...vehicle, object });
  }
  return models;
}

// Feux des voitures, allumés la nuit (setVehicleLights) : deux phares blancs à l'avant (-Z), deux feux rouges à
// l'arrière (+Z), placés d'après la boîte englobante du modèle. Matériaux partagés par tous les clones :
// les allumer ou les éteindre ne touche qu'un drapeau.
const headlightMaterial = glowMaterial(0xfff4d6);
const taillightMaterial = glowMaterial(0xff2a1a);
headlightMaterial.visible = taillightMaterial.visible = false;
const HEADLIGHT_SIZE = 0.55; // m : diamètre du halo
const TAILLIGHT_SIZE = 0.4;
const box = new THREE.Box3();

function addLights(object) {
  object.updateMatrixWorld(true);
  box.setFromObject(object);
  const y = box.min.y + (box.max.y - box.min.y) * 0.32; // hauteur des phares
  const x = (box.max.x - box.min.x) / 2 - 0.35;
  for (const side of [-1, 1]) {
    const front = glowDisc(headlightMaterial, HEADLIGHT_SIZE, -1);
    front.position.set(side * x, y, box.min.z - 0.03);
    const rear = glowDisc(taillightMaterial, TAILLIGHT_SIZE, 1);
    rear.position.set(side * x, y, box.max.z + 0.03);
    object.add(front, rear);
  }
}

// Phares et feux arrière de toutes les voitures (les deux modes)
export function setVehicleLights(on) {
  headlightMaterial.visible = taillightMaterial.visible = on;
}

// Clone d'un modèle, avec la liste de ses roues (pour les faire tourner)
export function cloneVehicle(model) {
  const object = model.object.clone(true); // géométries et matériau partagés
  const wheels = [];
  object.traverse((child) => {
    if (child.name.includes('_Wheel_')) wheels.push(child);
  });
  return { object, wheels };
}
