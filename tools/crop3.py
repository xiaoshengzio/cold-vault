from PIL import Image
im = Image.open('shots/v45.png').convert('RGB')
im.crop((760,90,1080,660)).resize((640,1140)).save('shots/v45-crop.png')
