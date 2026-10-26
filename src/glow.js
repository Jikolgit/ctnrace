import * as THREE from 'three';
import { applyWorldBend } from './worldBend.js';

// Points lumineux (phares des voitures, feu arrière de la moto) : petits disques à texture de halo (dégradé
// radial dessiné en canvas), sans éclairage et en mélange additif : ils brillent dans la nuit sans coûter de
// vraie lumière. Les disques regardent vers +Z (tourner de 180° pour regarder vers -Z).

let glowTexture = null;

function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

// Matériau de halo d'une couleur donnée (courbure du monde comprise)
export function glowMaterial(color) {
  return applyWorldBend(
    new THREE.MeshBasicMaterial({
      color,
      map: getGlowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
}

const glowGeometry = new THREE.CircleGeometry(0.5, 16); // diamètre 1 : mis à l'échelle par chaque point

// Disque de halo de diamètre size, regardant vers +Z (facing = 1) ou -Z (facing = -1)
export function glowDisc(material, size, facing = 1) {
  const disc = new THREE.Mesh(glowGeometry, material);
  disc.scale.setScalar(size);
  if (facing < 0) disc.rotation.y = Math.PI;
  return disc;
}
