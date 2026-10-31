
from PIL import Image
import collections
im = Image.open(r'shots/157-window-base.png').convert('RGB')
px = im.load()
w, h = im.size
c = collections.Counter()
for y in range(0, h, 2):
    for x in range(0, w, 2):
        r, g, b = px[x, y]
        c[(r // 16 * 16, g // 16 * 16, b // 16 * 16)] += 1
for k, v in c.most_common(8):
    print(k, v)
# 统计最亮 1% 的像素
vals = []
for y in range(0, h, 2):
    for x in range(0, w, 2):
        r, g, b = px[x, y]
        vals.append((r + g + b) // 3)
vals.sort()
n = len(vals)
print('p50', vals[n//2], 'p90', vals[int(n*0.9)], 'p99', vals[int(n*0.99)], 'max', vals[-1])
