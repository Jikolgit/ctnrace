// POST /api/confirm-payment { id } (jeton Firebase du joueur dans Authorization)
// Appelé par le jeu au retour de la page de paiement : vérifie la transaction auprès de FedaPay et crédite les
// Fric si elle est approuvée (même travail que le webhook, au cas où il arrive après le joueur).
import { db, playerId, creditIfApproved, send } from './_lib/server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non permise' });
  const uid = await playerId(req);
  if (!uid) return send(res, 401, { error: 'Joueur non connecté' });
  const id = String(req.body?.id ?? '');
  if (!/^\d+$/.test(id)) return send(res, 400, { error: 'Transaction inconnue' });

  const payment = await db.collection('payments').doc(id).get();
  if (!payment.exists || payment.data().uid !== uid) return send(res, 404, { error: 'Transaction inconnue' });
  try {
    return send(res, 200, await creditIfApproved(id));
  } catch (error) {
    console.error('confirm-payment', error);
    return send(res, 502, { error: 'Vérification impossible' });
  }
}
