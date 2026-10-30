// Compteur de vitesse simple : fond noir, graduations blanches, aiguille et valeur numérique.
// Construit en SVG, mis à jour par updateSpeedometer(kmh) (le DOM ne change que si la valeur affichée change).
const NS = 'http://www.w3.org/2000/svg';
const CX = 100;
const CY = 100;
const MAX_KMH = 60; // fin du cadran
const START_ANGLE = -135; // degrés depuis le haut, sens horaire (0 en bas à gauche)
const END_ANGLE = 135;

const toAngle = (kmh) => START_ANGLE + (kmh / MAX_KMH) * (END_ANGLE - START_ANGLE);
const polar = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

let needle = null;
let valueText = null;
let shownKmh = -1;

export function createSpeedometer() {
  const root = document.createElement('div');
  root.id = 'speedo';
  root.setAttribute('aria-label', 'Compteur de vitesse');
  const svg = el('svg', { viewBox: '0 0 200 200', 'aria-hidden': 'true' }, root);

  // Fond noir
  el('circle', { cx: CX, cy: CY, r: 96, fill: '#000' }, svg);

  // Graduations tous les 10 km/h, chiffres tous les 20 km/h
  for (let v = 0; v <= MAX_KMH; v += 10) {
    const a = toAngle(v);
    const [x1, y1] = polar(72, a);
    const [x2, y2] = polar(85, a);
    el('line', { x1, y1, x2, y2, stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
    if (v % 20 === 0) {
      const [tx, ty] = polar(58, a);
      const t = el('text', {
        x: tx, y: ty + 5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 'bold',
        'font-family': 'system-ui, sans-serif', fill: '#fff',
      }, svg);
      t.textContent = v;
    }
  }

  // Valeur numérique et unité
  valueText = el('text', {
    x: CX, y: 138, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 'bold',
    'font-family': 'system-ui, sans-serif', fill: '#fff',
  }, svg);
  valueText.textContent = '0';
  const unit = el('text', {
    x: CX, y: 156, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 'bold',
    'font-family': 'system-ui, sans-serif', fill: '#aaa',
  }, svg);
  unit.textContent = 'KM/H';

  // Aiguille blanche (tourne autour du centre) et moyeu
  needle = el('g', { transform: `rotate(${START_ANGLE} ${CX} ${CY})` }, svg);
  el('polygon', { points: `${CX - 2},${CY + 10} ${CX + 2},${CY + 10} ${CX},${CY - 78}`, fill: '#fff' }, needle);
  el('circle', { cx: CX, cy: CY, r: 6, fill: '#fff' }, svg);

  document.body.appendChild(root);
  return root;
}

// kmh : vitesse à afficher (nombre ≥ 0)
export function updateSpeedometer(kmh) {
  if (!needle) return;
  const shown = Math.round(Math.max(0, kmh));
  if (shown === shownKmh) return;
  shownKmh = shown;
  const clamped = Math.min(shown, MAX_KMH);
  needle.setAttribute('transform', `rotate(${toAngle(clamped)} ${CX} ${CY})`);
  valueText.textContent = shown;
}
