import sys
from PIL import Image, ImageChops
a=Image.open(sys.argv[1]).convert('RGB'); b=Image.open(sys.argv[2]).convert('RGB')
if a.size!=b.size: print(999999); sys.exit()
d=ImageChops.difference(a,b).convert('L')
print(sum(1 for v in d.get_flattened_data() if v>12) if hasattr(d,'get_flattened_data') else sum(1 for v in d.getdata() if v>12))
