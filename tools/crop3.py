from PIL import Image
im = Image.open(r"C:\工作区\Projects\个人站·冷库\shots\219-shards.png")
im.crop((980, 150, 1400, 720)).resize((840, 1140), Image.LANCZOS).save(r"C:\工作区\Projects\个人站·冷库\shots\220-crop.png")
print("ok")
