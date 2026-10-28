import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyWorldBend } from './worldBend.js';
import { settings } from './settings.js';

// Effet cartoon (moto) :
//  - éclairage en aplats (MeshToonMaterial) : la lumière est découpée en TONES paliers nets
//    au lieu d'un dégradé lisse ;
//  - contour noir : une copie de chaque pièce, gonflée le long des normales dans le vertex shader et
//    dont on n'affiche que les faces arrière (« inverted hull ») ; elle dépasse autour de la pièce
//    et dessine un trait.

// Interrupteur de l'effet (false : rendu normal MeshStandardMaterial, sans contour), réglé dans l'interface admin
// (/admin, réglage « cartoon » de gameSettings.js ; actif par défaut).
export const CARTOON = settings.cartoon;

// Effet adouci (octobre 2026, demande de l'utilisateur ; avant : [90, 170, 255] et 0,022 m) : paliers plus proches
// (ombres moins tranchées) et palier clair plus bas (les couleurs ne sont plus blanchies)
const TONES = [130, 180, 220]; // luminosité de chaque palier (ombre, mi-ombre, lumière), 0-255
const OUTLINE_COLOR = 0x111111;
const OUTLINE_WIDTH = 0.015; // épaisseur du contour, en mètres

// Dégradé en paliers, lu sans lissage (NearestFilter) pour garder des limites nettes
const gradientMap = new THREE.DataTexture(new Uint8Array(TONES), TONES.length, 1, THREE.RedFormat);
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

// Version cartoon d'un matériau : même couleur, texture et lumière émise (feux), éclairage en paliers
export function toToon(material) {
  if (!CARTOON) return applyWorldBend(material); // rendu normal : le matériau tel quel
  return applyWorldBend(
    new THREE.MeshToonMaterial({
      name: material.name,
      color: material.color,
      map: material.map ?? null,
      emissive: material.emissive ?? new THREE.Color(0),
      emissiveMap: material.emissiveMap ?? null,
      transparent: material.transparent,
      opacity: material.opacity,
      side: material.side,
      gradientMap,
    })
  );
}

// Matériau du contour : partagé par toutes les pièces
const outlineMaterial = applyWorldBend(
  new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide })
);
const bend = outlineMaterial.onBeforeCompile;
outlineMaterial.onBeforeCompile = (shader, renderer) => {
  bend(shader, renderer);
  shader.uniforms.uOutlineWidth = { value: OUTLINE_WIDTH };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uOutlineWidth;')
    .replace(
      '#include <begin_vertex>',
      // Gonfle la pièce le long de ses normales (repère de l'objet)
      '#include <begin_vertex>\ntransformed += normalize( normal ) * uOutlineWidth;'
    );
};

// Géométrie du contour : les sommets d'un même coin sont fusionnés et leurs normales moyennées.
// Avec les normales « plates » du modèle low poly, chaque face gonflerait dans sa propre direction
// et le contour serait coupé aux arêtes vives.
function outlineGeometry(geometry) {
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', geometry.getAttribute('position'));
  if (geometry.index) shape.setIndex(geometry.index);
  const merged = mergeVertices(shape, 1e-4);
  merged.computeVertexNormals();
  return merged;
}

// Ajoute le contour d'une pièce : enfant qui suit ses mouvements (roues, inclinaison)
export function addOutline(mesh) {
  if (!CARTOON) return;
  const outline = new THREE.Mesh(outlineGeometry(mesh.geometry), outlineMaterial);
  outline.name = `${mesh.name}_Contour`;
  outline.renderOrder = mesh.renderOrder;
  mesh.add(outline);
}
