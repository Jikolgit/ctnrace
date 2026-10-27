// POST /api/fedapay-webhook : FedaPay prévient le serveur quand une transaction change d'état
// (transaction.approved, transaction.canceled…). On ne croit pas le contenu reçu : on redemande l'état de la
// transaction à FedaPay avec la clé secrète, puis on crédite les Fric si elle est approuvée (une seule fois).
import { creditIfApproved, send } from './_lib/server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non permise' });
  const event = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
  const id = event.entity?.id ?? event.data?.object?.id ?? event.object_id;
  if (!id) return send(res, 200, { ignored: true }); // pas une transaction
  try {
    return send(res, 200, await creditIfApproved(id));
  } catch (error) {
    console.error('fedapay-webhook', error);
    return send(res, 500, { error: 'Traitement impossible' }); // FedaPay réessaiera
  }
}
