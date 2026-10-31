from PIL import Image
im = Image.open(r"C:\工作区\Projects\个人站·冷库\shots\210-ivory.png")
print(im.size)
im.crop((880, 120, 1520, 800)).save(r"C:\工作区\Projects\个人站·冷库\shots\215-crop.png")
print("ok")
