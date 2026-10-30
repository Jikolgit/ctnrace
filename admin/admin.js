import { SETTINGS, MAX_DELIVERIES } from '../src/gameSettings.js';
import { CITY_COUNT, MISSIONS_PER_CITY, cityName, missionCity, missionInCity } from '../src/missionData.js';

// Interface admin (/admin) : connexion, puis un champ par réglage (src/gameSettings.js), Sauvegarder et Retour au
// jeu. Toutes les vérifications se font sur le serveur (api/admin.js) : les identifiants sont gardés en mémoire le
// temps de la page seulement, et renvoyés à chaque sauvegarde.
const loginForm = document.getElementById('login');
const settingsForm = document.getElementById('settings');
const fields = document.getElementById('fields');
const message = document.getElementById('message');
let credentials = null;
let missionValues = []; // réglages des missions, modifiés dans la boîte de dialogue
const openCities = new Set(); // villes dépliées (gardées quand la liste est reconstruite après une sauvegarde)

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
    } else if (setting.type === 'text') {
      const label = document.createElement('label');
      label.innerHTML = `${setting.label}<br /><input type="text" name="${setting.key}" required maxlength="${setting.maxLength}" size="32" />`;
      label.querySelector('input').value = value;
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
    } else if (setting.type === 'missions') {
      // Une ligne par ville, qui se déplie pour montrer ses missions ; un clic sur une mission ouvre la boîte de
      // dialogue de ses réglages (openMission)
      missionValues = value.map((mission) => ({ ...mission }));
      const box = document.createElement('fieldset');
      box.innerHTML = `<legend>${setting.label}</legend>`;
      for (let city = 1; city <= CITY_COUNT; city++) {
        const details = document.createElement('details');
        details.className = 'city';
        details.open = openCities.has(city);
        details.addEventListener('toggle', () => (details.open ? openCities.add(city) : openCities.delete(city)));
        details.innerHTML = `<summary>${cityName(city)}</summary><div class="mission-list"></div>`;
        const list = details.querySelector('.mission-list');
        for (let i = 1; i <= MISSIONS_PER_CITY; i++) {
          const n = (city - 1) * MISSIONS_PER_CITY + i;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'mission-button';
          button.innerHTML = `<strong>Mission ${i}</strong><small>${missionSummary(missionValues[n - 1])}</small>`;
          button.classList.toggle('off', !missionValues[n - 1].enabled);
          button.addEventListener('click', () => openMission(n));
          list.append(button);
        }
        box.append(details);
      }
      fields.append(box);
    }
  }
}

// Résumé d'une mission sous son nom
function missionSummary(mission) {
  if (!mission.enabled) return 'Désactivée';
  return `${mission.deliveries} livraison${mission.deliveries > 1 ? 's' : ''} · ${mission.reward} Fric`;
}

// Boîte de dialogue d'une mission : ses réglages, Sauvegarder (enregistre tout de suite pour tous les joueurs)
// ou Annuler (ferme sans rien changer)
const dialog = document.getElementById('mission-dialog');
const dialogForm = dialog.querySelector('form');
const dialogMessage = dialog.querySelector('.dialog-message');
dialogForm.elements.deliveries.max = MAX_DELIVERIES;
let editedMission = 0;

function openMission(n) {
  editedMission = n;
  const mission = missionValues[n - 1];
  dialog.querySelector('h2').textContent = `${cityName(missionCity(n))} – Mission ${missionInCity(n)}`;
  dialogForm.elements.enabled.checked = mission.enabled;
  dialogForm.elements.deliveries.value = mission.deliveries;
  dialogForm.elements.reward.value = mission.reward;
  dialogForm.elements.fuelPrice.value = mission.fuelPrice;
  dialogForm.elements.loaded.value = mission.loaded ? 'loaded' : 'pickup';
  dialogMessage.textContent = '';
  dialog.showModal();
}

dialog.querySelector('.cancel').addEventListener('click', () => dialog.close());

dialogForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const previous = missionValues[editedMission - 1];
  missionValues[editedMission - 1] = {
    enabled: dialogForm.elements.enabled.checked,
    deliveries: Number(dialogForm.elements.deliveries.value),
    reward: Number(dialogForm.elements.reward.value),
    fuelPrice: Number(dialogForm.elements.fuelPrice.value),
    loaded: dialogForm.elements.loaded.value === 'loaded',
  };
  dialogMessage.textContent = 'Enregistrement…';
  try {
    await save();
    dialog.close();
  } catch (error) {
    missionValues[editedMission - 1] = previous; // rien n'a changé sur le serveur
    dialogMessage.textContent = `Échec : ${error.message}`;
  }
});

function readFields() {
  const values = {};
  for (const setting of SETTINGS) {
    if (setting.type === 'boolean') values[setting.key] = settingsForm.elements[setting.key].checked;
    else if (setting.type === 'text') values[setting.key] = settingsForm.elements[setting.key].value.trim();
    else if (setting.type === 'hour') {
      const fixed = settingsForm.elements[`${setting.key}-mode`].value === 'fixed';
      const time = settingsForm.elements[setting.key].value;
      values[setting.key] = fixed && time ? fromTime(time) : null;
    } else if (setting.type === 'missions') {
      values[setting.key] = missionValues; // modifiées dans la boîte de dialogue
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

// Enregistre tous les réglages (formulaire + missions) pour tous les joueurs ; lève une erreur en cas d'échec
async function save() {
  show('Enregistrement…');
  try {
    const { settings } = await request({ settings: readFields() });
    buildFields(settings);
    show(`Enregistré à ${new Date().toLocaleTimeString('fr-FR')}.`);
  } catch (error) {
    show(`Échec : ${error.message}`);
    throw error;
  }
}

settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  save().catch(() => {}); // message déjà affiché
});

// Bouton vers le visualiseur des modèles 3D du jeu (page /modeles, voir modeles/viewer.js), sous Sauvegarder et
// Retour au jeu
const modelsButton = document.createElement('button');
modelsButton.type = 'button';
modelsButton.textContent = 'Voir les modèles 3D';
modelsButton.addEventListener('click', () => {
  location.href = '/modeles/';
});
const modelsRow = document.createElement('p');
modelsRow.append(modelsButton);
settingsForm.append(modelsRow);
