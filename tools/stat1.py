
from PIL import Image
im = Image.open('shots/p0-ibl.png').convert('RGB')
print('size', im.size)
# 晶体大致区域
im.crop((520,150,900,760)).resize((380*2,610*2)).save('shots/p0-crop-crystal.png')
im.crop((1080,120,1600,650)).save('shots/p0-crop-window.png')
def stats(box, name):
    r = im.crop(box)
    px = list(r.getdata())
    lum = [0.2126*p[0]+0.7152*p[1]+0.0722*p[2] for p in px]
    lum.sort()
    n=len(lum)
    print(name, 'mean %.1f' % (sum(lum)/n), 'p5 %.0f' % lum[int(n*0.05)], 'p50 %.0f' % lum[n//2], 'p95 %.0f' % lum[int(n*0.95)], 'max %.0f' % lum[-1])
stats((520,150,900,760), 'crystal')
stats((1080,120,1600,650), 'window')
stats((0,0,1600,900), 'full')
