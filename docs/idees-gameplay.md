# Idées de gameplay — ctnRacer

Idées proposées par l'utilisateur, notées au fil des conversations. Elles ne sont pas encore implémentées,
sauf mention contraire (« ✅ fait »).

## Idées

### Mission d'urgence (à implémenter plus tard)

- Mission de dernière minute qui survient **quand toutes les livraisons d'un niveau sont terminées** : par
  exemple, une dernière commande vient d'arriver et il faut la livrer.
- Le joueur peut **l'accepter ou la refuser**.
- Rien n'est encore décidé sur la suite (récompense, délai, ce qui se passe en cas de refus ou d'échec).

### Casque : vie supplémentaire

- Aujourd'hui, percuter un véhicule = Game Over.
- Idée : un **item casque** posé sur la route ; le ramasser (en roulant dessus) donne **+1 vie**.
- Avec une vie en réserve, percuter un véhicule fait seulement **perdre 1 vie** au lieu du Game Over.
- À préciser : modes concernés (Défis, Livraison ou les deux), nombre maximum de vies, fréquence des casques,
  ce qui se passe juste après le choc (voiture retirée, moto ralentie, courte invincibilité…), affichage des vies.

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
