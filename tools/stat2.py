
from PIL import Image
import numpy as np
for path in ['shots/v39.png','shots/p4.png','shots/p4-nobloom.png']:
    im = np.asarray(Image.open(path).convert('RGB')).astype(float)
    lum = im.mean(axis=2)
    mask = lum > 200
    ys, xs = np.nonzero(mask)
    print(path, 'bright px', mask.sum(), 'bbox', (xs.min(), ys.min(), xs.max(), ys.max()) if len(xs) else None,
          'mean of bright', round(lum[mask].mean(),1) if len(xs) else 0)
    # 窗口中心区域统计
    box = lum[120:560, 1120:1560]
    print('   window-region mean %.1f p90 %.1f max %.1f' % (box.mean(), np.percentile(box,90), box.max()))
