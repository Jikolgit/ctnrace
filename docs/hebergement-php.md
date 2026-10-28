# Héberger ctnRacer chez un hébergeur PHP (cPanel, Apache)

Le jeu et ses 5 fonctions serveur (paiements FedaPay, réglages de l'interface admin) existent en deux versions :
- **Vercel** (dossier `api/`, Node.js) : utilisée aujourd'hui sur ctnrace.vercel.app ;
- **PHP** (dossier `php/`) : pour un hébergement web classique. Aucune bibliothèque à installer (ni Composer) :
  il faut seulement **PHP 7.4 ou plus** avec les extensions **curl** et **openssl** (présentes presque partout),
  et un serveur **Apache** (fichier `.htaccess`).

## 1. Construire

```
npm install
npm run build:php
```

Le dossier `dist-php/` contient tout le site : le jeu, la page `/admin`, les fonctions `api/*.php` et le `.htaccess`.

## 2. Envoyer les fichiers

Envoyer **tout le contenu** de `dist-php/` (y compris le fichier caché `.htaccess`) dans le dossier public du site,
en général `public_html/`, avec le gestionnaire de fichiers de cPanel ou un logiciel FTP (FileZilla).

## 3. Les réglages secrets

Ne jamais les mettre sur GitHub ni dans `public_html/` à découvert.

1. Copier `api/lib/ctnrace-config.example.php` sous le nom **`ctnrace-config.php`**.
2. Le placer **au-dessus** de `public_html/` (par exemple `/home/votre-compte/ctnrace-config.php`). Si l'hébergeur ne
   le permet pas : dans `public_html/api/lib/` (dossier fermé aux visiteurs par son `.htaccess`).
3. Y mettre :
   - `FIREBASE_SERVICE_ACCOUNT` : le fichier `.json` de la clé de compte de service Firebase (le même que dans Vercel),
     envoyé à côté de `ctnrace-config.php`, ou son contenu entier ;
   - `FEDAPAY_SECRET_KEY` : la clé secrète FedaPay (`sk_sandbox_…` ou `sk_live_…`) ;
   - facultatif : `ADMIN_USER` et `ADMIN_PASSWORD` pour changer les identifiants de `/admin`.

Si l'hébergeur propose des variables d'environnement, elles passent avant ce fichier (mêmes noms).

## 4. Vérifier

- `https://votre-site/` : le jeu s'ouvre.
- `https://votre-site/admin` : la page de connexion ; se connecter, changer un réglage, Sauvegarder.
- `https://votre-site/api/config` : affiche les réglages (texte JSON).
- `https://votre-site/api/lib/ctnrace-config.php` doit être **refusé** (erreur 403).

En cas d'erreur, le message de la page admin dit quelle étape ne va pas (« Configuration : … ») ; le détail est dans
le journal d'erreurs PHP de l'hébergeur (cPanel → « Errors » ou « Journaux »).

## 5. FedaPay

Dans le tableau de bord FedaPay, remplacer l'adresse du webhook par `https://votre-site/api/fedapay-webhook`.

## Limites

- Serveurs **nginx** sans Apache : le `.htaccess` n'est pas lu ; il faut reproduire ses deux règles (adresses
  `/api/nom` → `api/nom.php`, dossier `api/lib` interdit) dans la configuration du serveur.
- Les deux versions (Vercel et PHP) doivent rester identiques : une modification de la logique serveur se fait dans
  `api/` **et** dans `php/`. Les prix des packs et les réglages par défaut, eux, viennent automatiquement du code du
  jeu (`src/fric.js`, `src/gameSettings.js`) au moment de `npm run build:php`.
