// POST /api/create-payment { packId } (jeton Firebase du joueur dans Authorization)
// Crée le paiement FedaPay du pack choisi et renvoie { url } : la page de paiement (Mobile Money, carte).
// Le prix vient de FRIC_PACKS côté serveur : le jeu ne peut pas choisir son prix.
import { FRIC_PACKS, Transaction, db, playerId, send } from './_lib/server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non permise' });
  const uid = await playerId(req);
  if (!uid) return send(res, 401, { error: 'Joueur non connecté' });
  const pack = FRIC_PACKS.find((p) => p.id === req.body?.packId);
  if (!pack) return send(res, 400, { error: 'Pack inconnu' });

  try {
    // Après le paiement, FedaPay renvoie le joueur dans le jeu (il y ajoute ?id=…&status=…)
    const origin = `https://${req.headers['x-forwarded-host'] ?? req.headers.host}`;
    const transaction = await Transaction.create({
      description: `${pack.fric} Fric - ctnRacer`,
      amount: pack.price,
      currency: { iso: 'XOF' },
      callback_url: `${origin}/?paiement=fedapay`,
      custom_metadata: { uid, packId: pack.id },
    });
    await db.collection('payments').doc(String(transaction.id)).set({
      uid,
      packId: pack.id,
      fric: pack.fric,
      price: pack.price,
      status: transaction.status,
      credited: false,
      createdAt: new Date(),
    });
    const token = await transaction.generateToken();
    return send(res, 200, { url: token.url, id: transaction.id });
  } catch (error) {
    console.error('create-payment', error);
    return send(res, 502, { error: 'Création du paiement impossible' });
  }
}
