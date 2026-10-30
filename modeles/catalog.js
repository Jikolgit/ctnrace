// Liste des modèles 3D visibles dans la page /modeles (models.glb). Pour ajouter un modèle : une ligne dans la
// catégorie voulue (node = nom du nœud dans models.glb) ; pour une nouvelle catégorie (bâtiments, décor...) :
// un nouvel objet dans MODEL_CATEGORIES. Pour l'instant : les véhicules seulement (motos et voitures).
//   label        nom affiché
//   node         nom du nœud racine dans models.glb
//   rotationY    rotation pour mettre l'avant vers -Z comme dans le jeu (la Rave 110 est modélisée vers +Z)
//   plainParts   pièces sans UV dans le GLB, affichées en noir uni (comme dans le jeu)
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
    ],
  },
  {
    id: 'voitures',
    label: 'Voitures',
    models: [
      { label: 'Voiture 1', node: 'car_1' },
      { label: 'Voiture 2', node: 'car_2' },
      { label: 'Camion', node: 'car_3' },
    ],
  },
];
