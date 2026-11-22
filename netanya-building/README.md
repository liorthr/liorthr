# Modèle 3D – immeuble bureaux & commerces, rue Gad Manela, Netanya

**Ouvrir `index.html` dans un navigateur** (Chrome, Edge, Firefox, Safari). Le fichier est autonome :
three.js y est inclus, aucune connexion internet n'est nécessaire.

Commandes : clic gauche = tourner, clic droit = déplacer, molette = zoom.
Le panneau propose des vues prédéfinies, l'heure du soleil (fin novembre, latitude de Netanya),
l'affichage étage par étage, les axes de la trame du plan (1–18 / A–J) et le contexte.

## Sources et méthode

| Élément | Source | Fiabilité |
|---|---|---|
| Emprise du RDC, cour en amande, passages, rampe parking | Plan "תכנית קומת קרקע" 1:125 (AutoCAD), calé sur les axes | **mesuré** (± 0,5 m) |
| Trame structurelle 8,10 m, axes 1–18 et A–J | Plan (positions des repères d'axes) | **mesuré** |
| Limite nord (ש.צ.פ), recul de 5 m, pente ≈ 11,8° | Plan | **mesuré** |
| Cote ±0.00 = +22.80 | Plan | **mesuré** |
| Arbres, kiosques "דוכן", pavillon, passages piétons | Plan | **mesuré** (± 1 m) |
| Nombre d'étages (R+9), gradins, terrasses | Photos (comptage des trames de vitrage) | **estimé** |
| Hauteur RDC 6,00 m, étages 3,90 m (acrotère ≈ 41 m) | Photos + valeurs usuelles bureaux | **estimé** |
| Mur-rideau (trames 1,35 m), résille en losanges blanche, passerelle vitrée SE | Photos | **estimé** |
| Voisins, grue | Schématiques | indicatif |

Le plan fourni ne contient que le rez-de-chaussée : la volumétrie des étages vient des photos.
Des coupes ou façades (חזיתות / חתכים) permettraient de caler les hauteurs exactement.

## Structure

- `index.html` – le modèle, prêt à ouvrir
- `src/main.js` – scène three.js (matériaux, façades, résille, contexte, interface)
- `src/geometry.json` – géométrie en plan générée (mètres, origine = axes 1/A, x→est, y→nord)
- `tools/geometry.py` – relevés du plan et calcul des contours de chaque niveau (shapely)
- `tools/build.mjs` – assemble `index.html`
- `apercus/` – images de rendu

Reconstruire :

```bash
pip install shapely && python3 tools/geometry.py src/geometry.json
cd tools && npm install && node build.mjs
```
