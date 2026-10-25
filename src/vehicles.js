// Véhicules de la ville (models.glb) : car_1, car_2, car_3. Ils roulent dans les deux modes (obstacles.js en
// Défis, traffic.js en Livraison), mélangés pour varier la circulation. Chaque modèle a l'avant vers -Z,
// l'origine au sol au milieu du véhicule et des roues nommées « <nom>_Wheel_… ».
//
// Boîte de collision (repère du véhicule, un peu plus petite que le modèle : rétroviseurs et arrondis ne
// comptent pas) : halfWidth (demi-largeur), front (distance de l'origine à l'avant), back (à l'arrière).
export const VEHICLES = [
  { name: 'car_1', halfWidth: 0.82, front: 2.15, back: 2.3, wheelRadius: 0.36 }, // Toyota RAV4
  { name: 'car_2', halfWidth: 1.3, front: 2.05, back: 2.3, wheelRadius: 0.37 }, // 3,0 × 4,6 m
  { name: 'car_3', halfWidth: 1.4, front: 2.05, back: 2.75, wheelRadius: 0.52 }, // camion, 6 roues, 3,2 × 5,0 m
];

// Retire les véhicules de la scène du GLB (ils servent de gabarits), leur applique le matériau (atlas) et
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
    models.push({ ...vehicle, object });
  }
  return models;
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
