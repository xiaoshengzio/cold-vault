from PIL import Image
a = Image.open(r"C:\工作区\Projects\个人站·冷库\shots\121-hero.png").convert("RGB").resize((800,450))
b = Image.open(r"C:\工作区\Projects\个人站·冷库\shots\219-shards.png").convert("RGB").resize((800,450))
c = Image.new("RGB",(1610,450),(20,20,20))
c.paste(a,(0,0)); c.paste(b,(810,0))
c.save(r"C:\工作区\Projects\个人站·冷库\shots\221-compare.png")
print("ok")
