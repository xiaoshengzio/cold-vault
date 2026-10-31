
from PIL import Image
import numpy as np
im = np.asarray(Image.open('shots/p4.png').convert('RGB')).astype(float)
lum = im.mean(axis=2)
for box in [(1060,90,1520,600),(1120,120,1560,560),(1100,60,1600,700)]:
    x0,y0,x1,y1 = box
    r = lum[y0:y1, x0:x1]
    print(box, 'mean %.1f p50 %.1f p90 %.1f p99 %.1f max %.1f' % (r.mean(), np.percentile(r,50), np.percentile(r,90), np.percentile(r,99), r.max()))
# 沿水平线扫 y=300
row = lum[300, 1000:1600]
print('row y=300 sample every 40px:', [int(v) for v in row[::40]])
