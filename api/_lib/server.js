// Outils communs des fonctions serveur (Vercel) de la Boutique : Firebase Admin, FedaPay, packs de Fric.
// Le dossier commence par « _ » : Vercel n'en fait pas une adresse publique.
//
// Variables d'environnement (réglages Vercel du projet, jamais dans le code) :
//   FIREBASE_SERVICE_ACCOUNT  contenu JSON de la clé de compte de service Firebase
//   FEDAPAY_SECRET_KEY        clé secrète FedaPay (sk_sandbox_… pour les essais, sk_live_… pour les vrais paiements)
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FedaPay, Transaction } from 'fedapay';
import { FRIC_PACKS } from '../../src/fric.js';

export { FRIC_PACKS, Transaction };

// Firebase Admin : ignore les règles de sécurité (seul le serveur peut écrire le champ fric)
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
export const db = getFirestore();

// FedaPay : environnement d'essai ou réel selon la clé
const secretKey = process.env.FEDAPAY_SECRET_KEY ?? '';
FedaPay.setApiKey(secretKey);
FedaPay.setEnvironment(secretKey.startsWith('sk_live_') ? 'live' : 'sandbox');

// Joueur qui appelle : jeton Firebase envoyé par le jeu (en-tête Authorization: Bearer …)
export async function playerId(req) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  if (!match) return null;
  try {
    return (await getAuth().verifyIdToken(match[1])).uid;
  } catch {
    return null;
  }
}

// Paiement approuvé chez FedaPay → Fric ajoutés au joueur, une seule fois par transaction (fiche payments/{id},
// créée par create-payment avec le joueur et le pack). Renvoie l'état de la transaction et si elle est créditée.
export async function creditIfApproved(transactionId) {
  const paymentRef = db.collection('payments').doc(String(transactionId));
  if (!(await paymentRef.get()).exists) return { status: 'unknown', credited: false }; // pas créée par le jeu
  const transaction = await Transaction.retrieve(transactionId); // état réel, demandé à FedaPay
  const status = transaction.status;
  if (status !== 'approved') {
    await paymentRef.set({ status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { status, credited: false };
  }
  return db.runTransaction(async (tx) => {
    const payment = await tx.get(paymentRef);
    if (!payment.exists) return { status, credited: false }; // transaction inconnue du jeu
    const { uid, fric, credited, price } = payment.data();
    if (credited) return { status, credited: true, fric }; // déjà créditée (webhook + retour du joueur)
    if (transaction.amount !== price) return { status, credited: false }; // montant inattendu : rien
    tx.set(db.collection('players').doc(uid), { fric: FieldValue.increment(fric) }, { merge: true });
    tx.update(paymentRef, { status, credited: true, creditedAt: FieldValue.serverTimestamp() });
    return { status, credited: true, fric };
  });
}

// Réponse JSON
export function send(res, code, body) {
  res.status(code).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}
