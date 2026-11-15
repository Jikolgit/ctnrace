// Liste des modèles 3D visibles dans la page /modeles (models.glb).
// node = nom exact du nœud racine dans models.glb.
// texture = fichier de texture dans public/ (par défaut : atlas bikeTXT.jpg).
// rotationY = rotation pour orienter l'avant vers -Z, si nécessaire.
// plainParts = pièces sans UV à afficher en noir uni.
export const MODEL_CATEGORIES = [
  {
    id: 'motos',
    label: 'Motos',
    models: [
      {
        label: 'Rave 110',
        node: 'bike_1',
        rotationY: Math.PI,
        plainParts: /^(MotoCub_Roue_Avant|bike_1_Roue_Arriere)$/,
      },
      { label: 'Baraj', node: 'bike_2' },
      { label: 'Moto 1', node: 'moto_1', texture: 'moto_1_txt.jpg' },
    ],
  },
  {
    id: 'tricycles',
    label: 'Tricycles',
    models: [
      { label: 'Tricycle 1', node: 'tricycle_1' },
    ],
  },
  {
    id: 'voitures',
    label: 'Voitures',
    models: [
      { label: 'Voiture 1', node: 'car_1' },
      { label: 'Voiture 2', node: 'car_2' },
      { label: 'Camion', node: 'car_3' },
      { label: 'Voiture 4', node: 'car_4' },
    ],
  },
];
