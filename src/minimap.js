import { MAP_WIDTH, MAP_HEIGHT, ROADS } from './deliveryMap.js';

// Mode Livraison : mini-carte du réseau (nord en haut) avec les points de livraison restants et la
// position et la direction du joueur.
// Le plan est dessiné une seule fois dans un canvas hors écran ; à chaque image on le recopie puis on
// dessine la flèche du joueur par-dessus.

const WIDTH = 400; // résolution interne du canvas (affiché plus petit en CSS : net sur écran haute densité)
const PADDING = 14;
const SCALE = (WIDTH - 2 * PADDING) / MAP_WIDTH; // pixels par mètre
const HEIGHT = Math.round(MAP_HEIGHT * SCALE + 2 * PADDING);

const ROAD_STYLE = {
  big: { color: '#e9e9e9', width: 8 },
  small: { color: '#a99c86', width: 3.5 },
  alley: { color: '#8a7f6c', width: 2.5 },
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

  // Ruelles et petites rues d'abord : les grandes routes passent dessus
  for (const type of ['alley', 'small', 'big']) {
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

  // Terre-plein central des grandes routes : trait vert au milieu
  ctx.strokeStyle = '#5f8a3a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const road of ROADS) {
    if (road.type !== 'big') continue;
    if (road.y !== undefined) {
      ctx.moveTo(px(road.x1), py(road.y));
      ctx.lineTo(px(road.x2), py(road.y));
    } else {
      ctx.moveTo(px(road.x), py(road.y1));
      ctx.lineTo(px(road.x), py(road.y2));
    }
  }
  ctx.stroke();
  return plan;
}

export function createMinimap(canvas) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  const plan = drawPlan();

  // x, y : position du joueur sur la carte (mètres) ; theta : direction (repère de track.js / network.js) ;
  // points : points d'arrêt restants { x, y, kind } (deliveryPoints.js) : livraison orange, chargement vert
  function update(x, y, theta, points) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(plan, 0, 0);

    // Points de livraison : pastille orange avec une flèche vers le bas, comme sur la route
    ctx.lineJoin = 'round';
    for (const point of points) {
      const cx = px(point.x);
      const cy = py(point.y);
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fillStyle = point.kind === 'pickup' ? '#2e9e4f' : '#e8642a';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1b1b1b';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy - 6);
      ctx.lineTo(cx + 3, cy - 6);
      ctx.lineTo(cx + 3, cy);
      ctx.lineTo(cx + 6, cy);
      ctx.lineTo(cx, cy + 7);
      ctx.lineTo(cx - 6, cy);
      ctx.lineTo(cx - 3, cy);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.fill();
    }

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
