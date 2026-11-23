"""
Génère la géométrie en plan (mètres) du bâtiment à partir des relevés du plan
"תכנית קומת קרקע" (échelle 1:125).
Repère : origine = intersection des axes 1 et A ; x vers l'est (axes 1→18),
y vers le nord (axes A→J). 1 pt PDF = 0.044097 m (1:125).
Axes relevés : 1=0.0, 2=4.0, 3=12.4, 4..16 tous les 8.10 m, 17=126.5, 18=130.5
               A=0.0, B=7.1, C..J tous les 8.10 m (J=71.7)
"""
import json, math, sys
from shapely.geometry import Polygon, LineString, Point, box, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity

def catmull(pts, n=12):
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i-1], P[i], P[i+1], P[i+2]
        for j in range(n):
            t = j / n
            t2, t3 = t*t, t*t*t
            x = 0.5*((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3)
            y = 0.5*((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
            out.append((x, y))
    out.append(pts[-1])
    return out

# ---------------------------------------------------------------- relevés
GRID_X = {1:0.0, 2:4.0, 3:12.4}
for i in range(4, 17): GRID_X[i] = 20.5 + (i-4)*8.10
GRID_X[17] = 126.5; GRID_X[18] = 130.5
GRID_Y = {'A':0.0, 'B':7.1}
for i, l in enumerate('CDEFGHIJ'): GRID_Y[l] = 15.2 + i*8.10

def north_bldg(x):   return 49.6 + 0.209*x     # ligne de construction nord (5 m de la limite)
def north_plot(x):   return 54.7 + 0.209*x     # limite de parcelle nord (ש.צ.פ)

# Cour intérieure en amande ("רחבה פנימית")
lens_top = catmull([(24.2,26.8),(29.8,33.6),(37,37.8),(49,41.0),(61,42.6),(73,42.8),
                    (85,42.3),(97,41.0),(105,38.6),(113,34.6),(119.6,29.6)])
lens_bot = catmull([(24.2,26.8),(28.2,23.4),(37,21.3),(49,20.6),(65,21.2),(77,23.4),
                    (88,25.4),(97,25.6),(104,23.6),(110,20.3),(113.4,16.6)])

# ------------------------------------------------------------ rez-de-chaussée
# Bloc ouest + nord + est (en U autour de la cour), coupé par le passage nord (x 54-62)
GF_E = 125.5
u_outer = [(-0.5,5.0),(24.0,5.0),(24.0,26.8)] + lens_top[1:] + [(121.2,26.0),(GF_E,26.0),
          (GF_E,north_bldg(GF_E)),(-0.5,north_bldg(-0.5))]
U = Polygon(u_outer).buffer(0)
# arrondi d'angle SO (vitrage courbe)
corner = Point(4.5,10.0).buffer(5.0, 64)
U = U.difference(box(-1,4,4.5,10.0)).union(corner.intersection(box(-1,4,4.5,10.0))).buffer(0)
passage_N = Polygon([(60.6,35.0),(66.9,35.0),(64.8,80.0),(57.6,80.0)])  # passage nord (kiosques)
GF_A = U.difference(passage_N)
# Aile sud : du passage sud-ouest (x 24-28) jusqu'à la boutique en pointe (101.4 m²)
s_outer = [(28.0,5.0),(100.0,5.0),(101.5,9.0),(106,11.6),(110.5,14.2),(113.4,16.6)] + \
          list(reversed(lens_bot[:-1]))
s_outer = [p for p in s_outer if not (p[0] < 28.0)]
s_outer.append((28.2,23.4))
GF_S = Polygon(s_outer).buffer(0)
# Rampe parking nord-ouest (dans l'emprise, sous les étages)
ramp = Polygon([(3,north_bldg(3)-1.2),(44,north_bldg(44)-1.2),(44,north_bldg(44)-8.4),(3,north_bldg(3)-8.4)])
GF = unary_union([GF_A, GF_S]).difference(ramp)

# ------------------------------------------------------------ étages
UP_W = -1.6; UP_S = 3.5; UP_E = 126.5
up_outer = Polygon([(UP_W,UP_S),(100.5,UP_S),(108,7.2),(114,12.8),(119.5,19.5),(124,26.5),(UP_E,30.0),
                    (UP_E,north_bldg(UP_E)),(UP_W,north_bldg(UP_W))]).buffer(0)
c2 = Point(UP_W+6.5, UP_S+6.5).buffer(6.5, 64)
cut = box(UP_W-1, UP_S-1, UP_W+6.5, UP_S+6.5)
up_outer = up_outer.difference(cut).union(c2.intersection(cut)).buffer(0)
lens_poly = Polygon(lens_top + list(reversed(lens_bot))[1:]).buffer(0)
court_up = lens_poly.buffer(-1.5, join_style=1)
# Ouverture SE de la cour (au-dessus du niveau 1 : vide entre aile sud et aile est)
se_open = Polygon([(104.5,UP_S-5),(140,UP_S-5),(140,31.5),(113.0,34.5),(104.5,26.0)])
# Passerelle niveau 1 (bande vitrée côté SE, "קו פרגולה מעל")
bridge = Polygon([(100.5,UP_S),(108,7.2),(114,12.8),(119.5,19.5),(124,26.5),(UP_E,30.0),
                  (UP_E,33.5),(119.0,31.5),(113.0,21.0),(106.5,13.5),(100.5,10.5)]).buffer(0)

ring = up_outer.difference(court_up)

# Partition en ailes
wing_W = ring.intersection(box(-10,-10,24.0,200))
wing_S = ring.intersection(Polygon([(24.0,-10),(104.5,-10),(104.5,24.5),(24.0,27.5)]))
wing_S = wing_S.difference(se_open)
wing_N = ring.intersection(Polygon([(24.0,27.5),(110.5,33.0),(110.5,200),(24.0,200)]))
wing_E = ring.intersection(box(110.5,-10,200,200)).difference(se_open)
wing_N = wing_N.difference(wing_S)
# l'aile N/E récupère la petite partie au-dessus de 104.5 côté cour
FLOORS = 8   # R+8 : 5 niveaux pleins + 3 niveaux en gradins (comptage photo 1)
GF_H = 6.0
FH = 3.8     # plancher à plancher (rapport module 1,35 m / hauteur d'étage sur photo 1)

def strip_x(xmin, xmax):  return box(xmin, -50, xmax, 250)
def setback_south(d):     return box(-50, UP_S + d, 250, 250)
def setback_west(d):      return box(UP_W + d, -50, 250, 250)

floors = []
for k in range(1, FLOORS+1):
    parts = []
    # aile ouest : façade à résille (diagrid) jusqu'au niveau 6 ; retraits ensuite
    w = wing_W
    if k >= 6: w = w.intersection(setback_west(1.8*(k-5))).intersection(setback_south(1.6*(k-5)))
    parts.append(w)
    # aile sud : gradins vers l'est (une travée de 8.10 m par niveau à partir du 6)
    xmax = 104.5 if k <= 5 else 104.5 - 8.1*(k-5)
    s = wing_S.intersection(strip_x(-50, xmax))
    if k >= 6: s = s.intersection(setback_south(1.6*(k-5)))
    parts.append(s)
    # aile nord (courbe, suit la cour) : gradins vers l'ouest au sommet
    xmin = 24.0 if k <= 5 else 24.0 + 8.1*(k-5)
    parts.append(wing_N.intersection(strip_x(xmin, 250)))
    # aile est
    e = wing_E
    if k >= 7: e = e.intersection(box(-50, 34 + 8.1*(k-6), 250, 250))
    parts.append(e)
    if k == 1: parts.append(bridge.difference(court_up))
    poly = unary_union([p for p in parts if not p.is_empty]).buffer(0.01).buffer(-0.01)
    floors.append(poly)

def rings(geom):
    out = []
    geoms = [geom] if geom.geom_type == 'Polygon' else list(geom.geoms)
    for g in geoms:
        if g.area < 2: continue
        g = g.simplify(0.05)
        out.append({'outer':[ [round(x,3),round(y,3)] for x,y in g.exterior.coords[:-1]],
                    'holes':[[ [round(x,3),round(y,3)] for x,y in h.coords[:-1]] for h in g.interiors]})
    return out

# Noyaux (escaliers/ascenseurs, "מגדל 1-4") : émergences en toiture
cores = [ {'c':[8.0,20.0],'s':[9.0,7.0]},   # מגדל 1
          {'c':[71.0,13.0],'s':[9.0,7.0]},  # מגדל 2
          {'c':[48.0,57.0],'s':[8.0,6.0],'rot':11.8},  # ח.מ. 5
          {'c':[117.0,45.0],'s':[8.0,9.0]} ]  # מגדל 3
# Hauteur de toit locale pour poser les noyaux
def top_floor_at(pt):
    p = Point(pt); n = 0
    for i, f in enumerate(floors):
        if f.contains(p): n = i+1
    return n
for c in cores: c['floor'] = top_floor_at(c['c'])

# Contour du parcours de la résille (diagrid) : façade ouest + angle arrondi + sud jusqu'à x=24
cx, cy, r = UP_W+6.5, UP_S+6.5, 6.5+0.55
diag_path = [(UP_W-0.55, 46.0)]
for i in range(0, 33):
    a = math.radians(180 + 90*i/32)
    diag_path.append((cx + r*math.cos(a), cy + r*math.sin(a)))
diag_path.append((24.0, UP_S-0.55))

# Arbres (relevés)
trees_street = [(x, -0.9) for x in [10.6,20.4,30.4,40.3,50.3,60.4,70.3,80.2,90.3,100.2,110.0]] + \
               [(130.6, y) for y in [33.0,41.2,50.0]]
trees_court  = [(45.0,26.4),(54.6,27.2),(73.8,28.8),(84.6,30.8)]
trees_plaza  = [(126.2,19.0),(114.0,7.0)]
kiosks = [(31.0,29.6,35),(40.2,31.2,20),(49.0,34.0,10),(59.0,35.6,5),(69.0,37.2,0),(78.2,36.8,-5),(88.2,35.6,-12),
          (97.4,34.0,-20),(106.6,30.8,-35),(113.8,26.0,-50),(61.8,57.6,95),(61.8,48.4,95)]
pavilion = {'c':[65.0,27.6],'s':[5.2,4.6]}

rails = []
for i, f in enumerate(floors):
    above = floors[i+1].buffer(0.05) if i+1 < len(floors) else None
    b = f.boundary if above is None else f.boundary.difference(above)
    segs = [b] if b.geom_type == 'LineString' else list(getattr(b, 'geoms', []))
    out = []
    for g in segs:
        if g.geom_type != 'LineString' or g.length < 0.5: continue
        out.append([[round(x,3),round(y,3)] for x,y in g.simplify(0.05).coords])
    rails.append(out)
cols = []
def sample(line, step):
    L = LineString(line); n = max(1, int(L.length // step))
    return [L.interpolate(i*L.length/n) for i in range(n+1)]
for p in sample([(101.2,4.6),(108,7.9),(114,13.4),(119.4,20.2),(123.6,27.1),(125.8,30.5)], 8.5):
    cols.append([round(p.x,2), round(p.y,2)])
for p in sample([(101.0,10.0),(106.2,13.0),(112.6,21.4),(118.6,30.8)], 8.5):
    cols.append([round(p.x,2), round(p.y,2)])
data = {
  'meta': {'origin':'axes 1/A', 'abs_zero':22.80, 'gf_h':GF_H, 'fh':FH, 'floors':FLOORS,
           'scale_note':'plan 1:125, 1pt = 0.044097 m'},
  'grid_x': GRID_X, 'grid_y': GRID_Y,
  'gf': rings(GF), 'ramp': rings(ramp),
  'floors': [rings(f) for f in floors],
  'court': rings(lens_poly),
  'cores': cores, 'diag_path': [[round(x,3),round(y,3)] for x,y in diag_path],
  'north_line': [[-20, north_plot(-20)],[135, north_plot(135)]],
  'trees_street': trees_street, 'trees_court': trees_court, 'trees_plaza': trees_plaza,
  'kiosks': kiosks, 'rails': rails, 'columns': cols, 'pavilion': pavilion,
}
for i,f in enumerate(floors): print('niveau', i+1, 'surface %.0f m²' % f.area, file=sys.stderr)
print('RDC surface %.0f m²' % GF.area, 'cour %.0f m²' % lens_poly.area, file=sys.stderr)
json.dump(data, open(sys.argv[1], 'w'))
