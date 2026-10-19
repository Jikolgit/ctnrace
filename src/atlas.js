import * as THREE from 'three';

// Atlas bikeTXT.jpg partagé (motos, pilote, voitures, pavés de la route) : chargé une seule fois.
export const atlas = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}bikeTXT.jpg`);
atlas.flipY = false; // convention glTF : l'origine des UV est en haut à gauche
atlas.colorSpace = THREE.SRGBColorSpace;

// Zone des pavés dans l'atlas (pixels, origine en haut à gauche) : x, y, largeur, hauteur
const SIZE = 1024;
const ROAD = [327, 327, 354, 254]; // tuile raccordable : 2 x 2 périodes du motif
export const ROAD_RECT = new THREE.Vector4(
  ROAD[0] / SIZE,
  ROAD[1] / SIZE,
  ROAD[2] / SIZE,
  ROAD[3] / SIZE
);
export const ROAD_ASPECT = ROAD[3] / ROAD[2]; // hauteur / largeur du motif
