import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyWorldBend, bendUniforms } from './worldBend.js';
import { LANE_COUNT, LANE_WIDTH, laneX, createRoad } from './road.js';
import { createSmoke } from './smoke.js';
import { createCity } from './city.js';
import { createObstacles } from './obstacles.js';
import { atlas } from './atlas.js';

const canvas = document.getElementById('game');
const distanceDisplay = document.getElementById('distance');
const pauseButton = document.getElementById('pause');
const gameOverPanel = document.getElementById('gameover');
const finalDistance = document.getElementById('final-distance');
const restartButton = document.getElementById('restart');

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// Scène
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

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
const CAMERA_FOLLOW = 1; // 1 = la caméra arrive derrière la moto, < 1 = elle la suit moins
const CAMERA_LOOK_Y = CAMERA_HEIGHT - (CAMERA_HEIGHT - 1) * CAMERA_RADIUS / 6; // garde l'inclinaison vers le bas d'origine
const cameraLookAt = new THREE.Vector3();
let cameraAngle = 0;

function updateCamera(delta) {
  // Angle sur l'arc qui amène la caméra au-dessus du couloir de la moto
  const targetX = THREE.MathUtils.clamp(player.position.x * CAMERA_FOLLOW, -CAMERA_RADIUS, CAMERA_RADIUS);
  const targetAngle = Math.asin(targetX / CAMERA_RADIUS);
  cameraAngle = THREE.MathUtils.damp(cameraAngle, targetAngle, 6, delta);
  camera.position.set(
    CAMERA_RADIUS * Math.sin(cameraAngle),
    CAMERA_HEIGHT,
    CAMERA_PIVOT_Z + CAMERA_RADIUS * Math.cos(cameraAngle)
  );
  cameraLookAt.set(0, CAMERA_LOOK_Y, CAMERA_PIVOT_Z);
  camera.lookAt(cameraLookAt);
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

// Lumières
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(5, 10, 5);
scene.add(sun);

// Route infinie (tronçons recyclés)
const road = createRoad(scene);
const city = createCity(scene);

// Joueur : groupe déplacé de couloir en couloir, la moto est ajoutée dedans une fois chargée
const player = new THREE.Group();
player.position.set(laneX(1), 0, 0);
scene.add(player);

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
let bikeName = DEFAULT_BIKE;
let bike = BIKES[bikeName];
let selectBike = null; // défini une fois le modèle chargé

let obstacles = null; // créé une fois le modèle de voiture chargé

new GLTFLoader().load(
  `${import.meta.env.BASE_URL}models.glb`,
  (gltf) => {
    const moto = gltf.scene;

    // Modèle de voiture : retiré de la scène du joueur, il sert de gabarit aux obstacles
    const carTemplate = moto.getObjectByName('car_1');
    if (carTemplate) carTemplate.removeFromParent();

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

      rider.position.copy(bike.riderPosition);
      mixer.stopAllAction();
      const ride = THREE.AnimationClip.findByName(gltf.animations, bike.ride);
      if (ride) {
        mixer.clipAction(ride).play();
        mixer.update(0); // pose figée : inutile de mettre à jour à chaque frame
      }
    };

    moto.traverse((child) => {
      if (!child.isMesh) return;
      if (child.name.startsWith('MotoCub')) {
        // MotoCub : ses propres matériaux (exportés de Blender), avec la courbure du monde
        for (const material of [].concat(child.material)) applyWorldBend(material);
      } else {
        child.material = atlasMaterial; // ancienne moto et pilote : atlas bikeTXT
      }
    });

    selectBike(DEFAULT_BIKE);
    player.add(moto);

    if (carTemplate) {
      carTemplate.traverse((child) => {
        if (child.isMesh) child.material = atlasMaterial;
      });
      carTemplate.position.set(0, 0, 0); // placée à côté de la moto dans Blender
      obstacles = createObstacles(scene, carTemplate);
    }
  },
  undefined,
  (error) => console.error('Impossible de charger models.glb', error)
);

// Pause
let paused = false;

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  pauseButton.textContent = paused ? 'Reprendre' : 'Pause';
}

// Game over et nouvelle partie
let gameOver = false;

function endGame() {
  gameOver = true;
  finalDistance.textContent = `${Math.floor(distance)} m`;
  gameOverPanel.hidden = false;
  restartButton.focus();
}

function restart() {
  distance = 0;
  gameTime = 0;
  displayedDistance = -1;
  currentLane = 1;
  laneChange.from = laneChange.to = laneX(currentLane);
  laneChange.t = 1;
  player.position.x = laneX(currentLane);
  player.rotation.set(0, 0, 0);
  obstacles?.reset();
  gameOverPanel.hidden = true;
  gameOver = false;
  restartButton.blur();
}

restartButton.addEventListener('click', restart);

pauseButton.addEventListener('click', () => {
  togglePause();
  pauseButton.blur(); // évite que Espace / Entrée ne re-déclenche le bouton
});

// Déplacement entre couloirs
let currentLane = 1;

// Changement de couloir : durée fixe, inclinaison et orientation de l'avant
const LANE_CHANGE_DURATION = 1; // secondes
const MAX_STEER = THREE.MathUtils.degToRad(20); // rotation de l'avant
const STEER_END = 0.6; // l'avant pivote pendant les 60 % premiers du changement
const MAX_LEAN = THREE.MathUtils.degToRad(25); // inclinaison
const LEAN_START = 0.15; // l'inclinaison commence à 15 % du changement, après l'avant
player.rotation.order = 'YXZ'; // l'avant tourne d'abord, puis la moto se penche sur son propre axe

// Transition en cours : départ, arrivée et avancement (0 -> 1)
const laneChange = { from: laneX(currentLane), to: laneX(currentLane), t: 1 };

function startLaneChange() {
  laneChange.from = player.position.x; // repart de la position actuelle, même en plein changement
  laneChange.to = laneX(currentLane);
  laneChange.t = 0;
}

// Accélère puis ralentit (courbe sinus) : départ et arrivée en douceur
const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;

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
    return;
  }

  if (event.key === 'ArrowLeft') steer(-1);
  else if (event.key === 'ArrowRight') steer(1);
});

// Change de couloir : -1 = gauche, +1 = droite (clavier et boutons tactiles)
function steer(direction) {
  if (paused || gameOver) return;
  const lane = currentLane;
  currentLane = Math.min(LANE_COUNT - 1, Math.max(0, currentLane + direction));
  if (currentLane !== lane) startLaneChange();
}

// Boutons tactiles (mobile) : pointerdown réagit dès le contact, sans attendre le relâchement
for (const [id, direction] of [['left', -1], ['right', 1]]) {
  document.getElementById(id).addEventListener('pointerdown', (event) => {
    event.preventDefault(); // pas de zoom / sélection / clic fantôme
    steer(direction);
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
let distance = 0;
let gameTime = 0; // temps de jeu, figé pendant la pause
let displayedDistance = -1;

// Boucle de jeu
const timer = new THREE.Timer();
timer.connect(document); // ignore le temps passé onglet caché

function animate(timestamp) {
  timer.update(timestamp);
  // Plafonné pour éviter un grand saut après un onglet resté en arrière-plan
  const delta = Math.min(timer.getDelta(), 0.1);

  if (!paused && !gameOver) {
    // Démo : la route ondule entre virage gauche et virage droit
    gameTime += delta;
    bendUniforms.uBend.value = Math.sin(gameTime * 0.5) * 0.003;

    // La route défile, le joueur reste sur place
    road.update(delta, SPEED);
    city.update(delta, SPEED);
    distance += SPEED * delta;

    const meters = Math.floor(distance);
    if (meters !== displayedDistance) {
      displayedDistance = meters;
      distanceDisplay.textContent = `${meters} m`;
    }

    // Roues : roulement sans glissement, angle = distance parcourue / rayon
    // (rotation négative autour de X = le haut de la roue part vers l'avant, -Z)
    const spin = (SPEED * delta) / bike.wheelRadius / 2; // réduit de moitié
    for (const wheel of wheels) {
      wheel.rotateX(bike.spinSign * spin);
    }

    // Fumée : émise une fois la moto chargée, suit le couloir du joueur
    if (wheels.length) {
      exhaustWorld.copy(bike.exhaust);
      player.localToWorld(exhaustWorld); // suit aussi l'inclinaison de la moto
      smoke.update(delta, SPEED, exhaustWorld);
    }

    // Glissement vers le couloir cible, en LANE_CHANGE_DURATION secondes
    laneChange.t = Math.min(1, laneChange.t + delta / LANE_CHANGE_DURATION);
    const t = laneChange.t;
    const shift = laneChange.to - laneChange.from;
    player.position.x = laneChange.from + shift * easeInOut(t);

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
    const targetLean = -amount * MAX_LEAN * Math.sin(Math.PI * leanPhase);
    player.rotation.z = THREE.MathUtils.damp(player.rotation.z, targetLean, 20, delta);

    // Voitures : défilement, apparition, puis collision avec la moto
    if (obstacles) {
      obstacles.update(delta, SPEED);
      if (
        obstacles.hits(player.position.x, PLAYER_HALF_WIDTH, PLAYER_FRONT, PLAYER_BACK)
      ) {
        endGame();
      }
    }
  }

  if (controls) controls.update();
  else updateCamera(delta);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
