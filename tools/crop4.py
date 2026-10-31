from PIL import Image
im = Image.open(r"C:\工作区\Projects\个人站·冷库\shots\222-bigger.png")
im.crop((1040, 170, 1380, 660)).resize((680, 980), Image.LANCZOS).save(r"C:\工作区\Projects\个人站·冷库\shots\223-crop.png")
print("ok")
