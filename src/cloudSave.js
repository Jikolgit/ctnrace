import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  GoogleAuthProvider,
  linkWithPopup,
  signInWithCredential,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore/lite'; // version légère : lecture / écriture simples, sans temps réel
import { SAVE_KEYS, SAVE_EVENT, localSavedAt, setLocalSavedAt } from './saveQueue.js';

// Sauvegarde des joueurs dans Firebase (projet ctnracer-5a420) : chaque joueur reçoit automatiquement un compte
// anonyme (rien à remplir), qu'il peut lier à son compte Google (linkGoogle) pour retrouver sa sauvegarde sur un
// autre appareil ; sa sauvegarde est le document players/{uid} de Firestore :
//   { unlockedMission, bike, money, savedAt (ms), updatedAt (date du serveur) }
// Le jeu continue de lire et d'écrire dans localStorage (immédiat, marche hors ligne) ; ce module recopie ces
// données dans Firestore à chaque changement (regroupés pendant SAVE_DELAY) et, au démarrage, reprend la
// sauvegarde du serveur si elle est plus récente que celle du navigateur. Sans réseau ou si Firebase refuse,
// le jeu marche comme avant (localStorage seul).
//
// Ces valeurs ne sont pas secrètes (elles sont dans le code de toute page Firebase) : les données sont protégées
// par les règles de sécurité de Firestore (docs/firestore.rules).
const firebaseConfig = {
  apiKey: 'AIzaSyAQSqvvB3OIB4UPToIxysfzPWm43NQeovE',
  authDomain: 'ctnracer-5a420.firebaseapp.com',
  projectId: 'ctnracer-5a420',
  storageBucket: 'ctnracer-5a420.firebasestorage.app',
  messagingSenderId: '841910822033',
  appId: '1:841910822033:web:abc037ddf8c5262c144b30',
};

const SAVE_DELAY = 1500; // ms : plusieurs changements rapprochés = une seule écriture

const readLocal = () => {
  const get = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  return {
    unlockedMission: parseInt(get(SAVE_KEYS.unlockedMission), 10) || 1,
    bike: get(SAVE_KEYS.bike),
    money: parseInt(get(SAVE_KEYS.money), 10) || 0,
  };
};

// Compte du joueur pour l'affichage : anonyme, ou lié à Google (adresse, nom, photo)
const accountInfo = (user) => {
  const google = user?.providerData.find((p) => p.providerId === 'google.com');
  return google
    ? { linked: true, email: google.email ?? user.email, name: google.displayName ?? '', photo: google.photoURL ?? '' }
    : { linked: false };
};

// onRestore(data) : appelé quand la sauvegarde du serveur remplace celle du navigateur (le jeu met à jour
// l'argent affiché, la moto…) ; onFric(solde) : solde de Fric de la fiche (écrit seulement par le serveur) ;
// onAccount(info) : compte anonyme ou lié à Google (accountInfo)
export function startCloudSave(onRestore, onFric, onAccount) {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let playerDoc = null;
  let timer = 0;
  let preferCloud = false; // compte Google déjà utilisé ailleurs : sa sauvegarde remplace celle du navigateur
  let fric = 0; // solde du compte en cours (pour prévenir avant de quitter un compte anonyme qui a des Fric)
  const setFric = (value) => {
    fric = value;
    onFric(value);
  };

  // Relit le solde de Fric (après un achat : le serveur l'a modifié)
  async function reloadFric() {
    if (!playerDoc) return;
    try {
      setFric((await getDoc(playerDoc)).data()?.fric ?? 0);
    } catch (error) {
      console.warn('Lecture du solde de Fric impossible', error.code ?? error);
    }
  }

  // Jeton d'identité du joueur, pour les fonctions serveur (achats) ; attend la connexion (10 s au plus)
  const userReady = new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      stop();
      resolve(user);
    });
  });
  async function idToken() {
    // compte en cours (il change si le joueur se connecte à un compte Google déjà utilisé ailleurs)
    const user =
      auth.currentUser ?? (await Promise.race([userReady, new Promise((resolve) => setTimeout(resolve, 10000, null))]));
    return user ? user.getIdToken() : null;
  }

  async function upload() {
    timer = 0;
    if (!playerDoc) return;
    const data = readLocal();
    try {
      await setDoc(playerDoc, { ...data, savedAt: localSavedAt(), updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.warn('Sauvegarde Firebase impossible', error.code ?? error);
    }
  }

  function schedule() {
    if (!timer) timer = setTimeout(upload, SAVE_DELAY);
  }

  window.addEventListener(SAVE_EVENT, schedule);
  // Onglet caché ou fermé : on envoie tout de suite ce qui attend
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer);
      upload();
    }
  });

  // Compte anonyme gardé par le navigateur : créé à la première visite, retrouvé ensuite
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      signInAnonymously(auth).catch((error) => console.warn('Connexion Firebase impossible', error.code ?? error));
      return;
    }
    playerDoc = doc(db, 'players', user.uid);
    onAccount(accountInfo(user));
    const forced = preferCloud;
    preferCloud = false;
    try {
      const snapshot = await getDoc(playerDoc);
      const cloud = snapshot.exists() ? snapshot.data() : null;
      setFric(cloud?.fric ?? 0);
      if (cloud && (forced || (cloud.savedAt ?? 0) > localSavedAt())) {
        // Sauvegarde du serveur plus récente : elle remplace celle du navigateur (mission débloquée : la plus avancée)
        const local = readLocal();
        const restored = {
          unlockedMission: Math.max(local.unlockedMission, cloud.unlockedMission ?? 1),
          bike: cloud.bike ?? local.bike,
          money: cloud.money ?? local.money,
        };
        try {
          localStorage.setItem(SAVE_KEYS.unlockedMission, String(restored.unlockedMission));
          if (restored.bike) localStorage.setItem(SAVE_KEYS.bike, restored.bike);
          localStorage.setItem(SAVE_KEYS.money, String(restored.money));
        } catch {
          // stockage indisponible : le jeu utilisera quand même les valeurs restaurées
        }
        setLocalSavedAt(cloud.savedAt ?? Date.now());
        onRestore(restored);
      } else {
        // Première connexion (on reprend ce qui était dans le navigateur) ou navigateur plus récent
        upload();
      }
    } catch (error) {
      console.warn('Lecture de la sauvegarde Firebase impossible', error.code ?? error);
    }
  });

  // Liaison du compte à Google (fenêtre de connexion Google) : le compte anonyme devient un compte Google, avec
  // le même identifiant, donc la même sauvegarde et les mêmes Fric, retrouvables sur un autre appareil.
  // confirmSwitch(fricPerdus) : si ce compte Google a déjà une sauvegarde (autre appareil), demande au joueur
  // s'il veut la charger à la place de celle de cet appareil. Renvoie 'linked', 'switched' ou 'cancelled' ;
  // lève une erreur Firebase (error.code) sinon.
  async function linkGoogle(confirmSwitch) {
    const user = auth.currentUser;
    if (!user) throw Object.assign(new Error('Pas encore connecté'), { code: 'not-ready' });
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await linkWithPopup(user, provider);
      await upload(); // la fiche porte le même identifiant : rien à déplacer, on envoie juste l'état actuel
      onAccount(accountInfo(result.user));
      return 'linked';
    } catch (error) {
      if (error.code !== 'auth/credential-already-in-use') throw error;
      // Ce compte Google a déjà un compte de jeu : on s'y connecte (le compte anonyme reste sur le serveur)
      const credential = GoogleAuthProvider.credentialFromError(error);
      if (!credential || !confirmSwitch(fric)) return 'cancelled';
      clearTimeout(timer);
      timer = 0;
      preferCloud = true;
      playerDoc = null; // pas d'envoi vers l'ancien compte pendant le changement
      await signInWithCredential(auth, credential); // onAuthStateChanged charge sa sauvegarde
      return 'switched';
    }
  }

  return { idToken, reloadFric, linkGoogle };
}
