
from PIL import Image
im = Image.open('shots/v44.png').convert('RGB')
im.crop((560,180,900,780)).resize((680,1200)).save('shots/v44-crop.png')
