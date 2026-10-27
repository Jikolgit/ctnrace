import { applyWorldBend } from './worldBend.js';

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
  { name: 'car_1', halfWidth: 1.0, front: 1.85, back: 1.9, wheelRadius: 0.31 }, // refaite en octobre 2026 : 2,3 × 3,9 m
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
    // Feux : pièces « <nom>_front_light » et « <nom>_back_light » du modèle (casse indifférente), qui brillent la
    // nuit (setVehicleLights) ; le reste prend l'atlas
    object.traverse((child) => {
      if (!child.isMesh) return;
      if (/front_light/i.test(child.name)) child.material = headlightMaterial(material);
      else if (/back_light/i.test(child.name)) child.material = taillightMaterial(material);
      else child.material = material;
    });
    models.push({ ...vehicle, object });
  }
  return models;
}

// Matériaux des feux, partagés par tous les clones : l'atlas, plus une lumière émise (emissive) dont l'intensité
// est nulle le jour. Allumer les feux ne change qu'un nombre (pas de recompilation des shaders).
const HEADLIGHT_COLOR = 0xfff2d0;
const TAILLIGHT_COLOR = 0xff2a1a;
const HEADLIGHT_GLOW = 1.6; // intensité la nuit
const TAILLIGHT_GLOW = 1.2;
let headlights = null;
let taillights = null;

function glowingCopy(material, color) {
  const copy = applyWorldBend(material.clone()); // clone() ne garde pas onBeforeCompile : courbure remise
  copy.emissive.set(color);
  copy.emissiveIntensity = 0;
  return copy;
}

function headlightMaterial(material) {
  headlights ??= glowingCopy(material, HEADLIGHT_COLOR);
  return headlights;
}

function taillightMaterial(material) {
  taillights ??= glowingCopy(material, TAILLIGHT_COLOR);
  return taillights;
}

// Phares et feux arrière de toutes les voitures (les deux modes)
export function setVehicleLights(on) {
  if (headlights) headlights.emissiveIntensity = on ? HEADLIGHT_GLOW : 0;
  if (taillights) taillights.emissiveIntensity = on ? TAILLIGHT_GLOW : 0;
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
