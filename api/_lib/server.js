// Outils communs des fonctions serveur (Vercel) de la Boutique : Firebase Admin, FedaPay, packs de Fric.
// Le dossier commence par « _ » : Vercel n'en fait pas une adresse publique.
//
// Variables d'environnement (réglages Vercel du projet, jamais dans le code) :
//   FIREBASE_SERVICE_ACCOUNT  contenu JSON de la clé de compte de service Firebase
//   FEDAPAY_SECRET_KEY        clé secrète FedaPay (sk_sandbox_… pour les essais, sk_live_… pour les vrais paiements)
//
// Tout est préparé à la première demande (setup), pas au chargement du fichier : une variable mal réglée renvoie
// un message clair (sans jamais afficher les clés) au lieu de faire planter la fonction (FUNCTION_INVOCATION_FAILED).
import { FRIC_PACKS } from '../../src/fric.js';

export { FRIC_PACKS };

let ready = null;

// Erreur de configuration : message affichable (aucune valeur secrète dedans)
class SetupError extends Error {}

async function prepare() {
  // Clé de compte de service Firebase (JSON). Si la clé privée a été collée avec de vrais retours à la ligne au
  // lieu de « \n », on les remet en « \n » avant de lire le JSON.
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim();
  if (!raw) throw new SetupError('Variable FIREBASE_SERVICE_ACCOUNT absente dans Vercel');
  let account;
  try {
    account = JSON.parse(raw);
  } catch {
    try {
      account = JSON.parse(raw.replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----\s*/, (key) =>
        key.replace(/\r?\n/g, '\\n')
      ));
    } catch {
      throw new SetupError("FIREBASE_SERVICE_ACCOUNT n'est pas un JSON valide (copier tout le fichier, de { à })");
    }
  }
  if (!account.private_key || !account.client_email || !account.project_id) {
    throw new SetupError('FIREBASE_SERVICE_ACCOUNT incomplet (private_key, client_email ou project_id manquant)');
  }
  account.private_key = account.private_key.replace(/\\n/g, '\n');

  const secretKey = (process.env.FEDAPAY_SECRET_KEY ?? '').trim();
  if (!/^sk_(sandbox|live)_/.test(secretKey)) {
    throw new SetupError('Variable FEDAPAY_SECRET_KEY absente ou invalide (doit commencer par sk_sandbox_ ou sk_live_)');
  }

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const fedapay = await import('fedapay');
  const { FedaPay, Transaction } = fedapay.FedaPay ? fedapay : fedapay.default; // module CommonJS

  // Firebase Admin : ignore les règles de sécurité (seul le serveur peut écrire le champ fric)
  if (!getApps().length) initializeApp({ credential: cert(account) });
  // FedaPay : environnement d'essai ou réel selon la clé
  FedaPay.setApiKey(secretKey);
  FedaPay.setEnvironment(secretKey.startsWith('sk_live_') ? 'live' : 'sandbox');
  return { auth: getAuth(), db: getFirestore(), FieldValue, Transaction };
}

// Outils prêts : { auth, db, FieldValue, Transaction } (préparés une fois, gardés entre les demandes)
export function setup() {
  ready ??= prepare().catch((error) => {
    ready = null; // nouvel essai à la prochaine demande
    throw error;
  });
  return ready;
}

// Message à renvoyer pour une erreur : clair pour une erreur de configuration, générique sinon
export function errorMessage(error, fallback) {
  return error instanceof SetupError ? `Configuration : ${error.message}` : fallback;
}

// Joueur qui appelle : jeton Firebase envoyé par le jeu (en-tête Authorization: Bearer …)
export async function playerId(req) {
  const { auth } = await setup();
  const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  if (!match) return null;
  try {
    return (await auth.verifyIdToken(match[1])).uid;
  } catch {
    return null;
  }
}

// Paiement approuvé chez FedaPay → Fric ajoutés au joueur, une seule fois par transaction (fiche payments/{id},
// créée par create-payment avec le joueur et le pack). Renvoie l'état de la transaction et si elle est créditée.
export async function creditIfApproved(transactionId) {
  const { db, FieldValue, Transaction } = await setup();
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
