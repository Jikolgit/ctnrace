import * as THREE from 'three';

// Écran de chargement (#loader, dans index.html avec ses styles : visible dès l'ouverture de la page, avant même le
// code du jeu). Il cache le menu tant que tout n'est pas prêt (boutons cachés par le code, ville, modèles 3D), puis
// s'efface en fondu.
// Progression : models.glb compte pour l'essentiel (octets reçus), les autres fichiers (atlas, bidon, fumée) pour le
// reste (après l'avancée du téléchargement du code). La barre affichée rattrape la vraie progression en douceur (pas de saut).

const GLB_SHARE = 0.85; // part de models.glb dans la barre
const GLB_SIZE_ESTIMATE = 2.1e6; // octets : si le serveur ne donne pas la taille (fichier compressé à l'envoi)
const BAR_SPEED = 4; // vitesse de rattrapage de la barre (par seconde)
const FADE_TIME = 600; // ms : durée du fondu (même valeur que la transition CSS de #loader)

const loader = document.querySelector('#loader');
const fill = loader.querySelector('.loader-fill');
const label = loader.querySelector('.loader-text');

let glbProgress = 0; // 0 à 1
let otherProgress = 0; // 0 à 1 : fichiers chargés par les loaders Three.js, hors models.glb
// Avancée de la barre pendant le téléchargement du code (petit script de index.html), reprise ici
loader.dataset.js = 'true';
const start = (parseFloat(fill.style.width) || 0) / 100;
let shown = start; // progression affichée
let finished = false;

// Autres fichiers (TextureLoader…) : tous passent par le gestionnaire par défaut de Three.js
THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => {
  if (!url.endsWith('.glb')) otherProgress = total ? loaded / total : 1;
};

// À passer en onProgress de GLTFLoader.load
export function glbLoading(event) {
  const total = event.lengthComputable && event.total ? event.total : GLB_SIZE_ESTIMATE;
  glbProgress = Math.min(event.loaded / total, finished ? 1 : 0.98);
}

function target() {
  return start + (1 - start) * (GLB_SHARE * glbProgress + (1 - GLB_SHARE) * otherProgress);
}

let last = performance.now();
function tick(now) {
  if (!loader.isConnected) return;
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  shown += (target() - shown) * Math.min(1, dt * BAR_SPEED);
  if (finished && shown > 0.995) shown = 1;
  const percent = Math.round(shown * 100);
  fill.style.width = `${shown * 100}%`;
  label.textContent = `Chargement… ${percent} %`;
  loader.setAttribute('aria-valuenow', percent);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Tout est prêt (modèles traités, premières images dessinées) : la barre se remplit, puis l'écran s'efface
export function hideLoadingScreen() {
  if (finished) return;
  finished = true;
  glbProgress = 1;
  otherProgress = 1;
  const fadeWhenFull = () => {
    if (shown < 1) return requestAnimationFrame(fadeWhenFull);
    loader.classList.add('done'); // fondu (transition CSS)
    setTimeout(() => loader.remove(), FADE_TIME);
  };
  fadeWhenFull();
}
