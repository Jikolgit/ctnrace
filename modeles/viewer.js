import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { atlas } from '../src/atlas.js';
import { MODEL_CATEGORIES } from './catalog.js';

// Visualiseur de modèles 3D (/modeles) : un modèle de models.glb à la fois, sur une scène simple (lumières + grille),
// qu'on fait tourner (glisser), zoomer (molette, pincement) et qu'on peut afficher en fil de fer. Les modèles
// (listés dans catalog.js) prennent l'atlas bikeTXT comme dans le jeu, mais sans l'effet cartoon ni le pilote.
const canvas = document.getElementById('view');
const status = document.getElementById('status');
const tabs = document.getElementById('tabs');
const chips = document.getElementById('chips');
const nameEl = document.getElementById('name');
const nodeEl = document.getElementById('node');
const sizeEl = document.getElementById('size');
const wheelsEl = document.getElementById('wheels');
const trianglesEl = document.getElementById('triangles');
const spinBox = document.getElementById('spin');
const wireBox = document.getElementById('wire');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15181c);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(3, 6, 4);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.6);
fill.position.set(-4, 2, -3);
scene.add(fill);
scene.add(new THREE.GridHelper(20, 40, 0x3a4048, 0x262b31));

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.5;
controls.maxPolarAngle = Math.PI / 2 - 0.02; // la caméra reste au-dessus du sol
controls.enablePan = false;

atlas.anisotropy = renderer.capabilities.getMaxAnisotropy();
const atlasMaterial = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.65, metalness: 0 });
const plainMaterial = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.65, metalness: 0 });

const loaded = new Map(); // node → { entry, object, center, radius, size, wheels, triangles }
let currentCategory = MODEL_CATEGORIES[0];
let current = null;

const format = (value) => value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

// Place la caméra devant le modèle (trois quarts avant), à la distance qui le cadre en entier
function frame(model) {
  const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
  const fit = Math.min(1, camera.aspect); // écran étroit : la largeur décide
  const distance = (model.radius * 1.0) / Math.tan(halfFov) / fit;
  const direction = new THREE.Vector3(1, 0.45, -1.2).normalize();
  controls.target.copy(model.center);
  camera.position.copy(model.center).addScaledVector(direction, distance);
  controls.minDistance = model.radius * 0.8;
  controls.maxDistance = model.radius * 8;
  controls.update();
}

function show(model) {
  current = model;
  for (const other of loaded.values()) other.object.visible = other === model;
  nameEl.textContent = model.entry.label;
  nodeEl.textContent = model.entry.node;
  sizeEl.textContent = `${format(model.size.z)} m de long × ${format(model.size.x)} m de large × ${format(model.size.y)} m de haut`;
  wheelsEl.textContent = model.wheels;
  trianglesEl.textContent = model.triangles.toLocaleString('fr-FR');
  for (const button of chips.children) button.setAttribute('aria-pressed', String(button.dataset.node === model.entry.node));
  frame(model);
}

function buildChips() {
  chips.innerHTML = '';
  for (const entry of currentCategory.models) {
    const model = loaded.get(entry.node);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = entry.label;
    button.dataset.node = entry.node;
    button.setAttribute('aria-pressed', 'false');
    button.disabled = !model; // absent du fichier
    if (model) button.addEventListener('click', () => show(model));
    chips.append(button);
  }
}

function selectCategory(category) {
  currentCategory = category;
  for (const button of tabs.children) button.setAttribute('aria-pressed', String(button.dataset.id === category.id));
  buildChips();
  const first = category.models.map((entry) => loaded.get(entry.node)).find(Boolean);
  if (first) show(first);
}

for (const category of MODEL_CATEGORIES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = category.label;
  button.dataset.id = category.id;
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => selectCategory(category));
  tabs.append(button);
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

spinBox.addEventListener('change', () => (controls.autoRotate = spinBox.checked));
wireBox.addEventListener('change', () => {
  atlasMaterial.wireframe = wireBox.checked;
  plainMaterial.wireframe = wireBox.checked;
});
document.getElementById('reset').addEventListener('click', () => current && frame(current));

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

new GLTFLoader().load(
  `${import.meta.env.BASE_URL}models.glb`,
  (gltf) => {
    for (const category of MODEL_CATEGORIES) {
      for (const entry of category.models) {
        const object = gltf.scene.getObjectByName(entry.node);
        if (!object) continue;
        object.removeFromParent();
        object.position.set(0, 0, 0); // placés côte à côte dans Blender
        object.rotation.set(0, entry.rotationY ?? 0, 0);
        let wheels = 0;
        let triangles = 0;
        object.traverse((child) => {
          if (!child.isMesh) return;
          child.material = entry.plainParts?.test(child.name) ? plainMaterial : atlasMaterial;
          if (/wheel|roue/i.test(child.name)) wheels++;
          const geometry = child.geometry;
          triangles += (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;
        });
        object.visible = false;
        scene.add(object);
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        loaded.set(entry.node, { entry, object, center, size, radius: size.length() / 2, wheels, triangles });
      }
    }
    status.hidden = true;
    selectCategory(currentCategory);
  },
  undefined,
  (error) => {
    console.error('Impossible de charger models.glb', error);
    status.textContent = 'Impossible de charger les modèles.';
  }
);
