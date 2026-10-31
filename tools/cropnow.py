from PIL import Image, ImageStat
import sys
p = sys.argv[1]
im = Image.open(p).convert('RGB')
w, h = im.size
# 晶体大致在画面中央偏右
box = (int(w*0.34), int(h*0.16), int(w*0.66), int(h*0.92))
c = im.crop(box).resize((int((box[2]-box[0])*1.6), int((box[3]-box[1])*1.6)), Image.LANCZOS)
c.save('shots/crop-now.png')
st = ImageStat.Stat(im)
print('size', im.size, 'mean', [round(x,1) for x in st.mean])
print('crop saved', c.size)
