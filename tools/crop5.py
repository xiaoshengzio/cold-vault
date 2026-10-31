from PIL import Image
im = Image.open(r"C:\工作区\Projects\个人站·冷库\shots\224-shards.png")
im.crop((1020, 160, 1400, 680)).resize((760, 1040), Image.LANCZOS).save(r"C:\工作区\Projects\个人站·冷库\shots\225-crop.png")
a = Image.open(r"C:\工作区\Projects\个人站·冷库\shots\121-hero.png").convert("RGB").resize((800,450))
b = Image.open(r"C:\工作区\Projects\个人站·冷库\shots\224-shards.png").convert("RGB").resize((800,450))
c = Image.new("RGB",(1610,450),(20,20,20)); c.paste(a,(0,0)); c.paste(b,(810,0))
c.save(r"C:\工作区\Projects\个人站·冷库\shots\226-compare.png")
print("ok")
