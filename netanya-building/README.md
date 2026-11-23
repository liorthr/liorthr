# Modèle 3D – immeuble bureaux & commerces, rue Gad Manela, Netanya

**Ouvrir `index.html` dans un navigateur** (Chrome, Edge, Firefox, Safari). Le fichier est autonome :
three.js y est inclus, aucune connexion internet n'est nécessaire.

Commandes : clic gauche = tourner, clic droit = déplacer, molette = zoom.
Le panneau propose des vues prédéfinies, l'heure du soleil (fin novembre, latitude de Netanya),
l'affichage étage par étage, les axes de la trame du plan (1–18 / A–J) et le contexte réel.
Une boussole (en haut à droite) indique le nord géographique.

## Sources et méthode

| Élément | Source | Fiabilité |
|---|---|---|
| Emprise du RDC, cour en amande, passages, rampe parking | Plan "תכנית קומת קרקע" 1:125 (AutoCAD), calé sur les axes | **mesuré** (± 0,5 m) |
| Trame structurelle 8,10 m, axes 1–18 et A–J, cote ±0.00 = +22.80 | Plan | **mesuré** |
| Orientation : axes du plan à **N 12,5° E** | Orthophoto Esri 0,5 m/px : 3 alignements indépendants (mur ouest de la dalle, alignement d'arbres de Gad Manela, bord est) ; flèche nord du plan ≈ 15° | **mesuré** (± 1°) |
| Position : point GPS fourni (32.28583 N, 34.86186 E) = point (73,5 ; 62,5) du plan | Superposition plan / orthophoto (la fosse courbe du chantier épouse la cour du plan) | **mesuré** (± 3–5 m) |
| Achèvement du bâtiment, emprise et cour sombre | Sentinel‑2 L2A du 20/11/2026 (0 % nuages) comparé au 28/07/2024 | **constaté** |
| Nombre d'étages **R+8** (5 niveaux pleins + 3 en gradins), étage 3,80 m, RDC 6,00 m | Comptage sur la photo 1 + rapport module / hauteur | **estimé** (± 1 m/étage) |
| Résille en losanges (niveaux 1–5), passerelle vitrée SE, mur-rideau | Photos | **estimé** |
| Sol et voisins (24 bâtiments) | Orthophoto Esri (toits texturés avec l'image) | emprises **relevées**, hauteurs **indicatives** |

### Ce que l'imagerie a permis et ses limites
- **Esri World Imagery / Wayback** : 6 versions disponibles sur la zone (2022 → 2026) ; la plus récente
  publiée (29/01/2026) montre encore le chantier au stade dalle — aucune imagerie gratuite très haute
  résolution du bâtiment achevé n'existe encore. Elle sert au géoréférencement et au contexte.
  Le site est recouvert par le dallage du projet dans la maquette.
- **Sentinel‑2** (10 m/px) : confirme le bâtiment achevé en novembre 2026 et le calage (écart ≈ 5 m).
  L'estimation de hauteur par l'ombre portée a été tentée (ombre théorique du modèle vs. image, soleil
  du 20/11/2026 08:31 UTC) mais **n'est pas concluante** : l'ombre tombe sur la route et la végétation,
  déjà sombres ; l'écart entre 20 m et 57 m reste < 1 %. La hauteur vient donc des photos.
- **OpenStreetMap (Overpass)** : non joignable depuis l'environnement de calcul (connexion coupée).
- Pour aller plus loin : orthophotos récentes du Mapi / GovMap (10–25 cm), façades et coupes du permis
  de construire, ou un relevé LiDAR.

`apercus/calage-satellite.png` montre la superposition plan / orthophoto ;
`apercus/sentinel2-2024-vs-2026.png` la comparaison Sentinel‑2 avec l'empreinte calée.

## Structure

- `index.html` – le modèle, prêt à ouvrir
- `src/main.js` – scène three.js (matériaux, façades, résille, contexte, interface)
- `src/geometry.json` – géométrie en plan générée (mètres, origine = axes 1/A, x→axe 18, y→axe J)
- `src/context.json`, `src/ortho18.jpg`, `src/ortho16.jpg` – géoréférencement, voisins, orthophotos
- `tools/context.py` – relevé des voisins et calage satellite
- `tools/geometry.py` – relevés du plan et calcul des contours de chaque niveau (shapely)
- `tools/build.mjs` – assemble `index.html`
- `apercus/` – images de rendu

Reconstruire :

```bash
pip install shapely && python3 tools/geometry.py src/geometry.json
# (contexte : python3 tools/context.py <dossier mosaïques big18.jpg/big16.jpg> src/context.json src/ortho18.jpg src/ortho16.jpg)
cd tools && npm install && node build.mjs
```
