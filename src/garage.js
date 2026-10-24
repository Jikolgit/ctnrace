import * as THREE from 'three';

// Écran « Moto » du menu principal : aperçu 3D de la moto choisie, qui tourne lentement sur elle-même,
// et une carte par moto pour la choisir. Le choix est gardé dans le navigateur (localStorage).
// L'aperçu a son propre renderer (canvas #garage-preview) et sa propre petite scène, avec des copies des
// motos du GLB (géométries et matériaux partagés) ; il ne tourne que pendant que l'écran est ouvert.

const STORAGE_KEY = 'ctnrace-bike';
const SPIN_SPEED = 0.6; // rad/s
const CAMERA_POSITION = new THREE.Vector3(2.2, 1.3, 2.4);
const CAMERA_TARGET = new THREE.Vector3(0, 0.55, 0);

// Moto gardée d'une partie à l'autre (null si aucune ou inconnue)
export function savedBike(names) {
  try {
    const name = localStorage.getItem(STORAGE_KEY);
    return names.includes(name) ? name : null;
  } catch {
    return null;
  }
}

export function saveBike(name) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // navigation privée : le choix ne sera pas gardé
  }
}

// canvas : aperçu ; list : conteneur des cartes ; bikes : [{ name, label, desc }] ;
// onSelect(name) : appelé au choix d'une moto
export function createGarage(canvas, list, bikes, onSelect) {
  let renderer = null; // créé à la première ouverture
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.copy(CAMERA_POSITION);
  camera.lookAt(CAMERA_TARGET);
  const turntable = new THREE.Group();
  scene.add(turntable);

  const models = new Map(); // nom → copie de la moto dans l'aperçu
  let current = null;
  let open = false;
  let last = 0;

  // Cartes de choix
  const cards = new Map();
  for (const bike of bikes) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'bike-card';
    card.innerHTML = `<span class="name">${bike.label}</span><span class="desc">${bike.desc}</span>`;
    card.addEventListener('click', () => {
      select(bike.name);
      onSelect(bike.name);
    });
    list.append(card);
    cards.set(bike.name, card);
  }

  // Motos du GLB pour l'aperçu (appelé une fois le modèle chargé) : object = nœud racine de la moto
  function addModel(name, object, rotationY) {
    const copy = object.clone(true);
    copy.position.set(0, 0, 0);
    copy.rotation.set(0, rotationY, 0);
    copy.visible = name === current;
    turntable.add(copy);
    models.set(name, copy);
  }

  function select(name) {
    current = name;
    for (const [key, card] of cards) card.classList.toggle('selected', key === name);
    for (const [key, model] of models) model.visible = key === name;
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    if (canvas.width !== Math.round(width * renderer.getPixelRatio())) renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function frame(time) {
    if (!open) return;
    const delta = last ? Math.min((time - last) / 1000, 0.1) : 0;
    last = time;
    turntable.rotation.y += SPIN_SPEED * delta;
    resize();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function show() {
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
    open = true;
    last = 0;
    requestAnimationFrame(frame);
    cards.get(current)?.focus();
  }

  function hide() {
    open = false;
  }

  return { addModel, select, show, hide };
}
