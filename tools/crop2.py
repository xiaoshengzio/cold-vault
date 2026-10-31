from PIL import Image
a = Image.open(r"C:\工作区\Projects\个人站·冷库\shots\121-hero.png")
a.crop((880, 120, 1520, 800)).save(r"C:\工作区\Projects\个人站·冷库\shots\216-crop-old.png")
print("ok")
