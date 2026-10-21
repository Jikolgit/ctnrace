// Outil de réglage de la caméra (développement) : panneau de curseurs pour placer la caméra d'hélicoptère et
// le point qu'elle regarde, avec leurs coordonnées affichées. Visible seulement avec « ?camera » dans l'adresse
// (ex. https://…vercel.app/?camera). Les valeurs sont relatives à la moto (moto en 0, 0, 0, avant vers -Z :
// z négatif = devant la moto, z positif = derrière, y = hauteur, x > 0 = à droite).
// Les curseurs modifient directement l'objet settings ; le bouton « Copier » met les valeurs dans le
// presse-papiers pour les reporter dans main.js.

const FIELDS = [
  { key: 'x', label: 'Caméra X', min: -15, max: 15, step: 0.5 },
  { key: 'y', label: 'Caméra Y (hauteur)', min: 1, max: 40, step: 0.5 },
  { key: 'z', label: 'Caméra Z (recul)', min: -20, max: 40, step: 0.5 },
  { key: 'lookY', label: 'Regard Y', min: -5, max: 10, step: 0.5 },
  { key: 'lookZ', label: 'Regard Z', min: -40, max: 20, step: 0.5 },
];

export function createCameraTuner(settings) {
  if (!new URLSearchParams(location.search).has('camera')) return null;

  const panel = document.createElement('div');
  panel.id = 'camera-tuner';
  // Bouton pour replier le panneau (et voir la scène en entier) ; les coordonnées restent affichées
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'Replier';
  toggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    toggle.textContent = collapsed ? 'Régler la caméra' : 'Replier';
  });
  const readout = document.createElement('pre');
  panel.append(toggle, readout);

  const show = () => {
    readout.textContent =
      `caméra  x ${settings.x.toFixed(1)}  y ${settings.y.toFixed(1)}  z ${settings.z.toFixed(1)}\n` +
      `regard  y ${settings.lookY.toFixed(1)}  z ${settings.lookZ.toFixed(1)}`;
  };

  for (const field of FIELDS) {
    const label = document.createElement('label');
    label.textContent = field.label;
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min: field.min, max: field.max, step: field.step, value: settings[field.key] });
    input.addEventListener('input', () => {
      settings[field.key] = Number(input.value);
      show();
    });
    label.append(input);
    panel.append(label);
  }

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copier les valeurs';
  copy.addEventListener('click', () => {
    navigator.clipboard?.writeText(readout.textContent).then(
      () => (copy.textContent = 'Copié !'),
      () => (copy.textContent = 'Copie impossible : recopie le texte')
    );
    setTimeout(() => (copy.textContent = 'Copier les valeurs'), 1500);
  });
  panel.append(copy);

  document.body.append(panel);
  show();
  return panel;
}
