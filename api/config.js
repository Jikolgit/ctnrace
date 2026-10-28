// GET /api/config : réglages du jeu choisis dans l'interface admin (document Firestore config/game), lus par le jeu
// au lancement (src/settings.js). Public, en lecture seule ; rien de secret dedans.
import { firebase, send } from './_lib/server.js';
import { cleanSettings } from '../src/gameSettings.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Méthode non permise' });
  res.setHeader('Cache-Control', 'no-store'); // un changement dans l'admin compte dès la partie suivante
  try {
    const { db } = await firebase();
    const doc = await db.collection('config').doc('game').get();
    return send(res, 200, cleanSettings(doc.data()));
  } catch (error) {
    console.error('config', error);
    return send(res, 500, { error: 'Réglages indisponibles' }); // le jeu garde ses réglages par défaut
  }
}
