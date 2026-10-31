
from PIL import Image
def scan(path, name):
    im = Image.open(path).convert('RGB')
    # 竖直扫描线穿过窗（x=1300）
    col = [sum(im.getpixel((1300,y))[:3])/3 for y in range(120, 620, 2)]
    # 统计亮/暗交替
    print(name, 'x=1300 min %.0f max %.0f mean %.0f' % (min(col), max(col), sum(col)/len(col)))
    seg = []
    for y, v in zip(range(120,620,2), col):
        seg.append('#' if v>200 else ('+' if v>120 else ('.' if v>40 else ' ')))
    print(''.join(seg))
for p in ['shots/v39.png','shots/boot-hero.png','shots/final-0-rest.png','shots/p4-nobloom.png','shots/p4.png']:
    scan(p, p)
