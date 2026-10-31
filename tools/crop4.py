
from PIL import Image
im = Image.open('shots/p4.png').convert('RGB')
im.crop((1060,90,1520,600)).resize((460*2,510*2)).save('shots/p4-win2x.png')
im.crop((500,120,1000,820)).save('shots/p4-cry.png')
