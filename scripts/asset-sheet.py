"""Build a labelled contact sheet of generated assets: one row per asset key, one column per variant.
Usage: python3 scripts/asset-sheet.py [generated/assets] [out.png]
"""
import glob, os, re, sys
from PIL import Image, ImageDraw

src = sys.argv[1] if len(sys.argv) > 1 else "generated/assets"
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(src, "sheet.png")
files = sorted(glob.glob(os.path.join(src, "*-v*.png")))
rows = {}
for f in files:
    m = re.match(r"(.+)-v(\d+)\.png$", os.path.basename(f))
    if m:
        rows.setdefault(m.group(1), {})[int(m.group(2))] = f
keys = list(rows)
variants = max((max(v) for v in rows.values()), default=1)
cell, label_w, pad = 128, 150, 6
sheet = Image.new("RGBA", (label_w + variants * (cell + pad), len(keys) * (cell + pad)), (40, 40, 40, 255))
draw = ImageDraw.Draw(sheet)
for r, key in enumerate(keys):
    y = r * (cell + pad)
    draw.text((6, y + cell // 2 - 6), key, fill=(255, 255, 255, 255))
    for v in range(1, variants + 1):
        f = rows[key].get(v)
        if f:
            im = Image.open(f).convert("RGBA").resize((cell, cell), Image.NEAREST)
            x = label_w + (v - 1) * (cell + pad)
            checker = Image.new("RGBA", (cell, cell), (90, 90, 90, 255))
            sheet.paste(checker, (x, y))
            sheet.alpha_composite(im, (x, y))
            draw.text((x + 4, y + 4), f"v{v}", fill=(255, 255, 0, 255))
sheet.save(out)
print(out, sheet.size, f"{len(keys)} keys x {variants} variants")
