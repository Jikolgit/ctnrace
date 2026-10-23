import * as THREE from 'three';
import GUI from 'lil-gui';

// Effet de rendu « PlayStation 1 » (PSX), adapté de Jikolgit/psxroom (src/psx.js) pour three.js seul :
//  - image calculée sur ~240 lignes puis agrandie sans lissage (renderer.setPixelRatio + image-rendering: pixelated) ;
//  - sommets accrochés à une grille de l'écran (ils tremblent) ;
//  - textures sans correction de perspective (« affine mapping » : elles se tordent sur les grandes faces) ;
//  - textures sans lissage (NearestFilter) ;
//  - couleurs 15 bits (31 niveaux par canal) avec tramage ordonné Bayer 4 × 4 ;
//  - brouillard noir.
// Les shaders sont ajoutés par applyWorldBend (worldBend.js), par lequel passent tous les matériaux du décor,
// et par psxMaterial() pour les sprites (fumée, bidons). Tout est piloté par des uniforms partagés : le panneau
// de réglages (adresse avec « ?psx ») change toute la scène sans recompiler.

const PSX_DEFAULTS = {
  enabled: true, // coupe tout l'effet d'un coup (retour au rendu d'origine)
  // Hauteur de l'image en pixels (la PS1 affichait environ 240 lignes)
  resolutionHeight: 240,
  // Taille de la grille d'accroche des sommets, en pixels : plus c'est grand, plus ça tremble
  vertexJitter: 2,
  // Textures sans correction de perspective
  affineTextures: true,
  // Textures sans lissage
  nearestTextures: true,
  // Niveaux par canal de couleur (31 = couleurs 15 bits de la PS1)
  colorLevels: 31,
  // Grille de points qui adoucit les dégradés
  dithering: true,
  // Brouillard noir qui mange le fond de la scène (le ciel prend sa couleur). Plus loin que dans psxroom
  // (12 → 28 m) : la ville est grande et la moto roule à 12 m/s, il faut voir venir les carrefours.
  fog: true,
  fogColor: '#000000',
  fogNear: 20,
  fogFar: 55,
};

export const PSX = { ...PSX_DEFAULTS };

// Partagés par tous les matériaux : modifier une valeur change toute la scène
export const psxUniforms = {
  uPsxResolution: { value: new THREE.Vector2(320, 240) },
  uPsxJitter: { value: 0 },
  uPsxAffine: { value: 0 },
  uPsxColorLevels: { value: 255 },
  uPsxDither: { value: 0 },
};

const VERTEX_COMMON = `
uniform vec2 uPsxResolution;
uniform float uPsxJitter;
uniform float uPsxAffine;
varying float vPsxW;`;

// À placer juste après le calcul de gl_Position : accroche à la grille, puis prépare l'UV « affine »
// (multiplié par w ici, redivisé par w dans le fragment shader : la correction de perspective est annulée)
export const psxVertexGLSL = `
if (uPsxJitter > 0.0) {
  vec2 psxGrid = uPsxResolution / (2.0 * uPsxJitter);
  vec4 psxPos = gl_Position;
  psxPos.xy = floor(psxPos.xy / psxPos.w * psxGrid + 0.5) / psxGrid * psxPos.w;
  gl_Position = psxPos;
}
vPsxW = mix(1.0, gl_Position.w, uPsxAffine);
#ifdef USE_MAP
  vMapUv *= vPsxW;
#endif`;

// Tramage ordonné (Bayer 4 × 4) puis réduction du nombre de couleurs
const FRAGMENT_COMMON = `
uniform float uPsxColorLevels;
uniform float uPsxDither;
varying float vPsxW;
float psxBayer2(vec2 p) {
  return mod(2.0 * p.x + 3.0 * p.y, 4.0);
}
float psxBayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  return (4.0 * psxBayer2(mod(q, 2.0)) + psxBayer2(floor(q / 2.0))) / 16.0;
}
vec3 psxDither(vec3 color) {
  float offset = mix(0.5, psxBayer4(gl_FragCoord.xy), uPsxDither);
  return clamp(floor(color * uPsxColorLevels + offset) / uPsxColorLevels, 0.0, 1.0);
}`;

// Textures des matériaux passés par l'effet, avec leurs filtres d'origine : leur filtrage suit le réglage
// « Textures pixelisées »
const textures = new Map(); // texture → { mag, min } d'origine

// Appelé à la création du matériau (pas dans onBeforeCompile : les matériaux qui partagent un même
// programme ne passent qu'une fois par onBeforeCompile)
export function registerTexture(material) {
  const map = material.map;
  if (!map || textures.has(map)) return;
  textures.set(map, { mag: map.magFilter, min: map.minFilter });
  applyFilter(map);
}

function applyFilter(map) {
  const nearest = PSX.enabled && PSX.nearestTextures;
  const original = textures.get(map);
  const mag = nearest ? THREE.NearestFilter : original.mag;
  const min = nearest ? THREE.NearestFilter : original.min;
  if (map.magFilter === mag && map.minFilter === min) return;
  map.magFilter = mag;
  map.minFilter = min;
  // Pas de needsUpdate avant le chargement de l'image (avertissement « no image data found ») :
  // la texture sera de toute façon envoyée avec ces filtres à son chargement
  if (map.image) map.needsUpdate = true;
}

// Ajoute l'effet au shader d'un matériau dont gl_Position est déjà calculé (appelé par applyWorldBend,
// qui a remplacé <project_vertex> et y ajoute psxVertexGLSL lui-même)
export function psxShader(shader) {
  Object.assign(shader.uniforms, psxUniforms);
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${VERTEX_COMMON}`);
  // L'UV de la texture est redivisée par w partout où elle est lue (aussi dans le shader des pavés de road.js,
  // qui remplace <map_fragment> ensuite) : une macro remplace vMapUv par (vMapUv / vPsxW)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAGMENT_COMMON}`)
    .replace(
      '#include <uv_pars_fragment>',
      '#include <uv_pars_fragment>\n#ifdef USE_MAP\n#define vMapUv (vMapUv / vPsxW)\n#endif'
    );
  // À la toute fin : après le brouillard (les sprites n'ont pas de <dithering_fragment>)
  const end = shader.fragmentShader.includes('#include <dithering_fragment>')
    ? '#include <dithering_fragment>'
    : '#include <fog_fragment>';
  shader.fragmentShader = shader.fragmentShader.replace(end, `${end}\ngl_FragColor.rgb = psxDither(gl_FragColor.rgb);`);
}

// Sprites (fumée, bidons) : ils ne passent pas par applyWorldBend
export function psxMaterial(material) {
  registerTexture(material);
  material.onBeforeCompile = (shader) => {
    psxShader(shader);
    shader.vertexShader = shader.vertexShader.replace(
      'gl_Position = projectionMatrix * mvPosition;',
      `gl_Position = projectionMatrix * mvPosition;\n${psxVertexGLSL}`
    );
  };
  return material;
}

// Nombre de pixels de l'image par pixel CSS : ~resolutionHeight lignes pour une fenêtre de hauteur height
export function psxPixelRatio(height) {
  return PSX.enabled ? PSX.resolutionHeight / height : Math.min(window.devicePixelRatio, 2);
}

// renderer : celui du jeu ; scene : sa scène, dont le brouillard (et le ciel, même couleur) suit les réglages
export function createPsx(renderer, scene) {
  const skyColor = scene.background.clone();
  const fogNear = scene.fog.near;
  const fogFar = scene.fog.far;
  const size = new THREE.Vector2();

  function resize() {
    renderer.setPixelRatio(psxPixelRatio(window.innerHeight));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.getDrawingBufferSize(size);
    psxUniforms.uPsxResolution.value.copy(size);
  }

  function apply() {
    const on = PSX.enabled;
    renderer.domElement.style.imageRendering = on ? 'pixelated' : '';
    psxUniforms.uPsxJitter.value = on ? PSX.vertexJitter : 0;
    psxUniforms.uPsxAffine.value = on && PSX.affineTextures ? 1 : 0;
    psxUniforms.uPsxColorLevels.value = on ? PSX.colorLevels : 255;
    psxUniforms.uPsxDither.value = on && PSX.dithering ? 1 : 0;
    for (const map of textures.keys()) applyFilter(map);
    // Pas de bascule de scene.fog (elle recompilerait tous les matériaux) : on change ses valeurs.
    // Le ciel prend la couleur du brouillard (sinon les bâtiments lointains se découpent en noir sur le bleu).
    const psxFog = on && PSX.fog;
    scene.fog.color.set(psxFog ? PSX.fogColor : skyColor);
    scene.background.copy(scene.fog.color);
    scene.fog.near = psxFog ? PSX.fogNear : fogNear;
    scene.fog.far = psxFog ? Math.max(PSX.fogFar, PSX.fogNear + 0.1) : fogFar;
    resize();
  }

  // Panneau de réglages : seulement avec « ?psx » dans l'adresse (comme « ?camera »)
  if (new URLSearchParams(window.location.search).has('psx')) {
    const gui = new GUI({ title: 'Réglages PSX' });
    gui.domElement.classList.add('psx-gui');
    if (window.innerWidth < 600) gui.close();
    gui.add(PSX, 'enabled').name('Effet PSX');
    gui.add(PSX, 'resolutionHeight', 60, 720, 1).name('Résolution (lignes)');
    gui.add(PSX, 'vertexJitter', 0, 8, 0.5).name('Tremblement (px)');
    gui.add(PSX, 'affineTextures').name('Textures tordues');
    gui.add(PSX, 'nearestTextures').name('Textures pixelisées');
    gui.add(PSX, 'colorLevels', 2, 255, 1).name('Couleurs par canal');
    gui.add(PSX, 'dithering').name('Tramage');
    const fogFolder = gui.addFolder('Brouillard');
    fogFolder.add(PSX, 'fog').name('Activé');
    fogFolder.addColor(PSX, 'fogColor').name('Couleur');
    fogFolder.add(PSX, 'fogNear', 0, 80, 0.5).name('Début');
    fogFolder.add(PSX, 'fogFar', 1, 120, 0.5).name('Fin');
    gui.add({ reset: () => gui.reset() }, 'reset').name('Réinitialiser');
    gui.onChange(apply);
  }

  apply();
  return { resize, apply };
}
