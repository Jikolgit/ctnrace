// Dessine le réseau de routes du mode Livraison (src/deliveryMap.js) dans docs/reseau-livraison.svg
// Usage : node tools/drawDeliveryMap.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  MAP_WIDTH, MAP_HEIGHT, ROAD_TYPES, ROADS, DISTRICTS, LANE_WIDTH, SIDEWALK_WIDTH,
} from '../src/deliveryMap.js';
import { missionData } from '../src/missions.js';

const MISSION = 1; // mission dont on dessine les points de livraison
const START = { x: 240, y: 490, label: 'Départ' }; // départ du joueur (network.js : Rue 1451, vers le nord)

const S = 2; // pixels par mètre
const LEGEND_HEIGHT = 125;
const W = MAP_WIDTH * S;
const H = MAP_HEIGHT * S;

const medianOf = (road) => ROAD_TYPES[road.type].median ?? 0;
const laneW = (road) => ROAD_TYPES[road.type].laneWidth ?? LANE_WIDTH;
const roadWidth = (road) => ROAD_TYPES[road.type].lanes * laneW(road) + medianOf(road);
const outerWidth = (road) => roadWidth(road) + 2 * SIDEWALK_WIDTH;
const isHorizontal = (road) => road.y !== undefined;

// Rectangle d'une rue (en pixels), élargi de `width` mètres autour de son axe
function rect(road, width, extra = 0) {
  if (isHorizontal(road)) {
    return { x: (road.x1 - extra) * S, y: (road.y - width / 2) * S, w: (road.x2 - road.x1 + 2 * extra) * S, h: width * S };
  }
  return { x: (road.x - width / 2) * S, y: (road.y1 - extra) * S, w: width * S, h: (road.y2 - road.y1 + 2 * extra) * S };
}
const rectSvg = (r, fill) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill}"/>`;

// Carrefours : croisement d'une rue horizontale et d'une verticale ; type selon le nombre de branches
const junctions = [];
for (const h of ROADS.filter(isHorizontal)) {
  for (const v of ROADS.filter((r) => !isHorizontal(r))) {
    if (v.x < h.x1 || v.x > h.x2 || h.y < v.y1 || h.y > v.y2) continue;
    const arms = (v.x > h.x1) + (v.x < h.x2) + (h.y > v.y1) + (h.y < v.y2);
    junctions.push({ x: v.x, y: h.y, h, v, arms });
  }
}

const COLORS = {
  water: '#8fd3f0',
  land: '#efe9dc',
  sidewalk: '#cfc8ba',
  small: '#b8a58a', // pavés
  big: '#4b4e54', // goudron
  alley: '#857a68', // petits pavés des ruelles
};

const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + LEGEND_HEIGHT}" viewBox="0 0 ${W} ${H + LEGEND_HEIGHT}" font-family="Segoe UI, system-ui, sans-serif">`);
out.push(`<defs>
  <pattern id="ruelle" width="6" height="4" patternUnits="userSpaceOnUse">
    <rect width="6" height="4" fill="${COLORS.alley}"/>
    <path d="M0 0h6M0 2h6M3 0v2M0 2v2M6 2v2" stroke="#5e5547" stroke-width="0.6"/>
  </pattern>
  <pattern id="paves" width="8" height="8" patternUnits="userSpaceOnUse">
    <rect width="8" height="8" fill="${COLORS.small}"/>
    <path d="M0 4h8M4 0v4M0 8h0M2 4v4M6 4v4" stroke="#9c8a70" stroke-width="0.8"/>
  </pattern>
</defs>`);

// Eau puis terre (côte ondulée à l'ouest et au nord)
out.push(`<rect width="${W}" height="${H}" fill="${COLORS.water}"/>`);
const coast = [];
for (let y = 0; y <= MAP_HEIGHT; y += 20) coast.push([22 + 7 * Math.sin(y / 37) + 4 * Math.sin(y / 11), y]);
const top = [];
for (let x = MAP_WIDTH; x >= 40; x -= 20) top.push([x, 12 + 6 * Math.sin(x / 45) + 3 * Math.sin(x / 13)]);
// Polygone : bas-droite → côte ouest (du bas vers le haut) → côte nord (de gauche à droite)
const landPoly = [[MAP_WIDTH, MAP_HEIGHT], ...[...coast].reverse(), ...[...top].reverse()];
out.push(`<polygon points="${landPoly.map(([x, y]) => `${x * S},${y * S}`).join(' ')}" fill="${COLORS.land}"/>`);

// Quadrillage tous les 20 m (plus marqué tous les 100 m) avec les coordonnées : pour repérer où tracer
for (let x = 0; x <= MAP_WIDTH; x += 20) {
  const major = x % 100 === 0;
  out.push(`<line x1="${x * S}" y1="0" x2="${x * S}" y2="${H}" stroke="#000" stroke-opacity="${major ? 0.18 : 0.07}" stroke-width="1"/>`);
  if (major) out.push(`<text x="${x * S + 3}" y="${H - 6}" font-size="12" fill="#555">x ${x}</text>`);
}
for (let y = 0; y <= MAP_HEIGHT; y += 20) {
  const major = y % 100 === 0;
  out.push(`<line x1="0" y1="${y * S}" x2="${W}" y2="${y * S}" stroke="#000" stroke-opacity="${major ? 0.18 : 0.07}" stroke-width="1"/>`);
  if (major && y > 0) out.push(`<text x="${W - 4}" y="${y * S - 4}" text-anchor="end" font-size="12" fill="#555">y ${y}</text>`);
}

// Quartiers
for (const d of DISTRICTS) {
  out.push(`<text x="${d.x * S}" y="${d.y * S}" text-anchor="middle" font-size="18" font-weight="700" letter-spacing="3" fill="#a59d8c">${d.name}</text>`);
}

// Trottoirs, puis chaussées (pavés ou goudron), petites rues d'abord : les grandes passent dessus
const ordered = [...ROADS].sort((a, b) => (a.type === 'big') - (b.type === 'big'));
for (const road of ordered) out.push(rectSvg(rect(road, outerWidth(road), SIDEWALK_WIDTH), COLORS.sidewalk));
for (const road of ordered) {
  const surface = { big: COLORS.big, small: 'url(#paves)', alley: 'url(#ruelle)' }[road.type];
  out.push(rectSvg(rect(road, roadWidth(road)), surface));
}

// Marquage des couloirs : tirets blancs sur le goudron, lignes discrètes sur les pavés.
// Grandes routes : terre-plein central vert entre les deux sens (dessiné après, par-dessus)
for (const road of ordered) {
  const lanes = ROAD_TYPES[road.type].lanes;
  const median = medianOf(road);
  for (let i = 1; i < lanes; i++) {
    if (median && i === lanes / 2) continue; // la place du terre-plein
    let offset = -roadWidth(road) / 2 + i * laneW(road);
    if (median && i > lanes / 2) offset += median;
    const stroke = road.type === 'big' ? '#ffffff' : '#ece2cf';
    const dash = road.type === 'big' ? 'stroke-dasharray="10 8"' : 'stroke-dasharray="4 6"';
    const width = road.type === 'big' ? 1.2 : 0.8;
    const [x1, y1, x2, y2] = isHorizontal(road)
      ? [road.x1, road.y + offset, road.x2, road.y + offset]
      : [road.x + offset, road.y1, road.x + offset, road.y2];
    out.push(`<line x1="${x1 * S}" y1="${y1 * S}" x2="${x2 * S}" y2="${y2 * S}" stroke="${stroke}" stroke-width="${width}" ${dash}/>`);
  }
}

// Terre-plein central (interrompu aux carrefours, qui sont dessinés par-dessus)
for (const road of ordered) {
  const median = medianOf(road);
  if (median) out.push(rectSvg(rect(road, median), '#5f8a3a'));
}

// Carrefours : on efface le marquage (chaussée de la plus grande des deux rues)
for (const j of junctions) {
  const wh = roadWidth(j.h);
  const wv = roadWidth(j.v);
  const fill = j.h.type === 'big' || j.v.type === 'big' ? COLORS.big : 'url(#paves)';
  out.push(`<rect x="${(j.x - wv / 2) * S}" y="${(j.y - wh / 2) * S}" width="${wv * S}" height="${wh * S}" fill="${fill}"/>`);
}

// Noms des rues (au milieu d'un tronçon, entre deux carrefours)
for (const road of ROADS) {
  const big = road.type === 'big';
  const style = `font-size="${big ? 13 : 11}" font-weight="${big ? 700 : 500}" fill="${big ? '#2d2f33' : '#6b604f'}" stroke="${COLORS.land}" stroke-width="3" paint-order="stroke"`;
  if (isHorizontal(road)) {
    const xs = [road.x1, ...junctions.filter((j) => j.h === road).map((j) => j.x), road.x2].sort((a, b) => a - b);
    let best = [xs[0], xs[0]];
    for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > best[1] - best[0]) best = [xs[i - 1], xs[i]];
    const x = (best[0] + best[1]) / 2;
    out.push(`<text x="${x * S}" y="${(road.y - outerWidth(road) / 2) * S - 4}" text-anchor="middle" ${style}>${road.name}</text>`);
  } else {
    const ys = [road.y1, ...junctions.filter((j) => j.v === road).map((j) => j.y), road.y2].sort((a, b) => a - b);
    let best = [ys[0], ys[0]];
    for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > best[1] - best[0]) best = [ys[i - 1], ys[i]];
    const y = (best[0] + best[1]) / 2;
    const x = (road.x - outerWidth(road) / 2) * S - 5;
    out.push(`<text x="${x}" y="${y * S}" text-anchor="middle" transform="rotate(-90 ${x} ${y * S})" ${style}>${road.name}</text>`);
  }
}

// Points de livraison de la mission (même calcul que src/deliveryPoints.js : couloir qui longe le trottoir)
const roadByName = (name) => ROADS.find((r) => r.name === name);
missionData(MISSION).deliveries.forEach((d, i) => {
  const road = roadByName(d.road);
  const lateral = d.side * (roadWidth(road) / 2 - laneW(road) / 2);
  const [mx, my] = isHorizontal(road) ? [d.at, road.y + lateral] : [road.x + lateral, d.at];
  const x = mx * S;
  const y = my * S;
  // Étiquette du côté du trottoir de livraison
  const [dx, dy, anchor] = isHorizontal(road) ? [0, d.side * 30, 'middle'] : [d.side * 18, 5, d.side < 0 ? 'end' : 'start'];
  out.push(`<circle cx="${x}" cy="${y}" r="12" fill="#e8642a" stroke="#1b1b1b" stroke-width="3"/>`);
  out.push(`<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="800" fill="#fff">${i + 1}</text>`);
  out.push(`<text x="${x + dx}" y="${y + dy}" text-anchor="${anchor}" font-size="14" font-weight="800" fill="#c4461a" stroke="#fff" stroke-width="4" paint-order="stroke">${d.name}</text>`);
});

// Départ
out.push(`<circle cx="${START.x * S}" cy="${START.y * S}" r="10" fill="#2e9e4f" stroke="#1b1b1b" stroke-width="3"/>`);
out.push(`<text x="${START.x * S + 16}" y="${START.y * S + 5}" font-size="14" font-weight="800" fill="#1f7a3a" stroke="#fff" stroke-width="4" paint-order="stroke">${START.label} ↑</text>`);

// Échelle
out.push(`<g transform="translate(${W - 150}, ${H - 24})"><rect x="-8" y="-18" width="140" height="30" rx="4" fill="#fff" opacity="0.85"/>
<line x1="0" y1="0" x2="${100 * S / 2}" y2="0" stroke="#333" stroke-width="3"/><text x="${50 * S / 2 + 8}" y="4" font-size="12" fill="#333">50 m</text></g>`);

// Légende
const count = (n) => junctions.filter((j) => j.arms === n).length;
const ly = H + 14;
out.push(`<rect y="${H}" width="${W}" height="${LEGEND_HEIGHT}" fill="#ffffff"/>`);
out.push(`<rect x="24" y="${ly + 6}" width="60" height="16" fill="${COLORS.big}"/><rect x="24" y="${ly + 12}" width="60" height="4" fill="#5f8a3a"/>`);
out.push(`<text x="96" y="${ly + 19}" font-size="15" fill="#222"><tspan font-weight="700">Grande route goudronnée</tspan> : 2 × 2 couloirs de 2,5 m et terre-plein central (12 m)</text>`);
out.push(`<rect x="24" y="${ly + 40}" width="60" height="12" fill="url(#paves)"/>`);
out.push(`<text x="96" y="${ly + 51}" font-size="15" fill="#222"><tspan font-weight="700">Petite rue pavée</tspan> : 3 couloirs (6 m)</text>`);
out.push(`<rect x="24" y="${ly + 66}" width="60" height="10" fill="url(#ruelle)"/>`);
out.push(`<text x="96" y="${ly + 76}" font-size="15" fill="#222"><tspan font-weight="700">Ruelle</tspan> : 2 couloirs (4 m), raccourci</text>`);
out.push(`<circle cx="${W / 2 + 70}" cy="${ly + 14}" r="8" fill="#e8642a" stroke="#1b1b1b" stroke-width="2"/>`);
out.push(`<text x="${W / 2 + 86}" y="${ly + 19}" font-size="15" fill="#222">Livraison (mission ${MISSION})</text>`);
out.push(`<circle cx="${W / 2 + 270}" cy="${ly + 14}" r="8" fill="#2e9e4f" stroke="#1b1b1b" stroke-width="2"/>`);
out.push(`<text x="${W / 2 + 286}" y="${ly + 19}" font-size="15" fill="#222">Départ</text>`);
out.push(`<text x="${W / 2 + 62}" y="${ly + 51}" font-size="15" fill="#222">${junctions.length} carrefours : ${count(4)} en croix, ${count(3)} en T, ${count(2)} en L</text>`);
out.push(`<text x="24" y="${H + LEGEND_HEIGHT - 10}" font-size="12" fill="#888">Réseau ${MAP_WIDTH} × ${MAP_HEIGHT} m, inspiré de Ségbeya / Kpondehou (Cotonou). Données : src/deliveryMap.js</text>`);

out.push('</svg>');

mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/reseau-livraison.svg', import.meta.url), out.join('\n'));
console.log(`docs/reseau-livraison.svg : ${ROADS.length} rues, ${junctions.length} carrefours`);
