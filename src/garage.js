import * as THREE from 'three';

// Écran « Moto » du menu principal : aperçu 3D de la moto choisie, qui tourne lentement sur elle-même (dans la
// partie libre de l'écran), et une vignette par moto pour la choisir, avec une miniature rendue par l'aperçu. Le choix est gardé dans le navigateur (localStorage).
// L'aperçu a son propre renderer (canvas #garage-preview) et sa propre petite scène, avec des copies des
// motos du GLB (géométries et matériaux partagés) ; il ne tourne que pendant que l'écran est ouvert.

const STORAGE_KEY = 'ctnrace-bike';
const SPIN_SPEED = 0.6; // rad/s
const CAMERA_POSITION = new THREE.Vector3(2.2, 1.3, 2.4);
const CAMERA_TARGET = new THREE.Vector3(0, 0.55, 0);
const FRAME_ASPECT = 1.4; // format pour lequel CAMERA_POSITION cadre la moto ; plus étroit : la caméra recule
const THUMB_SIZE = 256; // px : miniatures des vignettes
const THUMB_ANGLE = -0.7; // rad : moto vue de trois quarts avant dans les miniatures
const CHECK_ICON = `<svg class="check" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11"
  fill="#2ed35a" stroke="#0f241d" stroke-width="2"/><path d="M6.5 12.5l3.5 3.5 7-8" fill="none" stroke="#fff"
  stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Moto gardée d'une partie à l'autre (null si aucune ou inconnue)
// Motos renommées dans models.glb (octobre 2026) : un ancien choix gardé reste valable
const RENAMED = { MotoCub: 'bike_1', Moto: 'bike_2' };

export function savedBike(names) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const name = RENAMED[stored] ?? stored;
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

// canvas : aperçu ; list : conteneur des vignettes ; description : texte de la moto choisie ;
// bikes : [{ name, label, desc }] ; onSelect(name) : appelé au choix d'une moto
export function createGarage(canvas, list, description, bikes, onSelect) {
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

  // Vignettes de choix
  const cards = new Map();
  const thumbs = new Map(); // nom → <img> de la miniature
  let thumbsDone = false;
  for (const bike of bikes) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'bike-tile';
    card.innerHTML = `<span class="art"><img alt="" /></span><span class="label">${bike.label}</span>${CHECK_ICON}`;
    thumbs.set(bike.name, card.querySelector('img'));
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
    description.textContent = bikes.find((bike) => bike.name === name)?.desc ?? '';
    for (const [key, model] of models) model.visible = key === name;
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    if (canvas.width !== Math.round(width * renderer.getPixelRatio())) renderer.setSize(width, height, false);
    camera.aspect = width / height;
    placeCamera(Math.max(1, FRAME_ASPECT / camera.aspect));
  }

  // Caméra sur l'axe CAMERA_TARGET → CAMERA_POSITION, éloignée de factor (zone étroite : la moto reste entière)
  function placeCamera(factor) {
    camera.position.subVectors(CAMERA_POSITION, CAMERA_TARGET).multiplyScalar(factor).add(CAMERA_TARGET);
    camera.lookAt(CAMERA_TARGET);
    camera.updateProjectionMatrix();
  }

  // Miniatures des vignettes : chaque moto rendue une fois, de trois quarts, en image carrée (dès que toutes
  // les motos sont chargées). L'aperçu reprend ensuite sa taille et sa moto.
  function renderThumbs() {
    renderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
    camera.aspect = 1;
    placeCamera(1.1);
    const spin = turntable.rotation.y;
    turntable.rotation.y = THUMB_ANGLE;
    for (const [name, model] of models) {
      for (const other of models.values()) other.visible = other === model;
      renderer.render(scene, camera);
      thumbs.get(name).src = canvas.toDataURL('image/png');
    }
    turntable.rotation.y = spin;
    for (const [key, model] of models) model.visible = key === current;
    thumbsDone = true;
  }

  function frame(time) {
    if (!open) return;
    const delta = last ? Math.min((time - last) / 1000, 0.1) : 0;
    last = time;
    if (!thumbsDone && models.size === bikes.length) renderThumbs();
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
