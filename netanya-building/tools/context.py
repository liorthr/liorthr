"""
Contexte réel autour du bâtiment, à partir de l'imagerie Esri World Imagery (0,505 m/px, z18)
et du géoréférencement du plan :
  - point GPS fourni : 32.2858260297613 N, 34.86186250286374 E
  - rotation : l'axe "haut du plan" (axes A→J) pointe au N 12,5° E  (calé sur 3 alignements
    indépendants de l'image : mur ouest de la dalle, alignement d'arbres de Gad Manela, bord est)
  - le point GPS correspond au point (73,5 ; 62,5) du repère plan (±3 m)
Usage : python3 tools/context.py <dossier mosaïques> src/context.json src/ortho18.jpg src/ortho16.jpg
"""
import json, math, sys
from PIL import Image

B = math.radians(12.5)
OX, OY = 73.5, 62.5

def en2plan(E, N):
    return (E*math.cos(B) - N*math.sin(B) + OX, E*math.sin(B) + N*math.cos(B) + OY)

# mosaïque z18 : 1536 px, 0,505 m/px, point GPS au pixel (674.2, 800.1)
MPP, GX, GY = 0.505, 674.2, 800.1
def px2plan(p):
    return en2plan((p[0]-GX)*MPP, -(p[1]-GY)*MPP)

# Bâtiments voisins relevés sur l'orthophoto (pixels de la mosaïque z18) ; hauteurs indicatives
# (estimées d'après les ombres et le nombre d'étages visibles, non mesurées).
N = [
 ('N1',  [(700,55),(860,60),(855,300),(700,295)], 38),
 ('N2',  [(670,325),(800,320),(860,345),(880,390),(860,430),(800,445),(670,440)], 18),
 ('N3',  [(500,405),(605,405),(605,555),(500,555)], 14),
 ('N4',  [(615,470),(745,480),(745,560),(615,555)], 12),
 ('N5',  [(555,255),(670,255),(665,385),(555,380)], 20),
 ('N6',  [(600,125),(700,125),(700,245),(600,245)], 22),
 ('N7',  [(950,395),(1160,395),(1160,600),(950,600)], 24),
 ('N8',  [(1175,400),(1300,400),(1300,610),(1175,610)], 30),
 ('N9',  [(1000,200),(1060,130),(1150,130),(1150,350),(1000,345)], 26),
 ('N10', [(1170,215),(1320,215),(1320,355),(1170,355)], 22),
 ('N11', [(1395,115),(1500,115),(1500,400),(1395,400)], 28),
 ('N12', [(1450,420),(1536,420),(1536,600),(1450,600)], 24),
 ('W1',  [(345,845),(460,855),(450,1060),(335,1040)], 28),
 ('W2',  [(255,830),(345,840),(340,1030),(245,1020)], 10),
 ('SW',  [(240,1030),(390,1060),(375,1290),(200,1260)], 22),
 ('S1',  [(500,940),(690,985),(735,1035),(705,1170),(660,1200),(465,1155)], 20),
 ('S2',  [(400,1250),(520,1260),(515,1340),(400,1335)], 16),
 ('E1',  [(810,905),(905,915),(895,1175),(800,1165)], 16),
 ('E2',  [(905,945),(1000,950),(995,1170),(900,1165)], 12),
 ('E3',  [(1040,810),(1160,815),(1155,935),(1040,930)], 10),
 ('E4',  [(1215,820),(1390,830),(1380,1010),(1205,1000)], 22),
 ('E5',  [(1220,1085),(1340,1090),(1335,1240),(1215,1235)], 18),
 ('E6',  [(1385,870),(1536,875),(1536,1260),(1380,1250)], 20),
 ('E7',  [(1020,1090),(1110,1095),(1105,1250),(1015,1245)], 14),
]

def main(src, out_json, out18, out16):
    big18 = Image.open(f'{src}/big18.jpg'); big16 = Image.open(f'{src}/big16.jpg')
    big18.save(out18, quality=82, optimize=True)
    b16 = big16.resize((1024, 1024), Image.LANCZOS); b16.save(out16, quality=78, optimize=True)
    def center(img_px, gps_px, mpp, size):
        # décalage E/N (m) du centre de l'image par rapport au point GPS
        return [round((size/2 - gps_px[0])*mpp, 2), round(-(size/2 - gps_px[1])*mpp, 2)]
    data = {
        'gps': [32.2858260297613, 34.86186250286374],
        'plan_up_bearing_deg': 12.5, 'gps_plan_xy': [OX, OY],
        'ortho18': {'size_m': round(1536*MPP, 2), 'center_en': center(None, (GX, GY), MPP, 1536)},
        'ortho16': {'size_m': round(1536*2.019, 2), 'center_en': center(None, (872.5, 840.0), 2.019, 1536)},
        'buildings': [{'id': i, 'h': h, 'poly': [[round(v, 2) for v in px2plan(p)] for p in poly],
                       'uv': [[p[0]/1536, 1 - p[1]/1536] for p in poly]} for i, poly, h in N],
        # bord sud de l'avenue au nord du site (pour l'espace vert ש.צ.פ)
        'park': [[round(v, 2) for v in px2plan(p)] for p in
                 [(472,694),(845,712),(838,760),(800,792),(472,800)]],
        'attribution': 'Imagerie : Esri, Maxar, Earthstar Geographics et contributeurs (World Imagery / Wayback)',
    }
    json.dump(data, open(out_json, 'w'))
    for b in data['buildings'][:3]: print(b['id'], b['poly'][:2])

if __name__ == '__main__':
    main(*sys.argv[1:5])
