// POST /api/admin { user, password, settings? } : interface admin (/admin).
// Sans settings : vérifie seulement les identifiants et renvoie les réglages actuels (connexion).
// Avec settings : les vérifie (gameSettings.js) et les enregistre dans Firestore (config/game) pour tous les joueurs.
//
// Identifiants : variables d'environnement Vercel ADMIN_USER et ADMIN_PASSWORD si elles existent, sinon ceux choisis
// par l'utilisateur (le mot de passe n'est gardé ici que sous forme d'empreinte SHA-256). Vérifiés sur le serveur
// seulement : rien n'est visible dans le code du jeu. Une erreur d'identifiants attend FAIL_DELAY avant de répondre,
// pour ralentir les essais en série.
import { createHash, timingSafeEqual } from 'node:crypto';
import { firebase, errorMessage, send } from './_lib/server.js';
import { cleanSettings } from '../src/gameSettings.js';

const DEFAULT_USER = 'admin_1';
const DEFAULT_PASSWORD_SHA256 = '3d1e557b540ac045b3b327994a351f08a443f9216f9b2b8d3a0f42b58671ac83'; // empreinte du mot de passe choisi par l'utilisateur
const FAIL_DELAY = 1000; // ms

const sha256 = (text) => createHash('sha256').update(String(text)).digest();
const sameHash = (a, b) => a.length === b.length && timingSafeEqual(a, b);

function validCredentials(user, password) {
  const expectedUser = process.env.ADMIN_USER || DEFAULT_USER;
  const expectedPassword = process.env.ADMIN_PASSWORD
    ? sha256(process.env.ADMIN_PASSWORD)
    : Buffer.from(DEFAULT_PASSWORD_SHA256, 'hex');
  // Toujours les deux comparaisons (même durée que le nom soit bon ou non)
  const userOk = sameHash(sha256(user), sha256(expectedUser));
  const passwordOk = sameHash(sha256(password), expectedPassword);
  return userOk && passwordOk;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non permise' });
  res.setHeader('Cache-Control', 'no-store');
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
  if (!validCredentials(body.user ?? '', body.password ?? '')) {
    await new Promise((resolve) => setTimeout(resolve, FAIL_DELAY));
    return send(res, 401, { error: 'Identifiants incorrects' });
  }
  try {
    const { db } = await firebase();
    const ref = db.collection('config').doc('game');
    if (body.settings) {
      const settings = cleanSettings(body.settings);
      await ref.set({ ...settings, updatedAt: new Date() });
      return send(res, 200, { saved: true, settings });
    }
    return send(res, 200, { settings: cleanSettings((await ref.get()).data()) });
  } catch (error) {
    console.error('admin', error);
    return send(res, 500, { error: errorMessage(error, 'Enregistrement impossible') });
  }
}
