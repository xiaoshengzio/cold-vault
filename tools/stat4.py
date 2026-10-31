
from PIL import Image
import numpy as np
im = np.asarray(Image.open('shots/v42.png').convert('RGB')).astype(float)
lum = im.mean(axis=2)
regions = {
 'floor_low': (400,760,1200,880),
 'floor_mid': (300,620,1100,740),
 'window': (1060,90,1520,600),
 'wall_left': (60,300,300,600),
 'crystal': (600,230,880,760),
 'plinth': (610,690,800,760),
 'ceiling': (200,40,900,140),
}
for k,(x0,y0,x1,y1) in regions.items():
    r = lum[y0:y1, x0:x1]
    print('%-11s mean %6.1f p50 %6.1f p90 %6.1f max %6.1f' % (k, r.mean(), np.percentile(r,50), np.percentile(r,90), r.max()))
