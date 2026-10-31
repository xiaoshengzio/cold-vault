
from PIL import Image
a = Image.open('shots/v39.png').convert('RGB').crop((1000,40,1600,760))
b = Image.open('shots/p4.png').convert('RGB').crop((1000,40,1600,760))
w,h = a.size
out = Image.new('RGB', (w*2+20, h), (30,0,0))
out.paste(a, (0,0)); out.paste(b, (w+20,0))
out.save('shots/cmp-window.png')
c = Image.open('shots/v39.png').convert('RGB').crop((430,110,1010,830))
d = Image.open('shots/p4.png').convert('RGB').crop((430,110,1010,830))
w2,h2 = c.size
out2 = Image.new('RGB', (w2*2+20, h2), (30,0,0))
out2.paste(c,(0,0)); out2.paste(d,(w2+20,0))
out2.save('shots/cmp-crystal.png')
