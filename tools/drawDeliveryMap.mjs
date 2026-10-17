// Dessine le réseau de routes du mode Livraison (src/deliveryMap.js) dans docs/reseau-livraison.svg
// Usage : node tools/drawDeliveryMap.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  MAP_WIDTH, MAP_HEIGHT, ROAD_TYPES, ROADS, PLACES, DISTRICTS, LANE_WIDTH, SIDEWALK_WIDTH,
} from '../src/deliveryMap.js';

const S = 2; // pixels par mètre
const LEGEND_HEIGHT = 90;
const W = MAP_WIDTH * S;
const H = MAP_HEIGHT * S;

const roadWidth = (road) => ROAD_TYPES[road.type].lanes * LANE_WIDTH;
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
};

const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + LEGEND_HEIGHT}" viewBox="0 0 ${W} ${H + LEGEND_HEIGHT}" font-family="Segoe UI, system-ui, sans-serif">`);
out.push(`<defs>
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

// Quartiers
for (const d of DISTRICTS) {
  out.push(`<text x="${d.x * S}" y="${d.y * S}" text-anchor="middle" font-size="18" font-weight="700" letter-spacing="3" fill="#a59d8c">${d.name}</text>`);
}

// Trottoirs, puis chaussées (pavés ou goudron), petites rues d'abord : les grandes passent dessus
const ordered = [...ROADS].sort((a, b) => (a.type === 'big') - (b.type === 'big'));
for (const road of ordered) out.push(rectSvg(rect(road, outerWidth(road), SIDEWALK_WIDTH), COLORS.sidewalk));
for (const road of ordered) {
  out.push(rectSvg(rect(road, roadWidth(road)), road.type === 'big' ? COLORS.big : 'url(#paves)'));
}

// Marquage des couloirs : tirets blancs sur le goudron, lignes discrètes sur les pavés
for (const road of ordered) {
  const lanes = ROAD_TYPES[road.type].lanes;
  for (let i = 1; i < lanes; i++) {
    const offset = -roadWidth(road) / 2 + i * LANE_WIDTH;
    const center = road.type === 'big' && i === lanes / 2;
    const stroke = road.type === 'big' ? (center ? '#f2c94c' : '#ffffff') : '#ece2cf';
    const dash = center ? '' : road.type === 'big' ? 'stroke-dasharray="10 8"' : 'stroke-dasharray="4 6"';
    const width = road.type === 'big' ? 1.2 : 0.8;
    const [x1, y1, x2, y2] = isHorizontal(road)
      ? [road.x1, road.y + offset, road.x2, road.y + offset]
      : [road.x + offset, road.y1, road.x + offset, road.y2];
    out.push(`<line x1="${x1 * S}" y1="${y1 * S}" x2="${x2 * S}" y2="${y2 * S}" stroke="${stroke}" stroke-width="${width}" ${dash}/>`);
  }
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

// Lieux (futurs points de livraison)
for (const p of PLACES) {
  const x = p.x * S;
  const y = p.y * S;
  out.push(`<circle cx="${x}" cy="${y}" r="9" fill="#e8642a" stroke="#1b1b1b" stroke-width="2"/>`);
  out.push(`<circle cx="${x}" cy="${y}" r="3" fill="#fff"/>`);
  out.push(`<text x="${x}" y="${y + 24}" text-anchor="middle" font-size="13" font-weight="700" fill="#c4461a" stroke="#fff" stroke-width="3" paint-order="stroke">${p.name}</text>`);
}

// Échelle
out.push(`<g transform="translate(${W - 150}, ${H - 24})"><rect x="-8" y="-18" width="140" height="30" rx="4" fill="#fff" opacity="0.85"/>
<line x1="0" y1="0" x2="${100 * S / 2}" y2="0" stroke="#333" stroke-width="3"/><text x="${50 * S / 2 + 8}" y="4" font-size="12" fill="#333">50 m</text></g>`);

// Légende
const count = (n) => junctions.filter((j) => j.arms === n).length;
const ly = H + 14;
out.push(`<rect y="${H}" width="${W}" height="${LEGEND_HEIGHT}" fill="#ffffff"/>`);
out.push(`<rect x="24" y="${ly + 6}" width="60" height="16" fill="${COLORS.big}"/><line x1="24" y1="${ly + 14}" x2="84" y2="${ly + 14}" stroke="#f2c94c" stroke-width="1.5"/>`);
out.push(`<text x="96" y="${ly + 19}" font-size="15" fill="#222"><tspan font-weight="700">Grande route goudronnée</tspan> : 4 couloirs (8 m)</text>`);
out.push(`<rect x="24" y="${ly + 40}" width="60" height="12" fill="url(#paves)"/>`);
out.push(`<text x="96" y="${ly + 51}" font-size="15" fill="#222"><tspan font-weight="700">Petite rue pavée</tspan> : 3 couloirs (6 m)</text>`);
out.push(`<circle cx="${W / 2 + 70}" cy="${ly + 14}" r="8" fill="#e8642a" stroke="#1b1b1b" stroke-width="2"/>`);
out.push(`<text x="${W / 2 + 86}" y="${ly + 19}" font-size="15" fill="#222">Lieu de livraison</text>`);
out.push(`<text x="${W / 2 + 62}" y="${ly + 51}" font-size="15" fill="#222">${junctions.length} carrefours : ${count(4)} en croix, ${count(3)} en T, ${count(2)} en L</text>`);
out.push(`<text x="24" y="${H + LEGEND_HEIGHT - 10}" font-size="12" fill="#888">Réseau ${MAP_WIDTH} × ${MAP_HEIGHT} m, inspiré de Ségbeya / Kpondehou (Cotonou). Données : src/deliveryMap.js</text>`);

out.push('</svg>');

mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/reseau-livraison.svg', import.meta.url), out.join('\n'));
console.log(`docs/reseau-livraison.svg : ${ROADS.length} rues, ${junctions.length} carrefours`);
