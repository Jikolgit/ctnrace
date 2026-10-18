import { MAP_WIDTH, MAP_HEIGHT, ROADS, PLACES } from './deliveryMap.js';

// Mode Livraison : mini-carte du réseau (nord en haut) avec la position et la direction du joueur.
// Le plan est dessiné une seule fois dans un canvas hors écran ; à chaque image on le recopie puis on
// dessine la flèche du joueur par-dessus.

const WIDTH = 400; // résolution interne du canvas (affiché plus petit en CSS : net sur écran haute densité)
const PADDING = 14;
const SCALE = (WIDTH - 2 * PADDING) / MAP_WIDTH; // pixels par mètre
const HEIGHT = Math.round(MAP_HEIGHT * SCALE + 2 * PADDING);

const ROAD_STYLE = {
  big: { color: '#e9e9e9', width: 6 },
  small: { color: '#a99c86', width: 3.5 },
};

// Coordonnées de la carte (mètres) → pixels du canvas
const px = (x) => PADDING + x * SCALE;
const py = (y) => PADDING + y * SCALE;

function drawPlan() {
  const plan = document.createElement('canvas');
  plan.width = WIDTH;
  plan.height = HEIGHT;
  const ctx = plan.getContext('2d');
  ctx.lineCap = 'square';

  // Petites rues d'abord : les grandes routes passent dessus
  for (const type of ['small', 'big']) {
    const style = ROAD_STYLE[type];
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.beginPath();
    for (const road of ROADS) {
      if (road.type !== type) continue;
      if (road.y !== undefined) {
        ctx.moveTo(px(road.x1), py(road.y));
        ctx.lineTo(px(road.x2), py(road.y));
      } else {
        ctx.moveTo(px(road.x), py(road.y1));
        ctx.lineTo(px(road.x), py(road.y2));
      }
    }
    ctx.stroke();
  }

  // Lieux de livraison
  ctx.fillStyle = '#e8642a';
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 2;
  for (const place of PLACES) {
    ctx.beginPath();
    ctx.arc(px(place.x), py(place.y), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  return plan;
}

export function createMinimap(canvas) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  const plan = drawPlan();

  // x, y : position du joueur sur la carte (mètres) ; theta : direction (repère de track.js / network.js)
  function update(x, y, theta) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(plan, 0, 0);

    // Flèche du joueur : pointe dans le sens de la marche (theta = 0 : vers le nord, en haut)
    ctx.save();
    ctx.translate(px(x), py(y));
    ctx.rotate(-theta);
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(9, 9);
    ctx.lineTo(0, 4);
    ctx.lineTo(-9, 9);
    ctx.closePath();
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  return { update };
}
