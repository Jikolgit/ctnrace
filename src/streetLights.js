import * as THREE from 'three';
import { applyWorldBend } from './worldBend.js';
import { MEDIAN_HEIGHT } from './deliveryCity.js';

// Lampadaires du mode Livraison (modèle « lampadaire » de models.glb) : sur le terre-plein central des grandes
// routes goudronnées (emplacements calculés par deliveryCity.js : userData.lampSpots). Mât gris ; la lampe
// (pièce « lampadaire_light », au bout du bras) brille la nuit et éclaire le sol en dessous.
//
// Lumière au sol : une vraie lumière par lampadaire serait trop lourde (des dizaines de lumières recalculées pour
// chaque pixel, surtout sur téléphone). À la place, une tache lumineuse (disque dégradé, mélange additif : elle
// éclaircit le sol) posée sous chaque lampe. Le tout en InstancedMesh : 3 dessins pour tous les lampadaires.
// Modèle : mât à l'origine, bras vers +X ; angle = rotation autour de Y qui oriente le bras.

const POLE_COLOR = 0x8c9196; // gris
const BULB_COLOR = 0xe8e4d8; // verre de la lampe, éteinte
const BULB_GLOW_COLOR = 0xffd98a; // lumière jaune chaud (lampe à sodium)
const BULB_GLOW = 2.2; // intensité de la lampe allumée
const POOL_REACH = 2.6; // m : distance du mât au centre de la tache (sous la lampe)
const POOL_RADIUS = 5; // m
const POOL_COLOR = 0xffc878;
const POOL_STRENGTH = 0.6; // éclat de la tache au centre (0 à 1)

// Disque blanc au centre, transparent au bord (dégradé doux)
function createPoolTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.55)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Tache de lumière : en mélange additif, le brouillard ne doit pas l'éclaircir de sa couleur mais l'éteindre au loin
// (sinon les taches resteraient visibles au-delà des bâtiments cachés par le brouillard)
function createPoolMaterial() {
  const material = applyWorldBend(
    new THREE.MeshBasicMaterial({
      map: createPoolTexture(),
      color: new THREE.Color(POOL_COLOR).multiplyScalar(POOL_STRENGTH),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true, // dessinée par-dessus la chaussée sans scintiller
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const bend = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    bend(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <fog_fragment>',
      `#ifdef USE_FOG
        gl_FragColor.rgb *= 1.0 - smoothstep( fogNear, fogFar, vFogDepth );
      #endif`
    );
  };
  material.customProgramCacheKey = () => 'street-light-pool';
  return material;
}

// Place les lampadaires dans parent ; renvoie { setOn(allumés) }
export function createStreetLights(parent, template, spots) {
  // Pièces du modèle, avec leur position dans le lampadaire (la lampe est un enfant décalé au bout du bras)
  template.updateMatrixWorld(true);
  const rootInverse = template.matrixWorld.clone().invert();
  let poleGeometry = null;
  let bulbGeometry = null;
  template.traverse((child) => {
    if (!child.isMesh) return;
    const geometry = child.geometry.clone().applyMatrix4(rootInverse.clone().multiply(child.matrixWorld));
    if (/light/i.test(child.name)) bulbGeometry = geometry;
    else poleGeometry = geometry;
  });

  const poleMaterial = applyWorldBend(new THREE.MeshStandardMaterial({ color: POLE_COLOR, roughness: 0.6, metalness: 0.3 }));
  const bulbMaterial = applyWorldBend(
    new THREE.MeshStandardMaterial({ color: BULB_COLOR, emissive: BULB_GLOW_COLOR, emissiveIntensity: 0, roughness: 0.4 })
  );
  const poolGeometry = new THREE.PlaneGeometry(2 * POOL_RADIUS, 2 * POOL_RADIUS).rotateX(-Math.PI / 2);
  const poolMaterial = createPoolMaterial();

  const group = new THREE.Group();
  const meshes = [];
  const instanced = (geometry, material) => {
    if (!geometry) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
    meshes.push(mesh);
    group.add(mesh);
    return mesh;
  };
  const poles = instanced(poleGeometry, poleMaterial);
  const bulbs = instanced(bulbGeometry, bulbMaterial);
  const pools = instanced(poolGeometry, poolMaterial);
  pools.visible = false; // le jour

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  spots.forEach((spot, i) => {
    rotation.setFromAxisAngle(up, spot.angle);
    position.set(spot.x, MEDIAN_HEIGHT, spot.z); // posé sur le terre-plein
    matrix.compose(position, rotation, one);
    poles?.setMatrixAt(i, matrix);
    bulbs?.setMatrixAt(i, matrix);
    // Tache au sol sous la lampe : le bras (+X du modèle) tourné de angle
    position.set(spot.x + Math.cos(spot.angle) * POOL_REACH, 0.02, spot.z - Math.sin(spot.angle) * POOL_REACH);
    pools.setMatrixAt(i, matrix.makeTranslation(position));
  });
  for (const mesh of meshes) mesh.computeBoundingSphere();
  parent.add(group);

  return {
    // Allumés : la lampe brille et la tache éclaire le sol ; seule l'intensité change (pas de recompilation)
    setOn(on) {
      bulbMaterial.emissiveIntensity = on ? BULB_GLOW : 0;
      pools.visible = on;
    },
  };
}
