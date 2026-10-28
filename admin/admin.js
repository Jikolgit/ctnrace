import { SETTINGS } from '../src/gameSettings.js';

// Interface admin (/admin) : connexion, puis un champ par réglage (src/gameSettings.js), Sauvegarder et Retour au
// jeu. Toutes les vérifications se font sur le serveur (api/admin.js) : les identifiants sont gardés en mémoire le
// temps de la page seulement, et renvoyés à chaque sauvegarde.
const loginForm = document.getElementById('login');
const settingsForm = document.getElementById('settings');
const fields = document.getElementById('fields');
const message = document.getElementById('message');
let credentials = null;

const show = (text) => (message.textContent = text);

async function request(body) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...credentials, ...body }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Erreur ${response.status}`);
  return data;
}

// Heure décimale ↔ champ « HH:MM »
const toTime = (hours) =>
  `${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.round((hours % 1) * 60)).padStart(2, '0')}`;
const fromTime = (text) => {
  const [h, m] = text.split(':').map(Number);
  return h + (m || 0) / 60;
};

// Un champ par réglage, rempli avec les valeurs actuelles
function buildFields(values) {
  fields.innerHTML = '';
  for (const setting of SETTINGS) {
    const value = values[setting.key];
    if (setting.type === 'boolean') {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" name="${setting.key}" /> ${setting.label}`;
      label.querySelector('input').checked = value;
      fields.append(label);
    } else if (setting.type === 'hour') {
      const box = document.createElement('fieldset');
      box.innerHTML = `<legend>${setting.label}</legend>
        <label><input type="radio" name="${setting.key}-mode" value="real" /> Heure réelle de Cotonou</label>
        <label><input type="radio" name="${setting.key}-mode" value="fixed" /> Heure fixe :
          <input type="time" name="${setting.key}" step="60" /></label>`;
      const fixed = value !== null;
      box.querySelector(`[value="${fixed ? 'fixed' : 'real'}"]`).checked = true;
      box.querySelector(`[name="${setting.key}"]`).value = toTime(fixed ? value : 12);
      fields.append(box);
    }
  }
}

function readFields() {
  const values = {};
  for (const setting of SETTINGS) {
    if (setting.type === 'boolean') values[setting.key] = settingsForm.elements[setting.key].checked;
    else if (setting.type === 'hour') {
      const fixed = settingsForm.elements[`${setting.key}-mode`].value === 'fixed';
      const time = settingsForm.elements[setting.key].value;
      values[setting.key] = fixed && time ? fromTime(time) : null;
    }
  }
  return values;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  credentials = { user: loginForm.elements.user.value, password: loginForm.elements.password.value };
  show('Connexion…');
  try {
    const { settings } = await request({});
    buildFields(settings);
    loginForm.hidden = true;
    settingsForm.hidden = false;
    show('');
  } catch (error) {
    credentials = null;
    show(error.message);
  }
});

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  show('Enregistrement…');
  try {
    const { settings } = await request({ settings: readFields() });
    buildFields(settings);
    show(`Enregistré à ${new Date().toLocaleTimeString('fr-FR')}.`);
  } catch (error) {
    show(`Échec : ${error.message}`);
  }
});
