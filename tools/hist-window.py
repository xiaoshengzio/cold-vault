
from PIL import Image
im = Image.open(r'shots/140-dsf1-full.png').convert('RGB')
w, h = im.size
print('size', im.size)
# 窗洞区域
box = (1150, 210, 1480, 560)
crop = im.crop(box)
# 按列取一行横截面，打印亮度变化，判断白条与黑条宽度
y = 380
row = [(im.getpixel((x, y)), x) for x in range(1150, 1490, 4)]
print('row y=380 sample:')
line = ''.join('#' if sum(p)/3 > 200 else ('+' if sum(p)/3 > 90 else '.') for p, x in row)
print(line)
# 统计该区域亮度直方图
import collections
c = collections.Counter()
for px in crop.getdata():
    c[min(255, int(sum(px)/3)//32*32)] += 1
for k in sorted(c):
    print(k, c[k])
