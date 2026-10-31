
from PIL import Image
im = Image.open(r'shots/140-dsf1-full.png').convert('L')
w, h = im.size
px = im.load()
minx, miny, maxx, maxy = w, h, 0, 0
for y in range(0, h, 2):
    for x in range(0, w, 2):
        if px[x, y] > 210:
            if x < minx: minx = x
            if x > maxx: maxx = x
            if y < miny: miny = y
            if y > maxy: maxy = y
print('bright bbox', minx, miny, maxx, maxy)
# 在亮区中心取一条横向扫描线
yy = (miny + maxy) // 2
seq = ''.join('#' if px[x, yy] > 210 else ('+' if px[x, yy] > 90 else '.') for x in range(minx, maxx + 1, 3))
print('row', yy)
print(seq)
# 一条纵向扫描线
xx = (minx + maxx) // 2
seq2 = ''.join('#' if px[xx, y] > 210 else ('+' if px[xx, y] > 90 else '.') for y in range(miny, maxy + 1, 3))
print('col', xx)
print(seq2)
