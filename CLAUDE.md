# ctnRacer — runner infini 3D en moto

Jeu web : une moto roule sur une route infinie à 3 couloirs, le joueur change de couloir pour éviter des voitures. Percuter une voiture = Game Over.

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
index.html          canvas #game, HUD (#hud/#distance), bouton #pause, flèches #arrow-left/#arrow-right, boutons tactiles #left/#right,
                    panneau #gameover (#final-distance, #restart)
src/main.js         scène, caméra, lumières, brouillard, chargement du GLB, joueur, motos, pilote, entrées clavier,
                    changement de couloir (inclinaison + pivot de l'avant), pause, game over, boucle de jeu
src/track.js        parcours : rues droites reliées par des carrefours en L ou en T, virage choisi par le joueur, pose(s, décalage)
src/road.js         tronçons de route (3 couloirs + trottoirs) et carrefours posés le long du parcours, shader des pavés
src/city.js         bâtiments (boîtes) le long des rues, angles de rue et « mur » au bout de chaque rue ; sol uni
public/arrow.png    flèche de virage (pointe à droite ; retournée en CSS pour la gauche), fond rendu transparent
src/obstacles.js    voitures obstacles : pool de clones de car_1, repérées sur le parcours (s, couloir), collision
src/toon.js         effet cartoon des motos : toToon(material) (MeshToonMaterial, 3 paliers) et addOutline(mesh)
                    (contour noir « inverted hull », normales lissées) ; le pilote n'est pas concerné
src/smoke.js        fumée d'échappement : pool de sprites
src/worldBend.js    effet de courbure du monde (vertex shader) : applyWorldBend(material), bendUniforms
src/atlas.js        texture partagée bikeTXT.jpg + position des pavés dans l'atlas
src/style.css       HUD, bouton pause, écran Game Over
public/models.glb   tous les modèles 3D (voir plus bas)
public/bikeTXT.jpg  atlas de textures unique (voir plus bas)
public/smoketxt.png texture de la fumée (fichier en minuscules, attention à la casse)
public/motolowpoly.glb  modèle de moto ajouté par l'utilisateur, NON utilisé pour l'instant
*.blend (racine)    fichiers Blender sources (non utilisés par le jeu)
```

## Principes d'architecture (à respecter)

- **Le joueur reste en (0, 0, 0), face à -Z ; c'est le monde qui bouge.** Route, bâtiments et voitures sont des enfants du groupe `world`, posés une fois pour toutes le long du parcours (`track.js`). À chaque image, `placeWorld()` déplace et tourne `world` pour amener le point du parcours où est le joueur (`playerS`) en 0. Dans les virages à 90°, c'est donc la ville qui pivote.
- **Parcours** : position = distance `s` le long de la ligne médiane. Une rue (`leg`) va du centre d'un carrefour au suivant (4 à 9 tronçons de 20 m + 6 m), puis tourne ; dans le carrefour, la ligne médiane suit un quart de cercle de rayon 3 centré sur le coin intérieur (chaque couloir garde sa place). Carrefour en L (`options` = [-1] ou [+1], jamais 3 L du même côté d'affilée) ou en T (`options` = [-1, +1], 40 %). Les rues qui partent du prochain carrefour (« branches ») sont créées à l'avance ; `track.choose(dir)` garde la branche prise, puis crée les branches du carrefour suivant ; la branche non choisie reste affichée jusqu’à `DISCARD_DELAY` (25 m) après le virage, pour disparaître hors caméra. Rues retirées 40 m après leur virage (contenu rendu aux pools).
- **Virage commandé** : dans les `TURN_WINDOW` (15) derniers mètres avant le carrefour, gauche/droite (clavier ou boutons tactiles) choisissent le virage au lieu de changer de couloir (direction impossible ignorée) et les flèches possibles clignotent. Sans choix à l'entrée du carrefour : `turn = 0`, la moto continue tout droit et percute le mur (`WALL_HIT`) → Game Over.
- Le « mur » au bout de chaque rue (bâtiments hauts sur ±14,5 m) appartient à la rue d'arrivée ; les rangées des rues suivantes commencent après lui.
- La caméra tourne avec un léger retard dans les virages (`CAMERA_TURN_DAMPING`) ; la moto se penche (`TURN_LEAN` 30°). La courbure du monde (démo) est coupée autour des carrefours (`bendFade`) : route droite sur `STRAIGHT_BEFORE` (50 m) avant et `STRAIGHT_AFTER` (50 m) après, transition sur `BEND_RAMP` (40 m).
- **Pooling partout** : tronçons de route, voitures, sprites de fumée sont créés une fois puis recyclés. Ne pas créer d'objets ni de `new Vector3()` dans la boucle de jeu.
- **World bending** : tout matériau visible dans le décor doit passer par `applyWorldBend(material)`, sinon il ne suit pas les virages. Si un matériau a déjà un `onBeforeCompile`, l'enchaîner (voir `road.js`).
- **Brouillard** (`FOG_NEAR` 30, `FOG_FAR` 85, couleur du ciel `0x87ceeb`) : cache l'apparition des voitures (SPAWN_Z = -90) et la fin de la route (~ -110). Garder `FOG_FAR` < ~90.
- `delta` est plafonné à 0,1 s ; le temps vient de `THREE.Timer` (pas `THREE.Clock`, déprécié).

## Repères et conventions 3D

- Three.js : Y = haut, l'avant de la moto regarde vers **-Z**, la caméra est en (0, 3, 6).
- Blender : Z = haut, l'avant regarde vers **+Y**. L'export glTF convertit : (x, y, z) Blender → (x, z, -y) Three.js.
- Couloirs : `LANE_WIDTH` = 2, `laneX(0..2)` = -2, 0, 2. Le joueur démarre au couloir 1 (centre).
- Échelle : 1 unité = 1 mètre.

## Le fichier public/models.glb

Exporté depuis Blender **sans images** (les couleurs viennent de `bikeTXT.jpg`, sauf la MotoCub qui garde ses matériaux). Nœuds racines :

| Nœud | Contenu | Remarques |
|---|---|---|
| `MotoCub` | moto actuelle (rouge) : `MotoCub_Carrosserie`, `MotoCub_Direction` (guidon, avec enfants `MotoCub_Garde_Boue` et `MotoCub_Roue_Avant`), `MotoCub_Roue_Arriere` | placée à x = -8,655 dans Blender et modélisée **avant vers +Z** : le code la ramène à 0 et la tourne de 180°. Matériaux propres, roues sans UV. |
| `Moto` | ancienne moto : `Moto_Body`, `Moto_Wheel_Front`, `Moto_Wheel_Rear` | texturée par l'atlas |
| `Character_Rig` | squelette du pilote (38 os « bip … ») + `Character_Body` (maillage skinné) | modèle Sketchfab « Casual LowPoly Male Rig T-pose » (denysalmaral, licence Standard Sketchfab) modifié |
| `car_1` | Toyota RAV4 2010 low poly sans logo : `car_1_Body`, `car_1_Wheel_FL/FR/RL/RR` | retiré de la scène, sert de gabarit aux obstacles |

Animations : `Ride` (pose du pilote sur l'ancienne moto) et `Ride_MotoCub` (pose sur la MotoCub). Une seule image chacune, jouée une fois au chargement.

**Piège déjà rencontré plusieurs fois** : si l'export oublie le squelette, les animations ou les matériaux, le pilote apparaît en T-pose à travers la moto ou la MotoCub devient grise. À l'export glTF il faut : sélection = toutes les racines ci-dessus + enfants, *Skinning* et *Animation* cochés, matériaux exportés, images à « None ». Vérifier le contenu d'un GLB avec un petit script Node qui lit le chunk JSON (racines, `skins`, `animations`, `materials`).

## Motos (src/main.js → `BIKES`)

Chaque moto a sa fiche : `wheels` (noms des nœuds de roues), `wheelRadius`, `spinSign` (sens de rotation des roues), `rotationY`, `exhaust` (sortie de fumée), `riderPosition` (position du `Character_Rig`), `ride` (nom de l'animation de pose). `selectBike(nom)` affiche la moto, cache les autres, place le pilote et joue sa pose. `DEFAULT_BIKE = 'MotoCub'`. La touche **M** change de moto.

## Atlas public/bikeTXT.jpg (1024 × 1024)

Une seule image pour presque tout le jeu. Zones (pixels, origine en haut à gauche) :

- (8, 9) carré 300 px : palette de l'ancienne moto, grille 4 × 4 de cases de 74 px
- (352–541, 26–284) : visage dessiné du pilote (projeté en UV sur sa tête)
- (580, 9) carré 300 px : palette du pilote (peau, cheveux, blouson, t-shirt, jean, jean foncé, baskets, blanc)
- (8, 330) carré 300 px : palette de car_1 (10 cases utilisées)
- (330, 650, 348 × 248) : tuile de pavés **raccordable** (2 × 2 périodes du motif) — référencée dans `src/atlas.js`

Les cases de couleur sont échantillonnées en leur centre : le filtrage lissé ne bave pas. Si tu déplaces une zone, mets à jour `src/atlas.js` et/ou les UV du GLB. La texture est chargée **une seule fois** (`src/atlas.js`) : ne pas la `clone()` avant son chargement (avertissement « Texture marked for update but no image data found »).

## Réglages de gameplay utiles

- Vitesse : `SPEED` = 12 (main.js). Changement de couloir : `LANE_CHANGE_DURATION` = 1 s, avec pivot de l'avant (`MAX_STEER` 20°, pendant les 60 % premiers) puis inclinaison (`MAX_LEAN` 25°, à partir de 15 %), pivot au sol.
- Collision moto : `PLAYER_HALF_WIDTH` 0,3, `PLAYER_FRONT` -0,85, `PLAYER_BACK` 1,0 (boîte de l'ancienne moto, à ajuster pour la MotoCub si besoin).
- Voitures (obstacles.js) : `CAR_SPEED` 4 (même sens que le joueur), **une seule voiture à la fois** (jamais deux côte à côte), couloir au hasard. **Aucune voiture dans les `CAR_FREE_ZONE` (30) derniers mètres avant un carrefour**, ni dans les virages, ni dans les `AFTER_CORNER` (25) premiers mètres d'une rue : on choisit d'abord l'endroit où le joueur croisera la voiture (`nextEncounter`, tous les 36–54 m parcourus), puis on la fait apparaître (≤ 90 m devant) à la position d'où elle sera rejointe à cet endroit.
- Route : tronçons de 20 m × 6, pavés répétés 1 fois par couloir en largeur et 14 fois par tronçon. Trottoirs 1,5 m, bâtiments à partir de ±4,5 m.

## Ce qui n'est PAS possible depuis Claude Code mobile / web

Une session Claude Code sur mobile tourne dans un environnement cloud, pas sur l'ordinateur de l'utilisateur :

- **Pas de Blender** : le serveur Blender MCP (port 9876) et Blender ne sont pas disponibles. Pas de modélisation, pas de ré-export du GLB, pas de rendus. Les modifications de modèles 3D sont à reporter au retour sur l'ordinateur — ou à faire en code Three.js (géométries procédurales, déplacement/rotation/échelle de nœuds existants, couleurs de matériaux).
- **Pas de navigateur pour voir le jeu** : vérifie avec `npm run build` et décris précisément ce qui doit changer à l'écran ; l'utilisateur teste lui-même (en local au retour, ou via un déploiement web s'il en met un en place, par ex. GitHub Pages — il faudra alors régler `base` dans une config Vite).
- Les fichiers `.blend` sont binaires : ne pas les modifier.

## Pistes en attente / limites connues

- `MotoCub_Direction` ne pivote pas seule : toute la moto tourne lors des changements de couloir.
- La boîte de collision de la moto est celle de l'ancienne moto.
- La première voiture est croisée vers 135 m (plus loin si la première rue est courte).
- `public/motolowpoly.glb` n'est pas utilisé (l'utilisateur a choisi la MotoCub de models.glb).
- Un modèle « tête de moto » lissé (`moto_2_head`) et une moto `moto_2` existent seulement dans la scène Blender, pas dans le jeu.
- OrbitControls est encore actif (caméra déplaçable à la souris), utile en développement, à retirer pour le jeu final.
