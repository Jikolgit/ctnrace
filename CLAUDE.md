# ctnRacer — runner infini 3D en moto

Jeu web en moto dans une ville, jouable au clavier et sur mobile (boutons tactiles). Deux modes, choisis dans le menu principal :
- **Défis** : route infinie à 3 couloirs, faite de rues droites reliées par des carrefours (virages à 90°, en L ou en T). Le joueur change de couloir pour éviter des voitures et choisit le virage à chaque carrefour. Percuter une voiture ou le mur au bout d'une rue = Game Over.
- **Livraison** : ville fixe inspirée de Cotonou (Ségbeya / Kpondehou), sans voitures ; missions de livraison (chargement, points de livraison), essence à gérer, code de la route (on roule à droite). Voir « Menu et modes de jeu ».

**Langue : l'utilisateur travaille en français. Réponds en français, commente le code en français.**

## Façon de travailler avec l'utilisateur

- Il pose souvent des questions avant de faire coder : ne code que lorsqu'il le demande.
- Il donne des images de référence et juge le résultat visuellement : décris précisément ce que tu as changé et ce qui reste différent.
- Quand il annule une modification (Ctrl+Z) ou dit « ce n'est pas bon », repars de l'état actuel des fichiers, pas de ta version précédente.
- Ne modifie que ce qu'il demande ; signale les effets de bord au lieu de les corriger en silence.

## Stack et commandes

- HTML / CSS / JavaScript (modules ES), **Three.js 0.186**, **Vite 8**, Node 22.
- `npm install` puis :
  - `npm run dev` : serveur de développement (http://localhost:5173)
  - `npm run build` : build de production dans `dist/` — **à lancer après chaque modification** pour vérifier que le code compile (il n'y a pas de tests).
- Pas de moteur physique : collisions par boîtes alignées sur les axes.

## Arborescence

```
index.html          canvas #game, HUD (#hud/#distance), bouton #pause, flèches #arrow-left/#arrow-right/#arrow-uturn (span.turn-arrow : image grise + image couleur), boutons tactiles #left/#right,
                    panneau #gameover (#final-distance, #restart)
src/main.js         scène, caméra, lumières, brouillard, chargement du GLB, joueur, motos, pilote, entrées clavier,
                    changement de couloir (inclinaison + pivot de l'avant), pause, game over, boucle de jeu
src/track.js        parcours : rues droites reliées par des carrefours en L ou en T, virage choisi par le joueur, pose(s, décalage)
src/road.js         tronçons de route (3 couloirs + trottoirs) et carrefours posés le long du parcours, shader des pavés
src/city.js         bâtiments (boîtes) le long des rues, angles de rue et « mur » au bout de chaque rue ; sol uni
public/arrow.png    flèche de virage (pointe à droite ; retournée en CSS pour la gauche), fond rendu transparent
public/arrow-uturn.svg  flèche de demi-tour en U (même style : jaune, contour noir, épaisseur orange ; modèle donné par l'utilisateur), toujours dessinée vers la droite
src/obstacles.js    voitures obstacles : pool de clones de car_1, repérées sur le parcours (s, couloir), collision
src/toon.js         effet cartoon des motos : toToon(material) (MeshToonMaterial, 3 paliers) et addOutline(mesh)
                    (contour noir « inverted hull », normales lissées) ; le pilote n'est pas concerné
src/deliveryMap.js  mode Livraison : données du réseau de rues (inspiré de Ségbeya / Kpondehou, Cotonou), lieux, quartiers
src/network.js      mode Livraison : graphe du réseau (carrefours, bras) et parcours du joueur (même interface que track.js)
src/deliveryCity.js mode Livraison : ville fixe construite une fois (goudron, pavés, trottoirs et bâtiments en InstancedMesh)
src/minimap.js      mode Livraison : mini-carte (canvas #minimap, coin inférieur gauche) : plan, lieux, flèche du joueur
src/fuelCans.js     mode Livraison : bidons d'essence (sprites public/jerrycan.png), ramassés en roulant dessus
src/missions.js     mode Livraison : nombre de missions et progression (localStorage), completeMission(n)
src/cameraTuner.js  réglage de la caméra en jeu (adresse avec ?camera) : curseurs x/y/z + regard, coordonnées affichées
src/traffic.js      mode Livraison : circulation (20 voitures sur le réseau, virages, priorité aux carrefours), hits()
src/garage.js       écran « Moto » du menu : aperçu 3D qui tourne (renderer à part, canvas #garage-preview), cartes de choix, moto gardée (localStorage `ctnrace-bike`)
src/wallet.js       mode Livraison : argent du joueur (localStorage `ctnrace-money`), DELIVERY_REWARD, FUEL_PRICE, addMoney
tools/drawDeliveryMap.mjs  dessine le plan du réseau dans docs/reseau-livraison.svg (node tools/drawDeliveryMap.mjs)
src/smoke.js        fumée d'échappement : pool de sprites (dans la scène, pas dans `world` : repère de la caméra)
src/worldBend.js    effet de courbure du monde (vertex shader) : applyWorldBend(material), bendUniforms
src/atlas.js        texture partagée bikeTXT.jpg + position des pavés dans l'atlas
src/style.css       HUD, bouton pause, flèches de virage (grises, remplies de couleur pendant l'appui), boutons tactiles (écrans tactiles seulement), écran Game Over
public/models.glb   tous les modèles 3D (voir plus bas)
public/bikeTXT.jpg  atlas de textures unique (voir plus bas)
public/smoketxt.png texture de la fumée (fichier en minuscules, attention à la casse)
public/motolowpoly.glb  modèle de moto ajouté par l'utilisateur, NON utilisé pour l'instant
*.blend (racine)    fichiers Blender sources (non utilisés par le jeu)
```

## Principes d'architecture (à respecter)

- **Le joueur reste en (0, 0, 0), face à -Z ; c'est le monde qui bouge.** Route, bâtiments et voitures sont des enfants du groupe `world`, posés une fois pour toutes le long du parcours (`track.js`). À chaque image, `placeWorld()` déplace et tourne `world` pour amener le point du parcours où est le joueur (`playerS`) en 0. Dans les virages à 90°, c'est donc la ville qui pivote.
- **Parcours** : position = distance `s` le long de la ligne médiane. Une rue (`leg`) va du centre d'un carrefour au suivant (4 à 9 tronçons de 20 m + 6 m), puis tourne ; dans le carrefour, la ligne médiane suit un quart de cercle de rayon 3 centré sur le coin intérieur (chaque couloir garde sa place). Carrefour en L (`options` = [-1] ou [+1], jamais 3 L du même côté d'affilée) ou en T (`options` = [-1, +1], 40 %). Les rues qui partent du prochain carrefour (« branches ») sont créées à l'avance ; `track.choose(dir)` garde la branche prise, puis crée les branches du carrefour suivant ; la branche non choisie reste affichée jusqu’à `DISCARD_DELAY` (25 m) après le virage, pour disparaître hors caméra. Rues retirées 40 m après leur virage (contenu rendu aux pools).
- **Virage commandé** : dans les `TURN_WINDOW` (15) derniers mètres avant le carrefour, **gauche/droite (ou ↓ pour le demi-tour) maintenus `TURN_HOLD` 0,5 s confirment le virage** (vibration `TURN_CONFIRM_VIBRATION`). **Les flèches de virage sont grises** (choix de l'utilisateur, plus de clignotement ; essayé avant : invisibles, puis silhouette pâle) : chaque flèche (`#arrow-left` / `#arrow-right` / `#arrow-uturn`, `span.turn-arrow`) superpose une image grise (`.base`, `filter: grayscale`) et l'image en couleur (`.fill`) ; pendant l'appui, la couleur **se découvre de la queue vers la pointe** (masque CSS `linear-gradient` sur `.fill`, variable `--hold` 0 → 1 mise à jour à chaque image dans `updateArrows`, `HOLD_ARROWS`), pleine quand le virage est pris. (Essayé puis retiré : cercle autour du bouton tactile, flèche qui grossit.) ; **un appui bref (relâché avant 0,5 s) change de couloir** comme ailleurs, au relâchement (choix de l'utilisateur, pour pouvoir encore changer de couloir près d'un carrefour). Un appui encore maintenu à l'entrée du carrefour prend le virage. Code : `pressDirection` / `releaseDirection` / `updateTurnHold` (`turnHold`), `steer` ne fait plus que le départ du trottoir et le changement de couloir. Vers une direction impossible : changement de couloir immédiat. Sans choix à l'entrée du carrefour : `turn = 0`, la moto continue tout droit et percute le mur (`WALL_HIT`) → Game Over.
- Le « mur » au bout de chaque rue (bâtiments hauts sur ±14,5 m) appartient à la rue d'arrivée ; les rangées des rues suivantes commencent après lui.
- La caméra tourne avec un léger retard dans les virages (`CAMERA_TURN_DAMPING`) ; la moto se penche (`TURN_LEAN` 30°). Ondulation de la route (courbure du monde, `updateRoadWave`) : ligne droite de 50 à 80 m, puis ondulation d'un seul côté (au hasard) sur 60 à 100 m, puis ligne droite, etc. ; toujours coupée à l'approche des carrefours (`bendFade`).
- **Pooling partout** : tronçons de route, voitures, sprites de fumée sont créés une fois puis recyclés. Ne pas créer d'objets ni de `new Vector3()` dans la boucle de jeu.
- **World bending** : tout matériau visible dans le décor doit passer par `applyWorldBend(material)`, sinon il ne suit pas les virages. Si un matériau a déjà un `onBeforeCompile`, l'enchaîner (voir `road.js`).
- **Brouillard** (`FOG_NEAR` 30, `FOG_FAR` 85, couleur du ciel `0x87ceeb`) : cache l'apparition des voitures (au plus `SPAWN_AHEAD` = 90 m devant) et des rues créées à l'avance (branches du carrefour suivant). Garder `FOG_FAR` < ~90.
- `delta` est plafonné à 0,1 s ; le temps vient de `THREE.Timer` (pas `THREE.Clock`, déprécié).

## Menu et modes de jeu (src/main.js)

- Menu principal (`#menu`, classe `in-menu` sur `body`) au lancement et via le bouton **Menu** du Game Over ou du panneau Pause (`#pause-menu` : Reprendre / Menu principal). Le bouton Livraison ouvre l'écran Missions (`#missions`, classe `in-missions`) : grille de `MISSION_COUNT` (5) cartes, seules les missions débloquées sont jouables ; une mission terminée (tous les produits livrés) appelle `completeMission(n)` et débloque la suivante. Contenu des missions : tableau `MISSIONS` dans `missions.js` (`missionData`) : mission 1 = introduction (2 produits déjà chargés, pas de chargement) ; mission 2 = chargement au Marché Dantokpa puis 3 livraisons ; mission 3 = 4 produits (Entrepôt Ségbeya), donc 2 passages au chargement ; **mission 4 pas encore écrite** (reprend la mission 1) ; mission 5 = 1 produit (Marché Dantokpa → Akpakpa) en `timeLimit` 120 s. Règle de l'utilisateur : à partir de la mission 2, toujours un chargement avant de livrer, et **point de départ aléatoire** (pas encore fait : départ fixe pour toutes les missions). `startGame(mode)` : `'challenge'` (Défis) ou `'delivery'` (Livraison).
- Bouton **Moto** (`#mode-bike`, sous les cartes des modes) : ouvre l'écran `#garage` (classe `in-garage`) : aperçu 3D de la moto choisie qui tourne, une carte par moto (`BIKE_CARDS` dans main.js : nom affiché + description), choix appliqué tout de suite (`selectBike`) et gardé d'une partie à l'autre (`savedBike` / `saveBike`, garage.js). La touche M enregistre aussi son choix.
- `world` contient deux décors : `challengeWorld` (ville infinie de track.js, voitures) et `deliveryWorld` (ville fixe de deliveryCity.js, construite au premier lancement). `activeTrack` = `track` ou `network`.
- **Livraison** : réseau de `deliveryMap.js` (repère carte : x → X, y vers le sud → Z). Petites rues pavées à 3 couloirs, grandes routes goudronnées à 4 couloirs avec terre-plein, ruelles à 2 couloirs (type `alley`, texture de petits pavés dessinée en canvas dans deliveryCity.js ; raccourcis tracés par l'utilisateur sur le plan) ; la moto se replace dans le couloir autorisé le plus proche en changeant de rue. Aux carrefours en croix, sans choix la moto va tout droit ; en T ou en L, elle va dans le mur (Game Over). Les bras qui mènent à une impasse (bord de carte) ne sont jamais proposés. Rayon de virage = demi-largeur de la plus large rue du carrefour. Départ : Rue 1451 × Route de l'Ouémé, vers le nord. L'angle des rues (theta) continue celui de la rue précédente (± 90°), jamais recalculé depuis la direction : sinon la caméra fait un tour autour de la moto. Pas d'ondulation de la route ; pas d'eau (la côte du plan n'est pas modélisée).
- **Départ à l'arrêt (les deux modes)** : la moto attend sur le trottoir de droite (`started = false`, indication `#start-hint`) ; ← la fait descendre dans le couloir de droite et elle accélère (`ACCELERATION` 6 m/s²). Indices de couloir hors route = trottoirs (`laneTarget`).
- **Livraisons (src/deliveryPoints.js, missions.js)** : chaque mission liste ses points (`road`, `at`, `side`) ; mission 1 : 3 produits (Ferrari Lounge, Hôtel Mavilla, Résidence Royale). À partir de la mission 2, un point de **chargement** (`pickup`, flèche verte) : compteur à 0, on y monte sur le trottoir 2 s (« Chargement en cours »), puis les points de livraison apparaissent ; mission 2 : chargement au Marché Dantokpa, livraisons Nora Hôtel, Boutique Kpondehou, Akpakpa. Caméra en portrait (téléphone) : `CAMERA_FOLLOW_PORTRAIT`, `CAMERA_LOOK_FOLLOW_PORTRAIT`. Compteur `#cargo` au-dessus de la jauge d'essence. Flèche orange vers le bas + cercle au sol dans le couloir qui longe le trottoir ; rouler dessus (dans n'importe quel sens) → freinage `DELIVERY_BRAKE`, la moto monte sur le trottoir le plus proche, jauge « Livraison en cours » de `UNLOAD_TIME` 2 s, puis ←/→ pour repartir. Tous livrés → panneau `#mission-complete`, `completeMission(n)`. Points restants affichés sur la mini-carte. Plan avec les points : `node tools/drawDeliveryMap.mjs` (SVG) ; le PNG se rend avec Edge sans écran (`msedge --headless=new --screenshot`).
- **Stations essence (src/stations.js, `STATIONS` dans deliveryMap.js)** : modèle `StationEssence` du GLB (texture atlas, façade = Blender -Y = +Z), 2 stations sur des rues pavées (Station Ségbeya, Rue 1254 ; Station Senade, Rue 1614), parcelle de 20 m sans bâtiments. Point d'arrêt bleu (sorte `'fuel'`) : la moto monte sur le trottoir, plein progressif jusqu'à 100 en `REFUEL_TIME` 3 s (« Plein en cours »). La flèche de la station utilisée est cachée jusqu'à `STATION_REARM_DISTANCE` 20 m. Stations en bleu sur la mini-carte.
- **Carte** : `#minimap` n'est plus affichée pendant la conduite, seulement dans le panneau Pause (Livraison).
- **Ligne de guidage (src/guide.js)** : missions 1 à `GUIDE_MISSIONS` (2), ruban bleu clair sur le couloir de droite, de la moto jusqu'à l'objectif le plus proche (chargement, puis livraisons restantes) ; chemin le plus court (Dijkstra sur carrefour + direction d'arrivée, demi-tour seulement aux carrefours où il est permis), recalculé quand la moto change de rue (`network.aheadLeg`) ou quand les objectifs changent (`refreshGuide()`). **La ligne est fixe sur la route** (choix de l'utilisateur) : elle reste dans le couloir de droite quels que soient les changements de couloir de la moto, commence juste devant la roue avant (`START_AHEAD` 1,3 m devant le centre de la moto) et raccourcit à mesure qu'on avance, jusqu'à l'objectif ; elle suit les couloirs de carrefour en carrefour, seul le dernier segment va jusqu'au point de l'objectif. Le chemin (`buildPath`) n'est recalculé qu'au changement de rue ou d'objectifs ; le ruban (`buildRibbon(trim)`) est recoupé à chaque image. **Rendu en chevrons qui défilent** (inspiré de Bugs.io, choix de l'utilisateur) : ruban de `LINE_WIDTH` 0,9 m, attribut `lineCoord` (x en travers -1..1, y = distance le long du chemin, liée à la route), chevrons en V dessinés dans le fragment shader (`CHEVRON_SPACING` 1,1 m, `CHEVRON_THICKNESS`, `CHEVRON_ANGLE`, cyan `COLOR` + liseré clair `EDGE_COLOR`, transparent entre les chevrons), qui glissent vers l'objectif à `SCROLL_SPEED` 1,6 m/s (`guide.update(track, s, gameTime)`). Bug corrigé (octobre 2026) : pendant la traversée d'un carrefour, la distance parcourue dans la rue suivante est négative ; `targetOnArm` renvoie -1 pour « pas sur cette rue », à tester explicitement (`u >= 0`), sinon la ligne pointait droit sur l'objectif.
- **Circulation (src/traffic.js)** : `CAR_COUNT` 20 clones de car_1 dans `deliveryWorld` (repère de la carte), à `CRUISE_SPEED` 7 m/s, dans le couloir le plus à droite de leur sens (on les croise donc en face sur le couloir de gauche des rues pavées). Aux carrefours : tout droit, gauche ou droite au hasard (courbe de Bézier), **jamais de demi-tour**, ni ruelle, ni impasse. Prudentes : arrêt si quelqu'un (voiture ou moto) est dans `SAFE_DISTANCE` 9 m devant ; arrêt à une ligne d'arrêt (avant du capot hors du carrefour) tant que le carrefour est occupé (moto, ou voiture engagée : en train de tourner ou ligne franchie) ; une voiture qui tourne ignore celles qui attendent à l'entrée (sinon interblocage). Gardées autour de la moto : au-delà de `RECYCLE_DISTANCE` 140 m, replacées entre 60 et 120 m (dans le brouillard), jamais à moins de 10 m d'une autre. Percuter une voiture → Game Over « Accident ! » (seule la moto peut percuter : les voitures s'arrêtent devant elle). Simulation hors navigateur possible en Node (graphe + createTraffic avec un faux modèle).
- **Capacité de la moto** : `BIKE_CAPACITY` 3 produits (missions.js). `onBoard` (produits transportés, leurs points affichés) et `toLoad` (encore au chargement) dans main.js : moto vide avec des produits restants → le point de chargement réapparaît (message « Retourne au chargement »). Plus tard : motos à débloquer, de plus grande capacité.
- **Délai (`timeLimit`)** : chronomètre `#timer` en haut au centre (rouge sous 20 s), démarre au premier départ du trottoir, arrêts compris ; à 0 : Game Over « Temps écoulé ! ».
- **Économie (Livraison, src/wallet.js)** : argent en dollars, gardé d'une partie à l'autre (localStorage), affiché dans le HUD (`#money`) **à la place du compteur de distance** ; la distance parcourue est dans le panneau Pause (`#pause-distance`). En Défis, le HUD garde la distance. Chaque produit livré rapporte `DELIVERY_REWARD` 10 $ ; le plein à la station coûte `FUEL_PRICE` 5 $, payé à l'arrivée sur le point bleu ; sans assez d'argent, pas de plein (message `#notice`, la moto continue) ; les bidons restent gratuits. Le panneau de fin de mission indique les gains.
- **Essence (Livraison)** : jauge verticale `#fuel` sous le compteur de distance. `FUEL_MAX` 100, consommation `FUEL_PER_METER` (plein ≈ 1000 m), bidon = `CAN_FUEL` 30 (5 bidons sur la carte, un bidon ramassé réapparaît à ≥ 120 m). À 0, la moto ralentit (`BRAKE` 6 m/s²) jusqu'à l'arrêt puis Game Over « Panne d'essence ! ». La vitesse courante est `speed` (`SPEED` hors panne).

## Caméra et contrôles (src/main.js)

- **Caméra actuelle : vue d'origine derrière la moto** (`HELICOPTER_VIEW = false`, retour demandé par l'utilisateur après essai de la vue haute). **Vue d'hélicoptère** (`HELICOPTER_VIEW = true`) : caméra (réglage de l'utilisateur) en x `HELI_X` -0,5, y `HELI_HEIGHT` 6, z `HELI_BACK` 7 (derrière la moto), qui vise y `HELI_LOOK_Y` -2,5, z -`HELI_LOOK_AHEAD` (7 m devant) ; suit les changements de couloir à `HELI_FOLLOW` 0,7 (amorti, `heliX`) ; garde le retard dans les virages (`CAMERA_TURN_DAMPING`). `HELICOPTER_VIEW = false` : vue d'origine ci-dessous (`placeChaseCamera`).
- **Réglage de la caméra en jeu (src/cameraTuner.js)** (n'agit que sur la vue d'hélicoptère) : ajouter `?camera` à l'adresse (ex. `…vercel.app/?camera`) affiche un panneau de curseurs (`#camera-tuner`, repliable) : position de la caméra x, y, z et point regardé (y, z), relatifs à la moto (z < 0 = devant), avec les valeurs affichées et un bouton Copier. Ils modifient l'objet `heliCamera` de main.js (valeurs par défaut = `HELI_*`) ; pour garder un réglage, reporter les valeurs dans les constantes `HELI_*`. Les touches clavier sur un curseur ne pilotent pas la moto.
- **Caméra sur un arc (vue d'origine, active)** : elle glisse sur un demi-cercle horizontal centré sur le milieu de la route `CAMERA_PIVOT_Z` (-12 m) devant la moto, et regarde toujours ce point. Elle suit le couloir de la moto à `CAMERA_FOLLOW` = 0,6 : sur un couloir latéral, elle reste un peu décalée vers le centre et on voit le flanc de la moto. Hauteur `CAMERA_HEIGHT` 3. Retard dans les virages : `CAMERA_TURN_DAMPING`.
- **Caméra libre (développement)** : `DEBUG_ORBIT = true` réactive OrbitControls (souris) et coupe la caméra sur l'arc. `false` par défaut.
- **Clavier** : ← / → (couloir, ou virage près d'un carrefour), **Espace maintenue = frein** partout (arrêt en `BRAKE_DISTANCE` 5 m, la moto repart seule au relâchement, les deux modes ; bouton tactile STOP `#brake` entre ◀ et ▶), ↓ = **demi-tour** dans les 15 m avant un carrefour (en Livraison, dans la fenêtre de virage (`canUturn`) : grande route depuis le couloir qui longe le terre-plein ; rue pavée depuis le couloir de gauche ou de droite, pas le milieu ; jamais dans une ruelle (`ROAD_TYPES.uturn`) ; vers la gauche depuis la droite de l'axe, vers la droite depuis la gauche ; `UTURN` = 2 dans network.js, demi-cercle autour de l'axe au bord du carrefour, flèche `#arrow-uturn`, bouton tactile `#down` ; aussi depuis le trottoir après un arrêt (livraison, chargement, plein) sur une rue pavée : `canParkedUturn`, `network.uturnHere(s, side)`, demi-cercle autour de l'axe à l'endroit de l'arrêt), **M** (moto), **P** / **Échap** (pause), **Entrée** / **Espace** (rejouer après Game Over).
- **Regarder derrière** (moto garée sur le trottoir, `started = false`, les deux modes) : **R** maintenue ou bouton tactile maintenu `#look-back` (« ARRIÈRE », au-dessus de ▶, affiché seulement sur le trottoir) : la caméra passe devant la moto (`LOOK_BACK_HEIGHT` 3,2, `LOOK_BACK_Z` -4) et regarde la rue derrière (`LOOK_BACK_DISTANCE` 30 m) pour voir si une voiture arrive ; bascule amortie (`lookBackBlend`), retour au relâchement ou dès que la moto repart.
- **Mobile** : boutons ◀ ▶ (`#left`/`#right`), visibles seulement sur écran tactile (`@media (hover: none) and (pointer: coarse)`), réagissent au `pointerdown` et appellent la même fonction `steer(direction)` que le clavier. Légère vibration à chaque appui (`BUTTON_VIBRATION` 15 ms, `navigator.vibrate` : Android ; ignorée sur iPhone).
- **Effet cartoon** des motos : `toon.js` (`TONES` = paliers de lumière, `OUTLINE_WIDTH` = épaisseur du contour).

## Code de la route (règle du jeu)

- **On roule à droite** (comme au Bénin). Marquage au sol **blanc** (pas de ligne jaune, convention nord-américaine).
- **Grandes routes goudronnées (Livraison)** : terre-plein central (`median` 2 m dans `ROAD_TYPES.big`, bordure béton + herbe, interrompu aux carrefours) et couloirs de 2,5 m (`laneWidth`), 12 m au total. On ne peut rouler que dans les **2 couloirs de droite** (`firstLane()` dans main.js) : impossible de passer de l'autre côté. Un point de livraison ou un bidon du côté opposé n'est atteignable qu'en arrivant dans l'autre sens.
- **Rues pavées et ruelles** : pas de marquage ; le côté droit est celui des couloirs à x > 0 (repère de la moto). Y rouler à gauche est une **infraction** : ses conséquences sont à implémenter plus tard (le couloir central des rues à 3 couloirs reste à trancher).
- Les points de livraison se déclenchent **dans les deux sens** (choix de l'utilisateur, pour garder le jeu simple) : une seule flèche, dans le couloir qui longe le trottoir de livraison. En arrivant dans l'autre sens, on passe sur la flèche à contresens et la moto se gare sur le trottoir de gauche. Ne pas réserver la livraison au côté droit.

## Repères et conventions 3D

- Three.js : Y = haut, l'avant de la moto regarde vers **-Z**, la caméra est en (0, 3, 6) quand la moto est au centre.
- Blender : Z = haut, l'avant regarde vers **+Y**. L'export glTF convertit : (x, y, z) Blender → (x, z, -y) Three.js.
- Couloirs : `LANE_WIDTH` = 2, `laneX(0..2)` = -2, 0, 2. Le joueur démarre au couloir 1 (centre).
- Échelle : 1 unité = 1 mètre.

## Le fichier public/models.glb

Exporté depuis Blender **sans images ni matériaux** : toutes les couleurs viennent de `bikeTXT.jpg` (le code applique l'atlas à chaque modèle). Depuis octobre 2026, la MotoCub aussi (palette dans l'atlas, UV à mapper dessus dans Blender ; avant, elle gardait ses propres matériaux). Nœuds racines :

| Nœud | Contenu | Remarques |
|---|---|---|
| `MotoCub` | moto actuelle (rouge) : `MotoCub_Carrosserie`, `MotoCub_Direction` (guidon, avec enfants `MotoCub_Garde_Boue` et `MotoCub_Roue_Avant`), `MotoCub_Roue_Arriere` | placée à x = -8,655 dans Blender et modélisée **avant vers +Z** : le code la ramène à 0 et la tourne de 180°. Texturée par l'atlas (UV de toutes les pièces, roues et garde-boue compris, à mapper sur sa palette). |
| `Moto` | ancienne moto : `Moto_Body`, `Moto_Wheel_Front`, `Moto_Wheel_Rear` | texturée par l'atlas |
| `Character_Rig` | squelette du pilote (38 os « bip … ») + `Character_Body` (maillage skinné) | modèle Sketchfab « Casual LowPoly Male Rig T-pose » (denysalmaral, licence Standard Sketchfab) modifié |
| `car_1` | Toyota RAV4 2010 low poly sans logo : `car_1_Body`, `car_1_Wheel_FL/FR/RL/RR` | retiré de la scène, sert de gabarit aux obstacles |
| `StationEssence` | station essence (auvent, pompes, boutique, totem) | retirée de la scène, gabarit des stations (stations.js) ; façade = Blender -Y |
| `ChateauEau_Vedoko`, `Cylinder` | château d'eau (pièces `CE_…`, sans UV), cylindre | pas encore utilisés : retirés de la scène au chargement |

Animations : `Ride` (pose du pilote sur l'ancienne moto) et `Ride_MotoCub` (pose sur la MotoCub). Une seule image chacune, jouée une fois au chargement.

**Piège déjà rencontré plusieurs fois** : si l'export oublie le squelette ou les animations, le pilote apparaît en T-pose à travers la moto ; une pièce sans UV prend une seule couleur (coin de l'atlas). À l'export glTF il faut : sélection = toutes les racines ci-dessus + enfants, *Skinning* et *Animation* cochés, images à « None » (matériaux non nécessaires). Vérifier le contenu d'un GLB avec un petit script Node qui lit le chunk JSON (racines, `skins`, `animations`, `materials`).

## Motos (src/main.js → `BIKES`)

Chaque moto a sa fiche : `wheels` (noms des nœuds de roues), `wheelRadius`, `spinSign` (sens de rotation des roues), `rotationY`, `exhaust` (sortie de fumée), `riderPosition` (position du `Character_Rig`), `ride` (nom de l'animation de pose). `selectBike(nom)` affiche la moto, cache les autres, place le pilote et joue sa pose. `DEFAULT_BIKE = 'MotoCub'` (si aucune moto n'a été choisie dans l'écran « Moto »). La touche **M** change de moto.

## Atlas public/bikeTXT.jpg (1024 × 1024)

Une seule image pour presque tout le jeu. Zones (pixels, origine en haut à gauche) :

- (8, 9) carré 300 px : palette de l'ancienne moto, grille 4 × 4 de cases de 74 px
- (352–541, 26–284) : visage dessiné du pilote (projeté en UV sur sa tête)
- (580, 9) carré 300 px : palette du pilote (peau, cheveux, blouson, t-shirt, jean, jean foncé, baskets, blanc)
- (8, 330) carré 300 px : palette de car_1 (10 cases utilisées)
- (327, 327, 354 × 254) : tuile de pavés **raccordable** (2 × 2 périodes du motif) — référencée dans `src/atlas.js` (déplacée par l'utilisateur en octobre 2026 ; avant : 330, 650)
- (≈ 698–1008, 328–598) : texture de la station essence (`StationEssence`)

Les cases de couleur sont échantillonnées en leur centre : le filtrage lissé ne bave pas. Si tu déplaces une zone, mets à jour `src/atlas.js` et/ou les UV du GLB. La texture est chargée **une seule fois** (`src/atlas.js`) : ne pas la `clone()` avant son chargement (avertissement « Texture marked for update but no image data found »).

## Réglages de gameplay utiles

- Vitesse : `SPEED` = 12 (main.js). Changement de couloir : `LANE_CHANGE_DURATION` = 1 s, avec pivot de l'avant (`MAX_STEER` 20°, pendant les 60 % premiers) puis inclinaison (`MAX_LEAN` 25°, à partir de 15 %), pivot au sol.
- Collision moto : `PLAYER_HALF_WIDTH` 0,3, `PLAYER_FRONT` -0,85, `PLAYER_BACK` 1,0 (boîte de l'ancienne moto, à ajuster pour la MotoCub si besoin).
- Voitures (obstacles.js) : `CAR_SPEED` 4 (même sens que le joueur), **une seule voiture à la fois** (jamais deux côte à côte), couloir au hasard. **Aucune voiture dans les `CAR_FREE_ZONE` (30) derniers mètres avant un carrefour**, ni dans les virages, ni dans les `AFTER_CORNER` (25) premiers mètres d'une rue : on choisit d'abord l'endroit où le joueur croisera la voiture (`nextEncounter`, tous les 36–54 m parcourus), puis on la fait apparaître (≤ 90 m devant) à la position d'où elle sera rejointe à cet endroit.
- Route : tronçons de 20 m × 6, pavés répétés 1 fois par couloir en largeur et 14 fois par tronçon. Trottoirs 1,5 m, bâtiments à partir de ±4,5 m.

## Sessions Claude Code dans le cloud (mobile / web) et en local

L'utilisateur travaille tantôt en local (VS Code sur son ordinateur, avec Blender), tantôt depuis son téléphone (session Claude Code dans le cloud, sur une copie fraîche du dépôt GitHub `Jikolgit/ctnrace`).

- **Synchronisation** : les deux pushent sur `master`. En local, faire `git pull origin master` avant de travailler (les sessions cloud ont pu pousser des commits) ; dans le cloud, `git fetch` avant de pousser.
- **Déploiement** : le dépôt est relié à **Vercel**, qui redéploie à chaque push sur `master` ; c'est ainsi que l'utilisateur teste depuis son téléphone. Pousser après chaque modification validée par `npm run build`.
- **Dans le cloud, pas de Blender** : le serveur Blender MCP (port 9876) tourne sur l'ordinateur de l'utilisateur et n'est pas joignable. Pas de modélisation, pas de ré-export du GLB. Modifications 3D possibles seulement en code Three.js (géométries procédurales, déplacement/rotation/échelle de nœuds existants, matériaux). Un nouveau `models.glb` exporté en local doit être poussé sur GitHub (git ou « Add file → Upload files » sur github.com) ; le vérifier ensuite avec le script Node décrit plus haut.
- **Voir le jeu dans le cloud** : Chromium sans écran est disponible pour Playwright (`executablePath: '/opt/pw-browsers/chromium'`, options `--use-gl=swiftshader --enable-unsafe-swiftshader`) : `npm run build`, `npx vite preview`, puis captures d'écran (format mobile : `devices['Pixel 7']`). Le rendu logiciel est lent (le jeu tourne au ralenti). Pour observer longtemps sans Game Over, tester une copie du projet dans un dossier temporaire où `hits()` de `obstacles.js` renvoie `false` — ne jamais pousser cette modification.
- Les fichiers `.blend` sont binaires : ne pas les modifier.

## Pistes en attente / limites connues

- `MotoCub_Direction` ne pivote pas seule : toute la moto tourne lors des changements de couloir.
- La boîte de collision de la moto est celle de l'ancienne moto.
- La première voiture est croisée vers 135 m (plus loin si la première rue est courte). Les voitures sont assez rares dans les rues courtes (zone sans voiture de 30 m avant et 25 m après chaque carrefour).
- Le virage à 90° est rapide (~0,4 s, rayon 3 m) ; des carrefours plus larges permettraient un virage plus doux.
- La fenêtre de virage (15 m ≈ 1,25 s) est courte, surtout sur mobile ; option envisagée : afficher les flèches plus tôt.
- Le pilote, les voitures et le décor ne sont pas en style cartoon (seules les motos le sont).
- Compteur de distance négatif (« -4 m ») observé une fois au démarrage : le premier `delta` de la boucle peut être négatif (non plafonné vers le bas). Non corrigé.
- `public/motolowpoly.glb` n'est pas utilisé (l'utilisateur a choisi la MotoCub de models.glb).
- Un modèle « tête de moto » lissé (`moto_2_head`) et une moto `moto_2` existent seulement dans la scène Blender, pas dans le jeu.
- Effet de rendu « PlayStation 1 » (PSX, adapté de Jikolgit/psxroom) essayé en octobre 2026 puis **retiré à la demande de l'utilisateur** (pas adapté à ce jeu) : ne pas le reproposer.
- OrbitControls n'est plus actif (voir `DEBUG_ORBIT`) ; l'import reste dans `main.js` pour le développement.
