from PIL import Image
a = Image.open('shots/w2-650.png').convert('RGB').resize((800,450))
b = Image.open('shots/w2-3200.png').convert('RGB').resize((800,450))
out = Image.new('RGB',(1620,450),(0,0,0))
out.paste(a,(0,0)); out.paste(b,(820,0)); out.save('shots/w2-cmp.png')