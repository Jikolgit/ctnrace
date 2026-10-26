import '@fontsource/anton/latin-400.css'; // police étroite des boutons du menu (Anton, intégrée au jeu)
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyWorldBend, bendUniforms } from './worldBend.js';
import { LANE_COUNT, LANE_WIDTH, ROAD_HALF_WIDTH, SIDEWALK_WIDTH, SIDEWALK_HEIGHT, laneX, createRoad } from './road.js';
import { createSmoke } from './smoke.js';
import { createCity } from './city.js';
import { createTrack } from './track.js';
import { toToon, addOutline } from './toon.js';
import { createObstacles } from './obstacles.js';
import { buildGraph, createNetworkTrack, UTURN } from './network.js';
import { createDeliveryCity } from './deliveryCity.js';
import { createMinimap } from './minimap.js';
import { createFuelCans } from './fuelCans.js';
import { MISSION_COUNT, BIKE_CAPACITY, unlockedMission, completeMission, missionData } from './missions.js';
import { createDeliveryPoints } from './deliveryPoints.js';
import { placeStations } from './stations.js';
import { createGuide } from './guide.js';
import { createTraffic } from './traffic.js';
import { extractVehicles, setVehicleLights } from './vehicles.js';
import { glowMaterial, glowDisc } from './glow.js';
import { createCameraTuner } from './cameraTuner.js';
import { DELIVERY_REWARD, FUEL_PRICE, getMoney, addMoney } from './wallet.js';
import { STATIONS, MAP_WIDTH, MAP_HEIGHT } from './deliveryMap.js';
import { atlas } from './atlas.js';
import { createGarage, savedBike, saveBike } from './garage.js';

const canvas = document.getElementById('game');
const distanceDisplay = document.getElementById('distance');
const moneyDisplay = document.getElementById('money');
const pauseDistance = document.getElementById('pause-distance');
const notice = document.getElementById('notice');
const timerDisplay = document.getElementById('timer');
let timerStarted = false;
const pauseButton = document.getElementById('pause');
const pausePanel = document.getElementById('pause-menu');
const resumeButton = document.getElementById('resume');
const pauseMenuButton = document.getElementById('pause-to-menu');
const gameOverPanel = document.getElementById('gameover');
const finalDistance = document.getElementById('final-distance');
const restartButton = document.getElementById('restart');
const arrowLeft = document.getElementById('arrow-left');
const arrowRight = document.getElementById('arrow-right');
const arrowUturn = document.getElementById('arrow-uturn');
const downButton = document.getElementById('down');
const lookBackButton = document.getElementById('look-back');
const challengeButton = document.getElementById('mode-challenge');
const deliveryButton = document.getElementById('mode-delivery');
const minimap = createMinimap(document.getElementById('minimap'));
const fuelGauge = document.getElementById('fuel');
const fuelLevel = fuelGauge.querySelector('.level');
const fuelValue = fuelGauge.querySelector('.value');
const gameOverReason = document.getElementById('gameover-reason');
const startHint = document.getElementById('start-hint');
const cargoCount = document.querySelector('#cargo .count');
const unloadingPanel = document.getElementById('unloading');
const unloadingLevel = unloadingPanel.querySelector('.level');
const unloadingLabel = unloadingPanel.querySelector('.label');
const missionPanel = document.getElementById('mission-complete');
const missionSummary = document.getElementById('mission-summary');

// Indication « Appuie sur ← pour partir » : side = côté du trottoir où attend la moto (+1 droite, -1 gauche),
// la flèche à presser est celle qui ramène vers la route
// uturn : ajoute « ↓ demi-tour » (demi-tour possible depuis le trottoir)
function showStartHint(side, verb, uturn = false) {
  const left = side > 0;
  startHint.innerHTML = `Appuie sur <span class="key-keyboard">${left ? '←' : '→'}</span><span class="key-touch">${
    left ? '◀' : '▶'}</span> pour ${verb}${
    uturn ? ' · <span class="key-keyboard">↓</span><span class="key-touch">▼</span> demi-tour' : ''}<span class="key-keyboard"> · R regarder derrière</span>`;
  startHint.hidden = false;
}
const menuButton = document.getElementById('to-menu');

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// Scène
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // en jeu : couleur selon l'heure (applySkyColor)

// Brouillard de la couleur du ciel : la route (jusqu'à ~110 m devant) et les voitures (apparition à 90 m)
// surgissent dans le brouillard au lieu d'apparaître d'un coup. Distances depuis la caméra.
const FOG_NEAR = 30;
const FOG_FAR = 85;
scene.fog = new THREE.Fog(scene.background, FOG_NEAR, FOG_FAR);

// Caméra
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 3, 6);

// Caméra sur un demi-cercle horizontal centré sur le milieu de la route, devant la moto :
// quand la moto change de couloir, la caméra glisse sur l'arc et regarde toujours ce point.
const CAMERA_HEIGHT = 3;
const CAMERA_PIVOT_Z = -12; // milieu de la route, 12 m devant la moto
const CAMERA_RADIUS = 6 - CAMERA_PIVOT_Z; // la caméra reste à z = 6 quand la moto est au centre
const CAMERA_FOLLOW = 0.6; // 1 = la caméra arrive derrière la moto ; 0,6 = elle reste un peu décalée vers le
// centre de la route (côté opposé) quand la moto est sur un couloir latéral : on voit le flanc de la moto
const CAMERA_LOOK_Y = CAMERA_HEIGHT - (CAMERA_HEIGHT - 1) * CAMERA_RADIUS / 6; // garde l'inclinaison vers le bas d'origine
// Écran en portrait (téléphone tenu droit) : le champ de vision horizontal est étroit et la moto, sur un couloir
// latéral ou garée sur le trottoir, sortait de l'image. La caméra vient alors derrière la moto et regarde à
// mi-chemin entre le milieu de la route et la moto.
const CAMERA_FOLLOW_PORTRAIT = 1;
const CAMERA_LOOK_FOLLOW_PORTRAIT = 0.5;
const cameraLookAt = new THREE.Vector3();
let cameraAngle = 0;
// Dans les virages, la caméra tourne avec un léger retard sur la moto (plus doux, on voit la moto pivoter)
let cameraHeading = 0;
const CAMERA_TURN_DAMPING = 5;

// Regard en arrière (touche R maintenue, ou bouton tactile maintenu) : seulement quand la moto est garée sur le
// trottoir, pour voir si une voiture arrive avant de repartir. La caméra passe devant la moto et regarde
// derrière elle ; au relâchement (ou au départ de la moto), elle revient en douceur derrière la moto.
const LOOK_BACK_HEIGHT = 3.2;
const LOOK_BACK_Z = -4; // m devant la moto
const LOOK_BACK_FOLLOW = 0.6; // décalée vers le milieu de la route (la moto est sur le trottoir)
const LOOK_BACK_DISTANCE = 30; // point regardé, m derrière la moto, au milieu de la route
const LOOK_BACK_DAMPING = 8; // vitesse de la bascule
let lookingBack = false; // touche ou bouton maintenu
let lookBackBlend = 0; // 0 = vue normale, 1 = vue arrière
const normalCameraPosition = new THREE.Vector3();
const normalLookAt = new THREE.Vector3();
const lookBackPosition = new THREE.Vector3();
const lookBackTarget = new THREE.Vector3();

// Vue d'hélicoptère (choix de l'utilisateur) : caméra haute, un peu en arrière de la moto, qui regarde vers le
// bas, devant la moto (on voit la rue et les carrefours qui arrivent). HELICOPTER_VIEW = false : vue d'origine,
// derrière la moto, à 3 m de haut.
const HELICOPTER_VIEW = false;
// Valeurs choisies par l'utilisateur avec l'outil ?camera
const HELI_X = -0.5; // m : décalage latéral (< 0 : à gauche de la moto)
const HELI_HEIGHT = 6; // m au-dessus de la route
const HELI_BACK = 7; // m en arrière de la moto
const HELI_LOOK_Y = -2.5; // m : hauteur du point visé (sous la route : regard plus plongeant)
const HELI_LOOK_AHEAD = 7; // m : point visé devant la moto
const HELI_FOLLOW = 0.7; // suit les changements de couloir (1 = à la verticale du couloir de la moto)
let heliX = 0; // décalage latéral de la caméra d'hélicoptère (amorti)
// Placement de la caméra d'hélicoptère, relatif à la moto ; réglable en jeu avec « ?camera » dans l'adresse
const heliCamera = { x: HELI_X, y: HELI_HEIGHT, z: HELI_BACK, lookY: HELI_LOOK_Y, lookZ: -HELI_LOOK_AHEAD };
createCameraTuner(heliCamera);

function updateCamera(delta) {
  if (HELICOPTER_VIEW) {
    heliX = THREE.MathUtils.damp(heliX, player.position.x * HELI_FOLLOW, 6, delta);
    camera.position.set(heliX + heliCamera.x, heliCamera.y, heliCamera.z);
    cameraLookAt.set(heliX + heliCamera.x, heliCamera.lookY, heliCamera.lookZ);
  } else {
    placeChaseCamera(delta);
  }

  // Bascule vers la vue arrière (moto garée seulement)
  const back = lookingBack && !started && !gameOver && !inMenu ? 1 : 0;
  lookBackBlend = THREE.MathUtils.damp(lookBackBlend, back, LOOK_BACK_DAMPING, delta);
  if (lookBackBlend > 0.001) {
    normalCameraPosition.copy(camera.position);
    normalLookAt.copy(cameraLookAt);
    lookBackPosition.set(player.position.x * LOOK_BACK_FOLLOW, LOOK_BACK_HEIGHT, LOOK_BACK_Z);
    lookBackTarget.set(0, 0.5, LOOK_BACK_DISTANCE);
    camera.position.lerpVectors(normalCameraPosition, lookBackPosition, lookBackBlend);
    cameraLookAt.lerpVectors(normalLookAt, lookBackTarget, lookBackBlend);
  }

  // Retard dans les virages : tout le placement de la caméra pivote autour du joueur
  cameraHeading = THREE.MathUtils.damp(cameraHeading, playerHeading, CAMERA_TURN_DAMPING, delta);
  const lag = cameraHeading - playerHeading;
  camera.position.applyAxisAngle(Y_AXIS, lag);
  cameraLookAt.applyAxisAngle(Y_AXIS, lag);
  camera.lookAt(cameraLookAt);
}

// Vue d'origine : caméra derrière la moto, sur un arc centré sur le milieu de la route
function placeChaseCamera(delta) {
  // Angle sur l'arc qui amène la caméra au-dessus du couloir de la moto
  const portrait = camera.aspect < 1;
  const follow = portrait ? CAMERA_FOLLOW_PORTRAIT : CAMERA_FOLLOW;
  const targetX = THREE.MathUtils.clamp(player.position.x * follow, -CAMERA_RADIUS, CAMERA_RADIUS);
  const targetAngle = Math.asin(targetX / CAMERA_RADIUS);
  cameraAngle = THREE.MathUtils.damp(cameraAngle, targetAngle, 6, delta);
  camera.position.set(
    CAMERA_RADIUS * Math.sin(cameraAngle),
    CAMERA_HEIGHT,
    CAMERA_PIVOT_Z + CAMERA_RADIUS * Math.cos(cameraAngle)
  );
  cameraLookAt.set(portrait ? player.position.x * CAMERA_LOOK_FOLLOW_PORTRAIT : 0, CAMERA_LOOK_Y, CAMERA_PIVOT_Z);
}

// Caméra libre à la souris (développement) : mettre à true. Désactive la caméra sur l'arc.
const DEBUG_ORBIT = false;
let controls = null;
if (DEBUG_ORBIT) {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  controls.update();
}

// Lumières (intensités de jour ; baissées le soir et la nuit en jeu : applySkyColor)
const HEMI_INTENSITY = 1.2;
const SUN_INTENSITY = 2;
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, HEMI_INTENSITY);
scene.add(hemiLight);
const sun = new THREE.DirectionalLight(0xffffff, SUN_INTENSITY);
sun.position.set(5, 10, 5);
scene.add(sun);

// Monde : la route, les bâtiments et les voitures sont posés le long du parcours (track.js), dans ce
// groupe. À chaque image, le groupe est déplacé et tourné pour amener le joueur en (0, 0, 0), face à -Z :
// le joueur et la caméra ne bougent pas, c'est la ville qui défile et pivote dans les virages.
const world = new THREE.Group();
scene.add(world);

// Deux décors dans world, un par mode : la ville infinie du mode Défis (rues créées et recyclées au fil
// du parcours) et la ville fixe du mode Livraison (réseau de deliveryMap.js, construit au premier lancement)
const challengeWorld = new THREE.Group();
const deliveryWorld = new THREE.Group();
deliveryWorld.visible = false;
world.add(challengeWorld, deliveryWorld);

const road = createRoad(challengeWorld);
const city = createCity(scene, challengeWorld);
const track = createTrack({
  add(leg) {
    road.addLeg(leg);
    city.addLeg(leg);
  },
  remove(leg) {
    road.removeLeg(leg);
    city.removeLeg(leg);
  },
});

const START_S = 20; // position de départ sur le parcours (laisse un peu de route derrière)
let playerS = START_S;
let playerHeading = 0; // direction du joueur (theta du parcours)
track.update(playerS);

// Mode Livraison : parcours dans le réseau de rues (même interface que track)
const graph = buildGraph();
const network = createNetworkTrack(graph);
let deliveryCity = null;
let traffic = null; // circulation (Livraison), créée quand la ville et le modèle de voiture sont prêts
let carModels = null; // véhicules car_1, car_2, car_3 (models.glb, vehicles.js), une fois chargés
let fuelCans = null; // bidons d'essence (Livraison), créés avec la ville
let deliveryPoints = null; // flèches de livraison de la mission (Livraison), créées avec la ville
let stationPoints = null; // points d'arrêt bleus devant les stations essence (Livraison)
let guide = null; // ligne de guidage vers l'objectif (premières missions de Livraison)
const GUIDE_MISSIONS = 2; // missions avec ligne de guidage
let loaded = true; // produits chargés (false tant que le point de chargement de la mission n'est pas atteint)
// Capacité de la moto (BIKE_CAPACITY) : onBoard = produits transportés (leurs points de livraison sont affichés),
// toLoad = produits encore au point de chargement. Moto vide et produits restants : retour au chargement.
let onBoard = [];
let toLoad = [];

// Objectifs de la ligne de guidage : le point de chargement, puis les livraisons restantes
function refreshGuide() {
  if (!guide) return;
  const { pickup, deliveries } = missionData(currentMission);
  if (currentMission > GUIDE_MISSIONS) guide.setObjectives([]);
  else if (!loaded) guide.setObjectives([pickup]);
  else guide.setObjectives(onBoard.filter((_, i) => deliveryPoints.isActive(i)));
}
let stationTemplate = null; // modèle StationEssence (models.glb), une fois chargé
let stationsPlaced = false;

// Pose les bâtiments des stations dès que la ville et le modèle sont prêts (l'un ou l'autre peut arriver en
// premier : chargement du GLB / premier lancement du mode Livraison)
function placeStationsIfReady() {
  if (stationsPlaced || !deliveryCity || !stationTemplate) return;
  placeStations(deliveryWorld, stationTemplate);
  stationsPlaced = true;
}

// Parcours du mode en cours : track (Défis) ou network (Livraison)
let activeTrack = track;

// Couloirs de la rue où se trouve le joueur : 3 (petite rue pavée) ou 4 (grande route goudronnée)
const laneCount = () => activeTrack.legAt(playerS).lanes ?? LANE_COUNT;
// Terre-plein central de la rue (grandes routes de Livraison) : les couloirs s'écartent de median / 2 de
// chaque côté, et on ne roule que dans ceux de droite (on roule à droite, comme au Bénin)
const medianOf = () => activeTrack.legAt(playerS).median ?? 0;
// Largeur de couloir de la rue (2 m, 2,5 m sur les grandes routes de Livraison)
const laneWidthNow = () => activeTrack.legAt(playerS).laneWidth ?? LANE_WIDTH;
const laneXOf = (index, count, median = 0, width = LANE_WIDTH) => {
  const x = (index - (count - 1) / 2) * width;
  return x + (Math.sign(x) * median) / 2;
};
// Premier couloir autorisé : avec un terre-plein, seulement la moitié droite de la route
const firstLane = () => (medianOf() > 0 ? laneCount() / 2 : 0);
// Bord de la chaussée (terre-plein compris)
const roadHalfWidth = () => (laneCount() * laneWidthNow() + medianOf()) / 2;

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const playerPoint = new THREE.Vector3();
const minimapPoint = new THREE.Vector3();

// Place le groupe world pour que le point du parcours où se trouve le joueur soit en 0, face à -Z
function placeWorld() {
  playerHeading = activeTrack.pose(playerS, 0, playerPoint);
  world.rotation.y = -playerHeading;
  world.position.copy(playerPoint).applyAxisAngle(Y_AXIS, -playerHeading).negate();
}
placeWorld();

// Virages : dans les TURN_WINDOW derniers mètres avant un carrefour, les flèches possibles clignotent.
// Gauche / droite (ou bas pour le demi-tour) maintenus TURN_HOLD s choisissent le virage ; un appui bref
// change de couloir, comme ailleurs. Sans choix, la moto continue tout droit et percute le mur au bout de la rue.
const TURN_WINDOW = 15;
const TURN_HOLD = 0.5; // s : durée d'appui qui confirme un virage ou un demi-tour
const TURN_CONFIRM_VIBRATION = 40; // ms : vibration quand le virage est confirmé (mobile)

// Rue dont le joueur est dans la fenêtre de virage (choix pas encore fait), sinon null
function turnWindowLeg() {
  const leg = activeTrack.pendingLeg();
  return leg && playerS >= leg.sArcStart - TURN_WINDOW ? leg : null;
}

function updateArrows() {
  const leg = gameOver || inMenu ? null : turnWindowLeg();
  const left = !!leg && leg.options.includes(-1);
  const right = !!leg && leg.options.includes(1);
  if (arrowLeft.hidden === left) arrowLeft.hidden = !left;
  if (arrowRight.hidden === right) arrowRight.hidden = !right;
  const uturn = canUturn(leg);
  if (arrowUturn.hidden === uturn) arrowUturn.hidden = !uturn;
  // Flèche en U dessinée vers la droite : retournée pour un demi-tour vers la gauche (depuis un couloir de droite,
  // même règle que dans updateTurnHold)
  const uturnLeft = uturn && player.position.x >= 0;
  if (arrowUturn.classList.contains('to-left') !== uturnLeft) arrowUturn.classList.toggle('to-left', uturnLeft);
  // Les flèches sont invisibles ; pendant l'appui qui confirme un virage, celle du virage se remplit de sa
  // couleur, de la queue vers la pointe (--hold : 0 → 1, plein au bout de TURN_HOLD s, quand le virage est pris)
  const holdArrow = turnHold.dir === null ? null : HOLD_ARROWS[turnHold.dir];
  for (const arrow of HOLD_ARROWS_LIST) {
    const progress = arrow === holdArrow ? Math.min(1, turnHold.time / TURN_HOLD).toFixed(3) : '0';
    if (arrow.style.getPropertyValue('--hold') !== progress) arrow.style.setProperty('--hold', progress);
  }
  const down = uturn || (!gameOver && !inMenu && canParkedUturn());
  if (downButton.hidden === down) downButton.hidden = !down;
  const look = !started && !gameOver && !inMenu;
  if (lookBackButton.hidden === look) lookBackButton.hidden = !look;
  if (!look) lookingBack = false;
}

// Distance parcourue tout droit dans le carrefour avant que l'avant de la moto touche le mur
// (traversée du carrefour + trottoir d'en face)
const WALL_HIT = 2 * ROAD_HALF_WIDTH + SIDEWALK_WIDTH - 0.85;

// Courbure du monde (démo) : coupée à l'approche des carrefours et juste après
function bendFade() {
  const leg = activeTrack.legAt(playerS);
  const toCorner = leg.sArcStart - playerS;
  const fromCorner = playerS - leg.sStart;
  return (
    THREE.MathUtils.clamp((toCorner - 50) / 40, 0, 1) *
    THREE.MathUtils.clamp(fromCorner / 30, 0, 1)
  );
}

// Joueur : groupe déplacé de couloir en couloir, la moto est ajoutée dedans une fois chargée
const player = new THREE.Group();
player.position.set(laneX(1), 0, 0);
scene.add(player);

// Phare de la moto, allumé de HEADLIGHT_ON (20 h) à HEADLIGHT_OFF (6 h), heure de Cotonou : cône de lumière vers
// l'avant (-Z), dans le groupe du joueur (suit les changements de couloir et l'inclinaison). Toujours présent,
// intensité 0 le jour : allumer ou éteindre une lumière ne recompile pas les matériaux.
const HEADLIGHT_INTENSITY = 40;
const HEADLIGHT_ON = 20;
const HEADLIGHT_OFF = 6;
const headlight = new THREE.SpotLight(0xfff2d0, 0, 45, 0.42, 0.5, 1);
headlight.position.set(0, 1.1, -0.9);
headlight.target.position.set(0, 0, -18);
player.add(headlight, headlight.target);

// Feu arrière (stop) de la moto : petit disque rouge sombre, qui s'illumine (rouge vif + halo) quand la moto freine
// (frein maintenu, arrêt à un point de livraison, panne d'essence). Placé à l'arrière de la moto choisie, d'après
// sa boîte englobante (placeTailLight).
const tailLightMaterial = applyWorldBend(new THREE.MeshBasicMaterial({ color: 0x5a0d0d }));
const tailLight = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), tailLightMaterial);
const tailGlow = glowDisc(glowMaterial(0xff1a10), 0.6);
tailGlow.visible = false;
tailLight.add(tailGlow);
tailGlow.position.z = 0.01;
player.add(tailLight);
const TAIL_LIGHT_HEIGHT = 0.6; // part de la hauteur de la moto (rétroviseurs compris)
const TAIL_LIGHT_OFF = new THREE.Color(0x5a0d0d);
const TAIL_LIGHT_ON = new THREE.Color(0xff2a1a);
const bikeBox = new THREE.Box3();

function placeTailLight(object) {
  player.updateMatrixWorld(true);
  bikeBox.setFromObject(object);
  player.worldToLocal(bikeBox.min);
  player.worldToLocal(bikeBox.max);
  tailLight.position.set(0, bikeBox.min.y + (bikeBox.max.y - bikeBox.min.y) * TAIL_LIGHT_HEIGHT, bikeBox.max.z + 0.02);
}

function setBrakeLight(on) {
  tailGlow.visible = on;
  tailLightMaterial.color.copy(on ? TAIL_LIGHT_ON : TAIL_LIGHT_OFF);
}

const wheels = []; // roues de la moto en cours

// Fumée : sort du bout du pot (repère de la moto : à droite, à l'arrière)
const smoke = createSmoke(scene);
const exhaustWorld = new THREE.Vector3();

// Atlas de textures (moto + pilote) : cases de couleur unie et visage dessiné du pilote.
// Filtrage lissé pour le visage ; les UV des couleurs visent le centre des cases, donc pas de fondu.
atlas.anisotropy = renderer.capabilities.getMaxAnisotropy();
const atlasMaterial = applyWorldBend(
  new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.65, metalness: 0 })
);
const toonAtlasMaterial = toToon(new THREE.MeshStandardMaterial({ map: atlas })); // ancienne moto

// Motos jouables : chacune a sa pose de pilote (animation du GLB) et sa position de pilote
const BIKES = {
  Moto: {
    wheels: ['Moto_Wheel_Front', 'Moto_Wheel_Rear'],
    wheelRadius: 0.31,
    spinSign: -1,
    rotationY: 0,
    exhaust: new THREE.Vector3(0.17, 0.3, 0.95),
    riderPosition: new THREE.Vector3(0, 0.133, 0.355),
    ride: 'Ride',
  },
  MotoCub: {
    wheels: ['MotoCub_Roue_Avant', 'MotoCub_Roue_Arriere'],
    wheelRadius: 0.265,
    spinSign: 1, // la MotoCub est retournée : l'axe local des roues est inversé
    rotationY: Math.PI, // modélisée avant vers +Z : on la retourne vers la route (-Z)
    exhaust: new THREE.Vector3(0.225, 0.29, 0.92),
    riderPosition: new THREE.Vector3(0, 0.038, 0.065),
    ride: 'Ride_MotoCub',
  },
};
const DEFAULT_BIKE = 'MotoCub';
// Écran « Moto » du menu : nom affiché et description de chaque moto
const BIKE_CARDS = [
  { name: 'MotoCub', label: 'MotoCub', desc: 'Petite moto rouge, maniable en ville.' },
  { name: 'Moto', label: 'Moto classique', desc: 'La première moto du jeu.' },
];
let bikeName = savedBike(Object.keys(BIKES)) ?? DEFAULT_BIKE;
let bike = BIKES[bikeName];
let selectBike = null; // défini une fois le modèle chargé

let obstacles = null; // créé une fois le modèle de voiture chargé

new GLTFLoader().load(
  `${import.meta.env.BASE_URL}models.glb`,
  (gltf) => {
    const moto = gltf.scene;

    // Véhicules (car_1, car_2, car_3) : retirés de la scène du joueur, ils servent de gabarits aux voitures des
    // deux modes (texture : atlas bikeTXT)
    const vehicles = extractVehicles(moto, atlasMaterial);

    // Station essence : retirée de la scène du joueur, elle sert de gabarit aux stations de la ville
    // (texture : atlas bikeTXT). Le château d'eau et le cylindre du GLB ne sont pas encore utilisés : retirés
    // eux aussi, sinon ils suivraient la moto.
    const station = moto.getObjectByName('StationEssence');
    if (station) {
      station.removeFromParent();
      station.position.set(0, 0, 0); // placée à l'écart dans Blender
      station.traverse((child) => {
        if (child.isMesh) child.material = atlasMaterial;
      });
      stationTemplate = station;
      placeStationsIfReady();
    }
    for (const unused of ['ChateauEau_Vedoko', 'Cylinder']) moto.getObjectByName(unused)?.removeFromParent();

    const rider = moto.getObjectByName('Character_Rig');
    const mixer = new THREE.AnimationMixer(moto);

    // Affiche une moto, cache les autres, et assied le pilote avec la pose propre à cette moto
    selectBike = (name) => {
      bikeName = name;
      bike = BIKES[name];
      for (const [key, config] of Object.entries(BIKES)) {
        const object = moto.getObjectByName(key);
        if (!object) continue;
        object.visible = key === name;
        object.position.set(0, 0, 0); // les motos sont placées côte à côte dans Blender
        object.rotation.y = config.rotationY;
      }
      wheels.length = 0;
      for (const wheelName of bike.wheels) wheels.push(moto.getObjectByName(wheelName));
      if (moto.parent) placeTailLight(moto.getObjectByName(name));

      rider.position.copy(bike.riderPosition);
      mixer.stopAllAction();
      const ride = THREE.AnimationClip.findByName(gltf.animations, bike.ride);
      if (ride) {
        mixer.clipAction(ride).play();
        mixer.update(0); // pose figée : inutile de mettre à jour à chaque frame
      }
    };

    // Pièces des motos en style cartoon (aplats + contour noir, voir toon.js) ; pilote inchangé.
    // Les maillages sont listés d'abord : addOutline ajoute des enfants pendant le parcours.
    const meshes = [];
    moto.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });
    for (const child of meshes) {
      if (child.name.startsWith('MotoCub') || child.name.startsWith('Moto_')) {
        // Motos : atlas bikeTXT (le GLB est exporté sans matériaux), en cartoon. La MotoCub a sa palette dans
        // l'atlas : ses pièces doivent avoir des UV dessus (sinon elles prennent la couleur du coin de l'atlas)
        child.material = toonAtlasMaterial;
        addOutline(child);
      } else {
        child.material = atlasMaterial; // pilote : atlas bikeTXT
      }
    }

    player.add(moto);
    selectBike(bikeName);
    // Copies des motos pour l'aperçu de l'écran « Moto »
    for (const [key, config] of Object.entries(BIKES)) {
      const object = moto.getObjectByName(key);
      if (object) garage.addModel(key, object, config.rotationY);
    }

    if (vehicles.length) {
      obstacles = createObstacles(challengeWorld, vehicles, track);
      carModels = vehicles;
    }
  },
  undefined,
  (error) => console.error('Impossible de charger models.glb', error)
);

// Pause : le jeu se fige et le panneau Pause (Reprendre / Menu principal) remplace le bouton Pause
let paused = false;

function setPaused(value) {
  paused = value;
  // Livraison : la distance parcourue n'est plus dans le HUD (remplacée par l'argent), elle est ici
  pauseDistance.textContent = `Distance parcourue : ${Math.floor(distance)} m`;
  pausePanel.hidden = !paused;
  pauseButton.hidden = paused;
  if (paused) resumeButton.focus();
  else resumeButton.blur();
}

function togglePause() {
  if (gameOver || inMenu) return;
  setPaused(!paused);
}

// Game over et nouvelle partie
let gameOver = false;

function endGame(reason = '') {
  gameOver = true;
  gameOverReason.textContent = reason;
  gameOverReason.hidden = !reason;
  finalDistance.textContent = `${Math.floor(distance)} m`;
  gameOverPanel.hidden = false;
  updateArrows();
  restartButton.focus();
}

function restart() {
  setBrakeLight(false);
  distance = 0;
  gameTime = 0;
  resetRoadWave();
  displayedDistance = -1;
  player.rotation.set(0, 0, 0);
  playerS = START_S;
  activeTrack.reset(playerS);
  // Départ à l'arrêt sur le trottoir de droite : « couloir » d'indice laneCount() (juste après le dernier)
  currentLeg = activeTrack.legAt(playerS);
  started = false;
  parkedSide = 1;
  turnHold.dir = null;
  deliveryState = null;
  unloadingPanel.hidden = true;
  missionPanel.hidden = true;
  currentLane = laneCount();
  laneChange.from = laneChange.to = sidewalkX();
  laneChange.t = 1;
  player.position.x = laneChange.to;
  player.position.y = SIDEWALK_HEIGHT;
  showStartHint(1, 'partir');
  placeWorld();
  cameraHeading = playerHeading;
  obstacles?.reset();
  speed = 0;
  braking = false;
  setFuel(FUEL_MAX);
  if (gameMode === 'delivery') {
    activeTrack.pose(playerS, player.position.x, minimapPoint);
    fuelCans.reset(minimapPoint.x, minimapPoint.z);
    const { deliveries, pickup, timeLimit } = missionData(currentMission);
    loaded = !pickup;
    if (pickup) {
      // Il faut d'abord charger les produits : seul le point de chargement est affiché
      toLoad = deliveries.slice();
      onBoard = [];
      deliveryPoints.reset([pickup], 'pickup');
      setCargo(0);
    } else {
      // Produits déjà chargés (mission 1) : les points de livraison sont affichés tout de suite
      onBoard = deliveries.slice(0, BIKE_CAPACITY);
      toLoad = deliveries.slice(BIKE_CAPACITY);
      deliveryPoints.reset(onBoard);
      setCargo(onBoard.length);
    }
    setTimeLeft(timeLimit ?? null);
    timerStarted = false;
    stationPoints.reset(STATIONS, 'fuel');
    if (!traffic && carModels) traffic = createTraffic(deliveryWorld, carModels, graph);
    traffic?.reset(minimapPoint.x, minimapPoint.z);
    refreshGuide();
    ignoredStation = -1;
  }
  updateArrows();
  gameOverPanel.hidden = true;
  gameOver = false;
  restartButton.blur();
}

restartButton.addEventListener('click', restart);

// Menu principal : affiché au lancement, depuis l'écran Game Over et depuis le panneau Pause. La scène reste figée derrière.
// Modes : 'challenge' (Défis : roule sans fin) ; 'delivery' (Livraison : réseau de rues fixe).
let inMenu = true;
let gameMode = null;

// Ville fixe du mode Livraison, construite une seule fois (au lancement : elle sert aussi de fond au menu)
function buildDeliveryCity() {
  if (deliveryCity) return;
  deliveryCity = createDeliveryCity(deliveryWorld, graph);
  fuelCans = createFuelCans(deliveryWorld, graph);
  deliveryPoints = createDeliveryPoints(deliveryWorld);
  stationPoints = createDeliveryPoints(deliveryWorld);
  guide = createGuide(deliveryWorld);
  placeStationsIfReady();
}

// Fond du menu : survol de la ville de Livraison, comme depuis un hélicoptère. La caméra tourne lentement sur une
// ellipse autour du centre de la carte, en regardant le sol devant elle ; la circulation roule en dessous.
// Moto, flèches de livraison et ligne de guidage sont cachées ; le brouillard est repoussé pour voir loin.
const MENU_FLY_RADIUS_X = 150; // m : demi-axes de l'ellipse (carte de 640 × 520 m)
const MENU_FLY_RADIUS_Z = 110;
const MENU_FLY_SPEED = 7; // m/s
const MENU_FLY_HEIGHT = 60; // m (au-dessus des toits)
const MENU_LOOK_AHEAD = 70; // m : point regardé, au sol, devant la caméra
const MENU_FOG_NEAR = 90;
const MENU_FOG_FAR = 190; // < camera.far (200)
const MENU_SIDE_LANDSCAPE = 0.32; // part libre de l'écran (style.css : colonne .menu-side, rangée en portrait)
const MENU_SIDE_PORTRAIT = 0.34;
let menuFlyAngle = Math.random() * Math.PI * 2;
const ground = scene.getObjectByName('ground'); // sol uni (city.js)
const menuFocus = new THREE.Vector3(); // point regardé (repère de la carte : x, z)

function showMenuScene() {
  buildDeliveryCity();
  challengeWorld.visible = false;
  deliveryWorld.visible = true;
  player.visible = false;
  deliveryPoints.reset([]);
  stationPoints.reset([], 'fuel');
  guide.setObjectives([]);
  bendUniforms.uBend.value = 0;
  scene.fog.near = MENU_FOG_NEAR;
  scene.fog.far = MENU_FOG_FAR;
  applySkyColor(cotonouHours()); // ciel, brouillard et lumière selon l'heure de Cotonou, comme en jeu
  world.position.set(0, 0, 0); // la carte est posée telle quelle : la caméra vole dans son repère
  world.rotation.set(0, 0, 0);
  placeMenuCamera(0);
  traffic?.reset(menuFocus.x, menuFocus.z);
}

function placeMenuCamera(delta) {
  const rx = MENU_FLY_RADIUS_X;
  const rz = MENU_FLY_RADIUS_Z;
  // Vitesse constante sur l'ellipse : l'angle avance de (distance / longueur de la tangente)
  let tx = -rx * Math.sin(menuFlyAngle);
  let tz = rz * Math.cos(menuFlyAngle);
  menuFlyAngle += (MENU_FLY_SPEED * delta) / Math.hypot(tx, tz);
  tx = -rx * Math.sin(menuFlyAngle);
  tz = rz * Math.cos(menuFlyAngle);
  const length = Math.hypot(tx, tz);
  const x = MAP_WIDTH / 2 + rx * Math.cos(menuFlyAngle);
  const z = MAP_HEIGHT / 2 + rz * Math.sin(menuFlyAngle);
  camera.position.set(x, MENU_FLY_HEIGHT, z);
  ground?.position.set(x, -0.03, z); // le sol uni suit la caméra (600 m de côté)
  menuFocus.set(x + (tx / length) * MENU_LOOK_AHEAD, 0, z + (tz / length) * MENU_LOOK_AHEAD);
  camera.lookAt(menuFocus);
  // Le panneau du menu couvre la droite (ordinateur : 68 %) ou le bas (téléphone : 66 %) : le centre de la vue
  // (point regardé) est décalé au milieu de la partie libre de l'écran
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (camera.aspect <= 1) camera.setViewOffset(w, h, 0, (0.5 - MENU_SIDE_PORTRAIT / 2) * h, w, h);
  else camera.setViewOffset(w, h, (0.5 - MENU_SIDE_LANDSCAPE / 2) * w, 0, w, h);
}

function startGame(mode) {
  gameMode = mode;
  const delivery = mode === 'delivery';
  if (delivery) buildDeliveryCity();
  player.visible = true; // cachée pendant le survol du menu
  camera.clearViewOffset();
  ground?.position.set(0, -0.03, 0); // de retour sous la moto
  scene.fog.near = FOG_NEAR;
  scene.fog.far = FOG_FAR;
  applySkyColor(cotonouHours()); // ciel et brouillard selon l'heure de Cotonou
  activeTrack = delivery ? network : track;
  challengeWorld.visible = !delivery;
  deliveryWorld.visible = delivery;
  document.body.classList.toggle('delivery', delivery); // affiche la mini-carte
  if (delivery) {
    obstacles?.reset(); // pas encore de voitures en Livraison
    bendUniforms.uBend.value = 0; // rues droites, comme sur le plan
  }
  restart();
  inMenu = false;
  document.body.classList.remove('in-menu', 'in-missions');
}

// Tous les produits livrés : mission réussie, la suivante est débloquée
function finishMission() {
  gameOver = true; // fige la partie (Entrée relance la mission, comme après un Game Over)
  guide?.setObjectives([]); // plus d'objectif : la ligne disparaît
  completeMission(currentMission);
  const total = missionData(currentMission).deliveries.length;
  missionSummary.textContent = `${total} produits livrés en ${Math.floor(distance)} m : +${total * DELIVERY_REWARD} $.`;
  missionPanel.hidden = false;
  startHint.hidden = true;
  updateArrows();
  document.getElementById('complete-missions').focus();
}

document.getElementById('complete-missions').addEventListener('click', () => {
  showMenu();
  showMissions();
});
document.getElementById('complete-menu').addEventListener('click', showMenu);

function showMenu() {
  restart(); // repart d'une scène propre derrière le menu
  setPaused(false);
  inMenu = true;
  showMenuScene();
  document.body.classList.add('in-menu');
  document.body.classList.remove('in-missions');
  challengeButton.focus();
}

// Écran des missions (Livraison) : une case par mission, seules les missions débloquées sont jouables.
// Pour l'instant, chaque mission lance la même partie libre dans le réseau de rues.
const missionGrid = document.querySelector('#missions .grid');
const LOCK_ICON = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3"
  fill="none" stroke="#1b1b1b" stroke-width="2.5"/><rect x="4" y="10" width="16" height="12" rx="2" fill="#1b1b1b"/></svg>`;
let currentMission = 1;

function showMissions() {
  const unlocked = unlockedMission();
  missionGrid.replaceChildren();
  for (let n = 1; n <= MISSION_COUNT; n++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mission';
    button.innerHTML = `<span class="num">${n}</span><span class="label">Mission</span>`;
    if (n > unlocked) {
      button.disabled = true;
      button.insertAdjacentHTML('beforeend', LOCK_ICON);
      button.setAttribute('aria-label', `Mission ${n} (verrouillée)`);
    } else {
      button.setAttribute('aria-label', `Mission ${n}`);
      button.addEventListener('click', () => {
        currentMission = n;
        startGame('delivery');
      });
    }
    missionGrid.append(button);
  }
  document.body.classList.add('in-missions');
  missionGrid.querySelector('.mission:not(:disabled)')?.focus();
}

document.getElementById('missions-back').addEventListener('click', () => {
  document.body.classList.remove('in-missions');
  deliveryButton.focus();
});

// Écran « Moto » : choix de la moto (appliqué tout de suite, gardé pour les parties suivantes)
const garage = createGarage(
  document.getElementById('garage-preview'),
  document.querySelector('#garage .bikes'),
  document.querySelector('#garage .bike-desc'),
  BIKE_CARDS,
  (name) => {
    selectBike?.(name);
    bikeName = name; // si le modèle n'est pas encore chargé, selectBike(bikeName) l'appliquera
    saveBike(name);
  }
);
garage.select(bikeName);

// Écran Moto : ouvert par la vignette Moto du menu
const bikeTile = document.getElementById('mode-bike-tile');
bikeTile.addEventListener('click', () => {
  document.body.classList.add('in-garage');
  garage.show();
});
document.getElementById('garage-back').addEventListener('click', () => {
  document.body.classList.remove('in-garage');
  garage.hide();
  bikeTile.focus();
});

challengeButton.addEventListener('click', () => startGame('challenge'));
deliveryButton.addEventListener('click', showMissions);
menuButton.addEventListener('click', showMenu);

pauseButton.addEventListener('click', () => {
  togglePause();
  pauseButton.blur(); // évite que Espace / Entrée ne re-déclenche le bouton
});
resumeButton.addEventListener('click', () => setPaused(false));
pauseMenuButton.addEventListener('click', showMenu);

// Déplacement entre couloirs
let currentLane = 1;
let currentLeg = null; // rue du parcours où se trouve le joueur (pour remettre la moto dans un couloir
// quand le nombre de couloirs change d'une rue à l'autre)

// Changement de couloir : durée fixe, inclinaison et orientation de l'avant
const LANE_CHANGE_DURATION = 1; // secondes
const MAX_STEER = THREE.MathUtils.degToRad(20); // rotation de l'avant
const STEER_END = 0.6; // l'avant pivote pendant les 60 % premiers du changement
const MAX_LEAN = THREE.MathUtils.degToRad(25); // inclinaison
const TURN_LEAN = THREE.MathUtils.degToRad(30); // inclinaison dans les virages à 90°
const LEAN_START = 0.15; // l'inclinaison commence à 15 % du changement, après l'avant
player.rotation.order = 'YXZ'; // l'avant tourne d'abord, puis la moto se penche sur son propre axe

// Transition en cours : départ, arrivée et avancement (0 -> 1)
const laneChange = { from: laneX(currentLane), to: laneX(currentLane), t: 1 };

function startLaneChange() {
  laneChange.from = player.position.x; // repart de la position actuelle, même en plein changement
  laneChange.to = laneTarget(currentLane);
  laneChange.t = 0;
}

// Accélère puis ralentit (courbe sinus) : départ et arrivée en douceur
const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.target.closest?.('#camera-tuner')) return; // flèches sur un curseur de réglage de la caméra
  if (inMenu) return; // le menu se pilote avec ses boutons (Tab / Entrée au clavier)

  if (gameOver) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); // le bouton recevrait aussi la touche : une seule relance
      restart();
    }
    return;
  }

  if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
    togglePause();
    return;
  }

  if (paused) return;

  // M : change de moto (le pilote prend la pose propre à chaque moto)
  if ((event.key === 'm' || event.key === 'M') && selectBike) {
    const names = Object.keys(BIKES);
    selectBike(names[(names.indexOf(bikeName) + 1) % names.length]);
    saveBike(bikeName);
    garage.select(bikeName);
    return;
  }

  if (event.key === 'r' || event.key === 'R') lookingBack = true;
  else if (event.key === 'ArrowLeft') pressDirection(-1);
  else if (event.key === 'ArrowRight') pressDirection(1);
  else if (event.key === 'ArrowDown') {
    event.preventDefault(); // pas de défilement de la page
    pressDirection(UTURN);
  } else if (event.key === ' ') {
    event.preventDefault(); // pas de clic sur un bouton qui aurait le focus
    startBraking();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft') releaseDirection(-1);
  else if (event.key === 'ArrowRight') releaseDirection(1);
  else if (event.key === 'ArrowDown') releaseDirection(UTURN);
  if (event.key === ' ') braking = false;
  if (event.key === 'r' || event.key === 'R') lookingBack = false;
});
// Fenêtre qui perd le focus : on ne recevra pas le relâchement de la touche
window.addEventListener('blur', () => {
  braking = false;
  turnHold.dir = null; // appui abandonné : ni virage ni changement de couloir
  lookingBack = false;
});

// Frein (Espace, ou bouton tactile STOP au milieu) : tant qu'il est maintenu, la moto ralentit jusqu'à
// l'arrêt complet en BRAKE_DISTANCE m ; au relâchement, elle repart toute seule. Il marche partout, y compris
// juste avant un carrefour.
let braking = false; // frein maintenu

function startBraking() {
  if (paused || gameOver || inMenu || !started) return;
  braking = true;
}

// Bas (clavier ↓ et bouton tactile ▼, affiché seulement quand c'est possible) : demi-tour au prochain
// carrefour, dans la fenêtre de virage :
//  - grande route goudronnée : seulement depuis le couloir qui longe le terre-plein (on ne coupe pas la voie) ;
//  - rue pavée à 3 couloirs : depuis le couloir de gauche ou de droite, pas celui du milieu ;
//  - ruelle : jamais.
// Dans la fenêtre de virage, gauche / droite choisissent le virage : il faut donc être dans le bon couloir avant.
function canUturn(leg) {
  if (!leg || !leg.options.includes(UTURN)) return false;
  if (leg.median > 0) return currentLane === firstLane();
  return currentLane !== (laneCount() - 1) / 2; // pas le couloir du milieu
}

// Moto garée sur le trottoir (après une livraison, un chargement ou un plein) : demi-tour possible sur une rue
// pavée (pas sur une grande route, à cause du terre-plein, ni dans une ruelle), pas pendant l'arrêt lui-même
function canParkedUturn() {
  if (started || deliveryState || !activeTrack.uturnHere) return false;
  const leg = activeTrack.legAt(playerS);
  return leg.road?.type === 'small' && playerS <= leg.sArcStart;
}

// Demi-tour depuis le trottoir : la moto fait demi-tour vers l'intérieur de la rue et repart dans le couloir
// du même côté (couloir de droite du nouveau sens si elle était garée à droite)
function parkedUturn() {
  if (paused || gameOver || inMenu || !canParkedUturn()) return;
  if (!activeTrack.uturnHere(playerS, parkedSide)) return;
  started = true;
  startHint.hidden = true;
  currentLane = parkedSide > 0 ? laneCount() - 1 : firstLane();
  startLaneChange();
}

// Appui en cours qui peut confirmer un virage : dir = -1 / +1 (gauche / droite) ou UTURN (bas), time = durée
// de l'appui (s). dir = null : aucun.
const turnHold = { dir: null, time: 0 };
const HOLD_ARROWS = { [-1]: arrowLeft, 1: arrowRight, [UTURN]: arrowUturn };
const HOLD_ARROWS_LIST = Object.values(HOLD_ARROWS);

// Le virage dir est-il possible au carrefour de leg ?
function canTurn(leg, dir) {
  if (!leg) return false;
  return dir === UTURN ? canUturn(leg) : leg.options.includes(dir);
}

// Appui sur gauche / droite / bas (clavier et boutons tactiles)
function pressDirection(dir) {
  if (paused || gameOver || inMenu) return;
  // Sur le trottoir : départ (gauche / droite) ou demi-tour (bas), tout de suite
  if (!started) {
    if (dir === UTURN) parkedUturn();
    else steer(dir);
    return;
  }
  // Dans la fenêtre de virage, vers un virage possible : on attend de savoir si l'appui est bref ou maintenu
  if (canTurn(turnWindowLeg(), dir)) {
    turnHold.dir = dir;
    turnHold.time = 0;
    return;
  }
  if (dir !== UTURN) steer(dir); // ailleurs : changement de couloir immédiat
}

// Relâchement : un appui bref dans la fenêtre de virage change de couloir (le bas ne fait rien)
function releaseDirection(dir) {
  if (turnHold.dir !== dir) return; // virage déjà confirmé, ou appui commencé hors de la fenêtre
  turnHold.dir = null;
  if (paused || gameOver || inMenu) return;
  if (dir !== UTURN) steer(dir);
}

// Appelé à chaque image avant d'avancer de step : l'appui maintenu TURN_HOLD s confirme le virage. S'il est
// encore maintenu quand la moto entre dans le carrefour, le virage est pris aussi (sinon un appui commencé
// dans les 6 derniers mètres enverrait dans le mur).
function updateTurnHold(delta, step) {
  if (turnHold.dir === null) return;
  const leg = turnWindowLeg();
  if (!canTurn(leg, turnHold.dir)) {
    turnHold.dir = null;
    return;
  }
  turnHold.time += delta;
  if (turnHold.time >= TURN_HOLD || playerS + step >= leg.sArcStart) {
    if (turnHold.dir === UTURN) {
      // Vers la gauche depuis un couloir de droite, vers la droite depuis un couloir de gauche
      activeTrack.choose(UTURN, player.position.x >= 0 ? 1 : -1);
    } else {
      activeTrack.choose(turnHold.dir);
    }
    turnHold.dir = null;
    navigator.vibrate?.(TURN_CONFIRM_VIBRATION);
    updateArrows();
  }
}

// Gauche / droite : -1 = gauche, +1 = droite. Sur le trottoir : départ ; sinon : change de couloir.
function steer(direction) {
  if (paused || gameOver || inMenu) return;
  // Départ : la flèche gauche fait descendre la moto du trottoir vers le couloir de droite, et elle démarre
  if (!started) {
    if (deliveryState || direction !== -parkedSide) return; // pas pendant la livraison
    started = true;
    startHint.hidden = true;
    currentLane = parkedSide > 0 ? laneCount() - 1 : firstLane();
    startLaneChange();
    return;
  }
  const lane = currentLane;
  currentLane = Math.min(laneCount() - 1, Math.max(firstLane(), currentLane + direction));
  if (currentLane !== lane) startLaneChange();
}

// Boutons tactiles (mobile) : pointerdown réagit dès le contact, sans attendre le relâchement.
// Légère vibration à chaque appui (API Vibration : Android ; ignorée là où elle n'existe pas, ex. iPhone)
const BUTTON_VIBRATION = 15; // millisecondes
const TOUCH_ACTIONS = {
  left: () => pressDirection(-1),
  right: () => pressDirection(1),
  down: () => pressDirection(UTURN),
  brake: startBraking,
  'look-back': () => {
    if (!paused) lookingBack = true;
  },
};
for (const [id, action] of Object.entries(TOUCH_ACTIONS)) {
  document.getElementById(id).addEventListener('pointerdown', (event) => {
    event.preventDefault(); // pas de zoom / sélection / clic fantôme
    navigator.vibrate?.(BUTTON_VIBRATION);
    action();
  });
}
// STOP relâché (ou doigt qui glisse hors du bouton) : fin du freinage
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
  // ◀ ▶ ▼ relâchés : appui bref = changement de couloir, dans la fenêtre de virage (voir releaseDirection)
  for (const [id, dir] of [['left', -1], ['right', 1], ['down', UTURN]]) {
    document.getElementById(id).addEventListener(type, () => releaseDirection(dir));
  }
  document.getElementById('brake').addEventListener(type, () => {
    braking = false;
  });
  // Bouton « regarder derrière » relâché : la caméra revient derrière la moto
  document.getElementById('look-back').addEventListener(type, () => {
    lookingBack = false;
  });
}

// Redimensionnement
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Boîte de collision de la moto (un peu plus petite que le modèle, pour éviter les chocs injustes)
const PLAYER_HALF_WIDTH = 0.3;
const PLAYER_FRONT = -0.85; // l'avant regarde vers -Z
const PLAYER_BACK = 1.0;

// Progression
const SPEED = 12; // unités par seconde
let speed = 0; // vitesse actuelle : 0 à l'arrêt au départ, SPEED en roulant, en baisse en panne d'essence
let started = false; // la moto roule (false : garée sur un trottoir, au départ ou pour une livraison)
let parkedSide = 1; // trottoir où la moto est garée : +1 droite, -1 gauche

// Livraison : rouler sur une flèche → la moto freine en montant sur le trottoir le plus proche
// ('braking'), puis le produit est livré en UNLOAD_TIME s ('unloading'), puis elle attend le départ.
// Même chose au point de chargement (stopKind 'pickup') : les produits sont chargés en UNLOAD_TIME s, puis les
// points de livraison apparaissent.
const DELIVERY_BRAKE = 10; // m/s² : arrêt en un peu plus d'1 s
const UNLOAD_TIME = 2; // secondes
const REFUEL_TIME = 3; // plein à la station essence (secondes)
const STATION_REARM_DISTANCE = 20; // m : la flèche réapparaît (et le plein redevient possible) à cette distance
let stopDuration = UNLOAD_TIME; // durée de l'arrêt en cours
let stationIndex = -1; // station où l'on fait le plein
let ignoredStation = -1; // station qu'on vient de quitter (pas de nouveau plein tant qu'on est dessus)
let fuelAtStop = 0; // essence à l'arrivée à la station (la jauge monte jusqu'à 100 pendant le plein)
let deliveryState = null; // null, 'braking' ou 'unloading'
let stopKind = 'delivery'; // arrêt en cours : 'delivery' (livraison), 'pickup' (chargement) ou 'fuel' (plein)
let unloadTimer = 0;
let cargo = 0; // produits encore à livrer

// Argent (Livraison) : affiché à la place du compteur de distance ; petit grossissement à chaque changement
function showMoney(pop = false) {
  moneyDisplay.textContent = `${getMoney()} $`;
  if (!pop) return;
  moneyDisplay.classList.remove('pop');
  void moneyDisplay.offsetWidth; // relance l'animation CSS
  moneyDisplay.classList.add('pop');
}
showMoney();

// Message bref au centre de l'écran (ex. pas assez d'argent pour le plein)
let noticeTimeout = 0;
function showNotice(text) {
  notice.textContent = text;
  notice.hidden = false;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => {
    notice.hidden = true;
  }, 2500);
}

// Délai de la mission (Livraison, timeLimit dans missions.js) : chronomètre en haut au centre ; à 0, Game Over.
// Il démarre quand la moto quitte le trottoir pour la première fois.
let timeLeft = null; // secondes restantes, ou null si la mission n'a pas de délai
let shownSeconds = -1;
function setTimeLeft(value) {
  timeLeft = value;
  timerDisplay.hidden = value === null;
  shownSeconds = -1;
  if (value !== null) updateTimer();
}
function updateTimer() {
  const seconds = Math.ceil(timeLeft);
  if (seconds === shownSeconds) return;
  shownSeconds = seconds;
  timerDisplay.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  timerDisplay.classList.toggle('urgent', seconds <= 20);
}

function setCargo(value) {
  cargo = value;
  cargoCount.textContent = cargo;
}

// Position latérale visée pour l'indice de couloir i (-1 : trottoir de gauche, laneCount() : trottoir de droite)
function laneTarget(i) {
  const count = laneCount();
  if (i >= count) return sidewalkX();
  if (i < 0) return -sidewalkX();
  return laneXOf(i, count, medianOf(), laneWidthNow());
}

// Position latérale du trottoir de droite (milieu du trottoir) sur la rue où se trouve le joueur
const sidewalkX = () => roadHalfWidth() + SIDEWALK_WIDTH / 2;
let distance = 0;

// Essence (Livraison) : réservoir de FUEL_MAX points, consommé en roulant. Un bidon ramassé en donne
// CAN_FUEL. À 0, la moto ralentit (BRAKE) jusqu'à l'arrêt : Game Over.
const FUEL_MAX = 100;
const FUEL_PER_METER = FUEL_MAX / 1000; // réservoir plein : environ 1000 m (83 s)
const CAN_FUEL = 30;
const BRAKE = 6; // décélération (m/s²) en panne : arrêt en 2 s
const ACCELERATION = 6; // m/s² : au départ (SPEED atteinte en 2 s), après un freinage ou un bidon en roue libre
const BRAKE_DISTANCE = 5; // m : distance d'arrêt depuis la pleine vitesse, frein maintenu
const BRAKE_DECELERATION = (SPEED * SPEED) / (2 * BRAKE_DISTANCE); // 14,4 m/s²
let fuel = FUEL_MAX;
let displayedFuel = -1;

function setFuel(value) {
  fuel = THREE.MathUtils.clamp(value, 0, FUEL_MAX);
  const shown = Math.ceil(fuel);
  if (shown === displayedFuel) return; // le DOM n'est mis à jour que si la valeur affichée change
  displayedFuel = shown;
  fuelLevel.style.transform = `scaleY(${fuel / FUEL_MAX})`;
  fuelValue.textContent = shown;
  fuelGauge.classList.toggle('medium', shown <= 50 && shown > 25);
  fuelGauge.classList.toggle('low', shown <= 25);
}
let gameTime = 0; // temps de jeu, figé pendant la pause

// Ondulation de la route (courbure du monde) : une ligne droite d'au moins BEND_STRAIGHT_MIN mètres,
// puis une ondulation d'un seul côté (au hasard) qui se forme et s'efface sur BEND_CURVE_MIN à
// BEND_CURVE_MAX mètres, puis de nouveau une ligne droite, et ainsi de suite.
// Toujours coupée autour des carrefours (bendFade).
const BEND_STRAIGHT_MIN = 50;
const BEND_STRAIGHT_MAX = 80;
const BEND_CURVE_MIN = 60;
const BEND_CURVE_MAX = 100;
const BEND_AMOUNT = 0.003; // courbure maximale
const randomBetween = (min, max) => min + Math.random() * (max - min);
const roadWave = { curving: false, length: 0, done: 0, side: 1 };

function resetRoadWave() {
  roadWave.curving = false;
  roadWave.length = randomBetween(BEND_STRAIGHT_MIN, BEND_STRAIGHT_MAX);
  roadWave.done = 0;
}
resetRoadWave();

// step : distance parcourue depuis l'image précédente
function updateRoadWave(step) {
  roadWave.done += step;
  if (roadWave.done >= roadWave.length) {
    roadWave.done -= roadWave.length;
    roadWave.curving = !roadWave.curving;
    roadWave.length = roadWave.curving
      ? randomBetween(BEND_CURVE_MIN, BEND_CURVE_MAX)
      : randomBetween(BEND_STRAIGHT_MIN, BEND_STRAIGHT_MAX);
    if (roadWave.curving) roadWave.side = Math.random() < 0.5 ? -1 : 1;
  }
  // Ondulation : monte puis redescend en douceur (demi-sinus), toujours du même côté
  const shape = roadWave.curving ? Math.sin((Math.PI * roadWave.done) / roadWave.length) : 0;
  bendUniforms.uBend.value = roadWave.side * BEND_AMOUNT * shape * bendFade();
}
let displayedDistance = -1;

// Boucle de jeu
const timer = new THREE.Timer();
timer.connect(document); // ignore le temps passé onglet caché

// Heure de Cotonou (fuseau du Bénin, UTC+1 sans heure d'été), affichée en haut au centre (menu, écrans Missions et
// Moto, jeu), quelle que soit l'heure de l'appareil. Mise à jour chaque seconde, hors boucle de jeu.
// Test : ?heure=19.5 dans l'adresse impose une heure (19 h 30) à l'horloge et à la couleur du ciel.
const clockLabel = document.getElementById('clock');
const clockFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Africa/Porto-Novo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const forcedHour = Number.parseFloat(new URLSearchParams(location.search).get('heure'));

// Heure de Cotonou en heures décimales (14 h 30 → 14,5)
function cotonouHours() {
  if (Number.isFinite(forcedHour)) return ((forcedHour % 24) + 24) % 24;
  const parts = clockFormat.formatToParts(new Date());
  const value = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return value('hour') + value('minute') / 60;
}

function updateClock() {
  const hours = cotonouHours();
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  clockLabel.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  applySkyColor(hours); // menu et jeu
}

// Couleur du ciel et du brouillard en jeu selon l'heure de Cotonou (lever ~6 h 15, coucher ~18 h 30 toute l'année,
// près de l'équateur) : couleurs clés, fondues entre elles. Aussi dans le survol du menu.
const SKY_COLOR = 0x87ceeb;
const SKY_KEYS = [
  [0, 0x0b1430], // nuit
  [5, 0x0b1430],
  [6, 0xf0a37a], // aube
  [7.5, 0xa9d4f0],
  [9, SKY_COLOR], // jour
  [16, SKY_COLOR],
  [17.5, 0xf6c27a], // fin d'après-midi
  [18.5, 0xe0703f], // coucher du soleil
  [19.5, 0x2a2a55], // crépuscule
  [21, 0x0b1430], // nuit
  [24, 0x0b1430],
].map(([hour, color]) => [hour, new THREE.Color(color)]);

// Lumière du jour (part des intensités de jour) selon l'heure : pleine de 8 h à 16 h, faible la nuit
const LIGHT_KEYS = [
  [0, 0.25], // nuit
  [5, 0.25],
  [6.5, 0.6], // aube
  [8, 1], // jour
  [16, 1],
  [18.5, 0.7], // coucher du soleil
  [19.5, 0.4], // crépuscule
  [21, 0.25], // nuit
  [24, 0.25],
];

// Clé précédente et suivante de keys ([heure, valeur]) autour de hours, et position entre les deux (0..1)
function keyBlend(keys, hours) {
  let i = 1;
  while (i < keys.length - 1 && keys[i][0] <= hours) i++;
  const [h0, a] = keys[i - 1];
  const [h1, b] = keys[i];
  return { a, b, t: (hours - h0) / (h1 - h0) };
}

function applySkyColor(hours) {
  const sky = keyBlend(SKY_KEYS, hours);
  scene.fog.color.lerpColors(sky.a, sky.b, sky.t);
  scene.background.copy(scene.fog.color); // ciel de la même couleur : les bâtiments lointains s'y fondent
  const light = keyBlend(LIGHT_KEYS, hours);
  const level = THREE.MathUtils.lerp(light.a, light.b, light.t);
  hemiLight.intensity = HEMI_INTENSITY * level;
  sun.intensity = SUN_INTENSITY * level;
  const night = hours >= HEADLIGHT_ON || hours < HEADLIGHT_OFF;
  headlight.intensity = night ? HEADLIGHT_INTENSITY : 0;
  setVehicleLights(night); // phares et feux arrière des voitures
}

updateClock();
setInterval(updateClock, 1000);

// Images par seconde, affichées en haut à droite (#fps), moyenne sur FPS_INTERVAL
const FPS_INTERVAL = 500; // ms
const fpsLabel = document.getElementById('fps');
let fpsFrames = 0;
let fpsStart = 0;

function updateFps(timestamp) {
  fpsFrames++;
  if (!fpsStart) fpsStart = timestamp;
  const elapsed = timestamp - fpsStart;
  if (elapsed < FPS_INTERVAL) return;
  fpsLabel.textContent = `${Math.round((fpsFrames * 1000) / elapsed)} FPS`;
  fpsFrames = 0;
  fpsStart = timestamp;
}

function animate(timestamp) {
  if (timestamp !== undefined) updateFps(timestamp);
  timer.update(timestamp);
  // Plafonné pour éviter un grand saut après un onglet resté en arrière-plan
  const delta = Math.min(timer.getDelta(), 0.1);

  // Écran Moto ouvert : la ville n'est plus dessinée (canvas #game caché, fond bleu foncé) ; seul l'aperçu de la
  // moto (garage.js, son propre renderer) tourne. Le survol et la circulation reprennent à la fermeture.
  if (document.body.classList.contains('in-garage')) {
    requestAnimationFrame(animate);
    return;
  }

  if (!paused && !gameOver && !inMenu) {
    // Démo : la route ondule entre virage gauche et virage droit
    gameTime += delta;
    const delivery = gameMode === 'delivery';

    // Panne d'essence : la moto ralentit jusqu'à l'arrêt, puis Game Over
    if (deliveryState === 'braking') {
      speed = Math.max(0, speed - DELIVERY_BRAKE * delta);
      if (speed === 0) {
        deliveryState = 'unloading';
        stopDuration = stopKind === 'fuel' ? REFUEL_TIME : UNLOAD_TIME;
        unloadTimer = stopDuration;
        fuelAtStop = fuel;
        unloadingLevel.style.transform = 'scaleX(1)';
        unloadingPanel.hidden = false;
      }
    } else if (deliveryState === 'unloading') {
      unloadTimer = Math.max(0, unloadTimer - delta);
      unloadingLevel.style.transform = `scaleX(${unloadTimer / stopDuration})`;
      // Station essence : la jauge se remplit pendant le plein
      if (stopKind === 'fuel') setFuel(fuelAtStop + (FUEL_MAX - fuelAtStop) * (1 - unloadTimer / stopDuration));
      if (unloadTimer === 0) {
        deliveryState = null;
        unloadingPanel.hidden = true;
        if (stopKind === 'fuel') {
          setFuel(FUEL_MAX);
          showStartHint(parkedSide, 'repartir', canParkedUturn());
        } else if (stopKind === 'pickup') {
          // Produits chargés (BIKE_CAPACITY au plus) : leurs points de livraison apparaissent
          onBoard = toLoad.splice(0, BIKE_CAPACITY);
          setCargo(onBoard.length);
          deliveryPoints.reset(onBoard);
          loaded = true;
          refreshGuide();
          showStartHint(parkedSide, 'repartir', canParkedUturn());
        } else {
          // Produit livré : DELIVERY_REWARD $
          addMoney(DELIVERY_REWARD);
          showMoney(true);
          setCargo(cargo - 1);
          if (cargo === 0 && toLoad.length === 0) finishMission();
          else {
            if (cargo === 0) {
              // Moto vide mais il reste des produits : retour au point de chargement
              loaded = false;
              deliveryPoints.reset([missionData(currentMission).pickup], 'pickup');
              refreshGuide();
              showNotice(`Retourne au chargement : encore ${toLoad.length} produit${toLoad.length > 1 ? 's' : ''}`);
            }
            showStartHint(parkedSide, 'repartir', canParkedUturn());
          }
        }
      }
    } else if (delivery && fuel <= 0) {
      speed = Math.max(0, speed - BRAKE * delta);
      if (speed === 0) endGame("Panne d'essence !");
    } else if (started && braking) {
      // Frein maintenu (Espace ou STOP) : arrêt progressif
      speed = Math.max(0, speed - BRAKE_DECELERATION * delta);
    } else if (started && speed < SPEED) {
      // Démarrage, reprise après un freinage (touche relâchée) ou après un bidon ramassé en roue libre
      speed = Math.min(SPEED, speed + ACCELERATION * delta);
    }
    // Feu stop : allumé pendant les freinages
    setBrakeLight((started && braking) || deliveryState === 'braking' || (delivery && fuel <= 0 && speed > 0));
    const step = speed * delta; // distance parcourue pendant cette image
    updateTurnHold(delta, step); // virage confirmé par un appui maintenu

    if (!delivery) updateRoadWave(step);

    // Le joueur avance sur le parcours ; le monde est replacé autour de lui
    playerS += step;
    activeTrack.update(playerS);
    placeWorld();
    distance += step;
    if (delivery) setFuel(fuel - step * FUEL_PER_METER);

    // Délai de la mission : le chronomètre tourne dès le premier départ (arrêts compris)
    if (delivery && timeLeft !== null) {
      if (started) timerStarted = true;
      if (timerStarted) {
        timeLeft = Math.max(0, timeLeft - delta);
        updateTimer();
        if (timeLeft === 0 && !gameOver) endGame('Temps écoulé !');
      }
    }
    updateArrows();

    // Pas de virage choisi et tout droit impossible : la moto traverse le carrefour jusqu'au mur
    // (en Livraison, tout droit est possible aux carrefours en croix)
    const crossing = activeTrack.legAt(playerS);
    if (
      crossing.turn === 0 &&
      !crossing.options.includes(0) &&
      playerS > crossing.sArcStart + (crossing.wallHit ?? WALL_HIT)
    ) {
      endGame();
    }

    // Nouvelle rue : si les couloirs changent (2, 3 ou 4 couloirs, terre-plein ou non), la moto glisse vers
    // le couloir autorisé le plus proche (avec un terre-plein : un des 2 couloirs de droite)
    if (crossing !== currentLeg) {
      const lanes = crossing.lanes ?? LANE_COUNT;
      const median = crossing.median ?? 0;
      const width = crossing.laneWidth ?? LANE_WIDTH;
      const changed =
        lanes !== (currentLeg?.lanes ?? LANE_COUNT) ||
        median !== (currentLeg?.median ?? 0) ||
        width !== (currentLeg?.laneWidth ?? LANE_WIDTH);
      currentLeg = crossing;
      if (changed && started) {
        let nearest = firstLane();
        for (let i = firstLane(); i < lanes; i++) {
          const gap = Math.abs(laneXOf(i, lanes, median, width) - player.position.x);
          if (gap < Math.abs(laneXOf(nearest, lanes, median, width) - player.position.x)) nearest = i;
        }
        currentLane = nearest;
        startLaneChange();
      }
    }

    const meters = Math.floor(distance);
    if (meters !== displayedDistance) {
      displayedDistance = meters;
      distanceDisplay.textContent = `${meters} m`;
    }

    // Roues : roulement sans glissement, angle = distance parcourue / rayon
    // (rotation négative autour de X = le haut de la roue part vers l'avant, -Z)
    const spin = step / bike.wheelRadius / 2; // réduit de moitié
    for (const wheel of wheels) {
      wheel.rotateX(bike.spinSign * spin);
    }

    // Fumée : émise une fois la moto chargée, suit le couloir du joueur
    if (wheels.length) {
      exhaustWorld.copy(bike.exhaust);
      player.localToWorld(exhaustWorld); // suit aussi l'inclinaison de la moto
      smoke.update(delta, speed, exhaustWorld);
    }

    // Glissement vers le couloir cible, en LANE_CHANGE_DURATION secondes
    laneChange.t = Math.min(1, laneChange.t + delta / LANE_CHANGE_DURATION);
    const t = laneChange.t;
    const shift = laneChange.to - laneChange.from;
    player.position.x = laneChange.from + shift * easeInOut(t);
    // Sur le trottoir, la moto est posée sur sa bordure (hauteur SIDEWALK_HEIGHT) ; elle en descend en
    // passant le bord de la route
    const roadEdge = roadHalfWidth();
    player.position.y =
      SIDEWALK_HEIGHT * THREE.MathUtils.clamp((Math.abs(player.position.x) - roadEdge + 0.3) / 0.6, 0, 1);

    // Sens et ampleur du changement (1 = un couloir entier)
    const amount = THREE.MathUtils.clamp(shift / LANE_WIDTH, -1, 1);

    // 1) L'avant pivote d'abord vers le couloir visé (rotation autour de l'axe vertical) :
    //    pic au premier quart, redressé avant l'arrivée
    const steerPhase = THREE.MathUtils.clamp(t / STEER_END, 0, 1);
    const targetSteer = -amount * MAX_STEER * Math.sin(Math.PI * steerPhase);
    player.rotation.y = THREE.MathUtils.damp(player.rotation.y, targetSteer, 20, delta);

    // 2) Puis la moto se penche (rotation autour de l'axe avant ; pivot au sol) :
    //    démarre après l'avant, pic après le milieu, revient droite à l'arrivée
    const leanPhase = THREE.MathUtils.clamp((t - LEAN_START) / (1 - LEAN_START), 0, 1);
    let targetLean = -amount * MAX_LEAN * Math.sin(Math.PI * leanPhase);

    // 3) Dans un virage du parcours, la moto se penche vers l'intérieur
    const leg = activeTrack.legAt(playerS);
    if (playerS > leg.sArcStart) {
      const turnPhase = (playerS - leg.sArcStart) / (leg.sEnd - leg.sArcStart);
      const turnSide = leg.turn === UTURN ? -leg.uturnSide : leg.turn; // sens du demi-tour
      targetLean += -turnSide * TURN_LEAN * Math.sin(Math.PI * turnPhase);
    }
    player.rotation.z = THREE.MathUtils.damp(player.rotation.z, targetLean, 20, delta);

    // Bidons d'essence (Livraison) : ramassés en roulant dessus (position de la moto sur la carte)
    if (delivery) {
      activeTrack.pose(playerS, player.position.x, minimapPoint);
      const picked = fuelCans.update(gameTime, minimapPoint.x, minimapPoint.z);
      if (picked) {
        setFuel(fuel + picked * CAN_FUEL);
        // Petit grossissement de la jauge (on relance l'animation CSS)
        fuelGauge.classList.remove('refuel');
        void fuelGauge.offsetWidth;
        fuelGauge.classList.add('refuel');
      }

      // Flèche de livraison : déclenchée dans les deux sens. La moto s'arrête sur le trottoir le plus
      // proche (celui de gauche si elle arrive à contresens) pour livrer
      const hit = deliveryPoints.update(gameTime, minimapPoint.x, minimapPoint.z);
      if (hit >= 0 && started && !deliveryState) {
        stopKind = deliveryPoints.kindOf(hit);
        unloadingLabel.textContent = stopKind === 'pickup' ? 'Chargement en cours' : 'Livraison en cours';
        deliveryPoints.remove(hit);
        refreshGuide(); // vers l'objectif suivant
        deliveryState = 'braking';
        started = false;
        parkedSide = player.position.x >= 0 ? 1 : -1;
        currentLane = parkedSide > 0 ? laneCount() : -1;
        startLaneChange();
      }

      // Station essence : arrêt sur le point bleu, plein en REFUEL_TIME s. La station qu'on vient de quitter
      // est ignorée jusqu'à ce qu'on s'en soit éloigné (la moto repart en passant sur le point)
      if (ignoredStation >= 0 && stationPoints.distanceTo(ignoredStation, minimapPoint.x, minimapPoint.z) > STATION_REARM_DISTANCE) {
        ignoredStation = -1;
      }
      const station = stationPoints.update(gameTime, minimapPoint.x, minimapPoint.z, ignoredStation);
      if (station >= 0 && started && !deliveryState && getMoney() < FUEL_PRICE) {
        // Pas assez d'argent : pas de plein (la moto continue) ; message une seule fois par passage
        ignoredStation = station;
        showNotice(`Pas assez d'argent pour le plein (${FUEL_PRICE} $)`);
      } else if (station >= 0 && started && !deliveryState) {
        // Plein payé à l'arrivée sur le point
        addMoney(-FUEL_PRICE);
        showMoney(true);
        stopKind = 'fuel';
        stationIndex = station;
        ignoredStation = station; // flèche cachée pendant le plein : la caméra passerait dedans
        unloadingLabel.textContent = 'Plein en cours';
        deliveryState = 'braking';
        started = false;
        parkedSide = player.position.x >= 0 ? 1 : -1;
        currentLane = parkedSide > 0 ? laneCount() : -1;
        startLaneChange();
      }
    }

    // Circulation (Livraison) : les voitures roulent dans le réseau ; percuter une voiture = Game Over
    if (delivery) {
      if (!traffic && carModels && deliveryCity) {
        traffic = createTraffic(deliveryWorld, carModels, graph);
        traffic.reset(minimapPoint.x, minimapPoint.z);
      }
      if (traffic) {
        traffic.update(delta, minimapPoint.x, minimapPoint.z);
        if (traffic.hits(minimapPoint.x, minimapPoint.z)) endGame('Accident !');
      }
    }

    // Voitures : défilement, apparition, puis collision avec la moto
    if (obstacles && !delivery && started) {
      obstacles.update(delta, SPEED, playerS);
      if (
        obstacles.hits(player.position.x, PLAYER_HALF_WIDTH, PLAYER_FRONT, PLAYER_BACK)
      ) {
        endGame();
      }
    }
  }

  // Ligne de guidage (premières missions de Livraison)
  if (gameMode === 'delivery' && !inMenu && !gameOver && guide) guide.update(activeTrack, playerS, gameTime);

  // Carte (Livraison), affichée seulement dans le panneau Pause : position de la moto, couloir compris
  // (x → x de la carte, z → y)
  if (gameMode === 'delivery' && !inMenu && paused) {
    const theta = activeTrack.pose(playerS, player.position.x, minimapPoint);
    minimap.update(minimapPoint.x, minimapPoint.z, theta, deliveryPoints.active(), stationPoints.active());
  }

  if (controls) controls.update();
  else if (inMenu) {
    placeMenuCamera(delta);
    // Circulation du survol : les voitures restent autour du point regardé et ne s'y arrêtent pas
    if (!traffic && carModels) {
      traffic = createTraffic(deliveryWorld, carModels, graph);
      traffic.reset(menuFocus.x, menuFocus.z);
    }
    traffic?.update(delta, menuFocus.x, menuFocus.z, true);
  } else updateCamera(delta);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

showMenuScene(); // le jeu s'ouvre sur le menu : survol de la ville
animate();
