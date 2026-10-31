
from PIL import Image, ImageFilter, ImageStat
import glob, os
for f in sorted(glob.glob(r'C:\\工作区\\Projects\\个人站·冷库\\shots\\170-t*.png')):
    im = Image.open(f).convert('L')
    lap = im.filter(ImageFilter.FIND_EDGES)
    st = ImageStat.Stat(lap)
    print(os.path.basename(f), 'mean', round(st.mean[0],2), 'stddev', round(st.stddev[0],2))
