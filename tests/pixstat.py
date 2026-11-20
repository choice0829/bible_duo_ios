# 스크린샷의 일부 영역에서 평균 밝기와 특정 색(±허용치)에 가까운 픽셀 비율을 JSON으로 출력한다.
# 사용: python3 -I pixstat.py 사진.png x y w h 허용치   (w·h가 0이면 사진 전체) '#RRGGBB' ['#RRGGBB' ...]
import sys, json
from PIL import Image
path, x, y, w, h, tol = sys.argv[1], *map(int, sys.argv[2:6]), int(sys.argv[6])
cols = [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in sys.argv[7:]]
im = Image.open(path).convert('RGB')
if w == 0 or h == 0: w, h = im.size   # 폭·높이를 0으로 주면 사진 전체
im = im.crop((x, y, x + w, y + h))
px = list(im.getdata()); n = len(px)
luma = sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in px) / n
near = [sum(1 for r, g, b in px if abs(r - c[0]) <= tol and abs(g - c[1]) <= tol and abs(b - c[2]) <= tol) / n for c in cols]
print(json.dumps({'luma': round(luma, 1), 'near': [round(v, 4) for v in near], 'colors': len(set(px))}))
