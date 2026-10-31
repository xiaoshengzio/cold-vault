
import json
from PIL import Image, ImageChops, ImageStat
base = Image.open(r'shots/barbase.png').convert('L')
cands = json.load(open('shots/bar-candidates.json'))
box = (40, 0, 280, 90)
b = base.crop(box)
rows = []
for i, c in enumerate(cands):
    im = Image.open(f'shots/barc{i}.png').convert('L').crop(box)
    diff = ImageChops.difference(b, im)
    m = ImageStat.Stat(diff).mean[0]
    rows.append((m, i, c['kind'], c['geo'], c['count']))
rows.sort(reverse=True)
for r in rows[:6]:
    print(f"{r[0]:7.2f}  idx={r[1]:2d} {r[2]:10s} {r[3]} pts={r[4]}")
