# Idées de gameplay — ctnRacer

Idées proposées par l'utilisateur, notées au fil des conversations. Elles ne sont pas encore implémentées,
sauf mention contraire (« ✅ fait »).

## Idées

### Location de motos

- Ajouter un **système de location de motos** pour permettre aux joueurs qui n'ont pas assez d'argent pour acheter
  une moto de pouvoir tout de même l'utiliser.
- Exemple de tarification :
  - **Achat permanent** d'une moto : 300 000 FCFA.
  - **Location pour une journée** : 25 000 FCFA.
- Le joueur peut donc choisir entre acheter définitivement une moto ou la louer temporairement pour une journée.
- La location doit être une alternative à l'achat, et non remplacer le système d'achat.
- À préciser : durée exacte d'une journée (temps réel ou temps de jeu), moment où commence la location, comportement
  à son expiration (retour automatique à la moto précédente ou à une moto de base), possibilité de renouveler
  une location, motos concernées, prix selon le modèle, et éventuelle gestion des locations dans l'interface admin.

### Mission d'urgence (à implémenter plus tard)

- Mission de dernière minute qui survient **quand toutes les livraisons d'un niveau sont terminées** : par
  exemple, une dernière commande vient d'arriver et il faut la livrer.
- Le joueur peut **l'accepter ou la refuser**.
- Rien n'est encore décidé sur la suite (récompense, délai, ce qui se passe en cas de refus ou d'échec).

### Casque : vie supplémentaire

- Aujourd'hui, percuter un véhicule = Game Over.
- Idée : un **item casque** posé sur la route ; le ramasser (en roulant dessus) donne **+1 vie**.
- Avec une vie en réserve, percuter un véhicule fait seulement **perdre 1 vie** au lieu du Game Over.
- **Après un accident avec un casque** (par exemple on cogne un véhicule), on **ne reprend pas immédiatement la
  route** : la moto se retrouve d'abord **sur le côté, sur le trottoir**, et ensuite le joueur peut **remonter sur
  la route**. (Le jeu a déjà ce principe au départ d'une partie : la moto est garée sur le trottoir et le joueur
  appuie sur un bouton de direction pour rejoindre la route : à voir si on peut le réutiliser.)
- À préciser : modes concernés (Défis, Livraison ou les deux), nombre maximum de vies, fréquence des casques,
  de quel côté la moto est posée (le trottoir le plus proche ?), ce que devient le véhicule percuté (retiré,
  immobile…), ce qu'on garde après le choc (produits chargés, temps de la mission, essence), si on perd du temps ou
  des points, si l'effet d'un item de vitesse s'arrête, comment le joueur repart (même bouton qu'au départ ?),
  courte invincibilité au retour sur la route, affichage des vies.

### Rues bloquées selon l'heure

- Au-delà d'une certaine heure, **certaines rues sont bloquées** (travaux ou autre cause) : il faut faire un
  détour.
- **L'heure du jeu est celle du Bénin** (heure réelle, fuseau `Africa/Porto-Novo`, UTC+1, sans heure d'été),
  quelle que soit l'heure de l'appareil du joueur.
- À préciser : quelles rues, à partir de quelle heure (et jusqu'à quand), comment le blocage est montré
  (barrières, cônes, panneau, sur la mini-carte), mode concerné (Livraison a priori), effet sur la ligne de
  guidage (chemin recalculé en évitant les rues bloquées).

### Monnaie virtuelle et achats (FedaPay)

- Une **monnaie virtuelle** dans le jeu, qui sert à **acheter de nouvelles motos**.
- Deux façons de l'obtenir :
  - **la trouver en ville pendant les courses** (à ramasser, comme les bidons) ;
  - **l'acheter avec de l'argent réel**, paiement géré par **FedaPay** (Mobile Money, cartes ; compte de
    l'utilisateur : « travailleur indépendant »).
- À préciser : lien avec l'argent actuel du mode Livraison (les « $ » gagnés en livrant : même monnaie ou deux
  monnaies distinctes ?), prix des motos et des packs, quantité trouvée en ville, modes concernés.
- Contraintes techniques notées : un serveur est nécessaire (clé secrète FedaPay hors du jeu, confirmation des
  paiements par webhook), des comptes joueurs et une base de données (les achats ne peuvent pas rester dans le
  navigateur, comme l'argent actuel en localStorage).

### Missions de filature : suivre un véhicule

- Certaines missions demanderont de **suivre un véhicule**, parce qu'on **ne connaît pas la destination** : c'est
  le véhicule qui y mène.
- À préciser : ce qui fait échouer la mission (véhicule perdu de vue, trop loin, trop près, collision), si le
  véhicule roule plus vite ou fait des détours, ce qu'on fait à l'arrivée (livrer, récupérer un colis…),
  ligne de guidage absente pendant la filature.

### Boîtes de récompense aléatoire (gacha)

- Un **système de récompenses aléatoires (gacha)** : des **boîtes à ramasser pendant les livraisons** (en roulant
  dessus, comme les bidons d'essence) ; chaque boîte donne une récompense tirée au hasard.
- À préciser : contenu possible des boîtes (Fric, essence, motos ou pièces de moto, objets cosmétiques…) et
  chances de chaque récompense (raretés), ouverture tout de suite ou plus tard (dans le menu, avec une animation),
  nombre de boîtes par mission et emplacements (fixes ou au hasard), boîtes achetables en Fric ou non, réglages
  dans l'interface admin.
- À garder en tête : si des boîtes s'achètent avec de l'argent réel, certains pays et magasins d'applications
  demandent d'**afficher les chances** de chaque récompense.

### Items de vitesse : accélération temporaire

- Des **items à ramasser dans la ville** (en roulant dessus, comme les bidons d'essence) qui **augmentent
  temporairement la vitesse** de la moto.
- À préciser : modes concernés (Livraison, Défis ou les deux), durée de l'effet et de combien la vitesse augmente
  (aujourd'hui la vitesse maximale est d'environ 43 km/h et le compteur de vitesse va jusqu'à 60 km/h), ce que
  devient la vitesse à la fin (retour progressif ou brusque), apparence de l'item, nombre d'items par mission et
  emplacements (fixes ou au hasard), affichage de l'effet en cours (compte à rebours, jauge, effet visuel sur la
  moto), cumul de plusieurs items (prolonge la durée ou non), effet sur la conduite (virages plus difficiles à
  grande vitesse : la fenêtre de virage est déjà courte sur mobile), réglages dans l'interface admin (durée,
  vitesse gagnée).
