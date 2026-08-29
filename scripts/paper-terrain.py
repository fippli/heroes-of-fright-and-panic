"""Compose paper-map terrain tiles: parchment base × terrain tint + transparent ink marks from PixelLab.

Usage: python3 scripts/paper-terrain.py [generated/paper]
Writes <dir>/<key>-v9.png for grass, sand, water, farm, unexplored (pick 9 in picks.json).
Ink-mark overlays are generated once into <dir>/marks/ and reused.
"""
import base64, json, os, sys, urllib.request
from PIL import Image, ImageChops, ImageDraw

out = sys.argv[1] if len(sys.argv) > 1 else "generated/paper"
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 128
BASE_DIR = sys.argv[3] if len(sys.argv) > 3 else out  # where to look for a clean parchment base
marks_dir = os.path.join(out, "marks")
os.makedirs(marks_dir, exist_ok=True)

SUFFIX = "hand-drawn ink marks, sepia ink, fantasy paper map style, transparent background, spread evenly across the whole canvas, no border"
MARKS = {
    "grass": f"many tiny scattered ink grass tufts, {SUFFIX}",
    "sand": f"many tiny scattered ink dots and small dune strokes, {SUFFIX}",
    "water": f"many small scattered ink wave marks, {SUFFIX}",
    "farm": f"parallel hand-drawn ink crop rows with small plant strokes, {SUFFIX}",
    "unexplored": f"faint wispy ink fog swirls, {SUFFIX}",
}
# Tint colour and strength (0-1) multiplied onto the parchment
TINTS = {
    "grass": ((150, 175, 110), 0.55),
    "sand": ((225, 195, 120), 0.45),
    "water": ((110, 150, 175), 0.65),
    "farm": ((200, 165, 95), 0.5),
    "unexplored": ((120, 110, 95), 0.6),
}

def api_key():
    k = os.environ.get("PIXELLAB_API_KEY")
    if k: return k
    return json.load(open(os.path.expanduser("~/.config/com.fippli.pixellab/settings.json")))["api_key"]

def generate_mark(key, seed):
    path = os.path.join(marks_dir, f"{key}.png")
    if os.path.exists(path): return path
    palette = base64.b64encode(open(os.path.join(out, "palette.png"), "rb").read()).decode()
    body = {
        "description": f"{MARKS[key]}, pixel art",
        "image_size": {"width": SIZE, "height": SIZE},
        "text_guidance_scale": 8, "outline": "single color outline", "shading": "flat shading",
        "detail": "low detail", "view": "high top-down", "isometric": False, "no_background": True,
        **({"shading": "flat shading"} if SIZE <= 48 else {}),
        "seed": seed, "color_image": {"type": "base64", "base64": palette},
    }
    req = urllib.request.Request("https://api.pixellab.ai/v1/generate-image-pixflux", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {api_key()}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.load(r)
    b64 = data["image"]["base64"].split(",")[-1]
    open(path, "wb").write(base64.b64decode(b64))
    print("generated mark", key)
    return path

def flat_noisy_base():
    """Flat parchment with faint 2-tone noise: no stains or repeated features to spot across hexes."""
    import random
    rng = random.Random(7)
    im = Image.new("RGBA", (SIZE, SIZE), (236, 222, 190, 255))
    px = im.load()
    for y in range(SIZE):
        for x in range(SIZE):
            if rng.random() < 0.18:
                px[x, y] = (228, 213, 178, 255)
    return im

def parchment_base():
    if SIZE <= 48:
        return flat_noisy_base()
    # Cleanest blank parchment we have; fall back to a flat colour
    for cand in ("grass-v3.png", "unexplored-v1.png", "farm-v1.png"):
        p = os.path.join(BASE_DIR, cand)
        if os.path.exists(p): return Image.open(p).convert("RGBA").resize((SIZE, SIZE), Image.NEAREST)
    return Image.new("RGBA", (SIZE, SIZE), (236, 222, 190, 255))

def darker(rgb, f=0.72):
    return tuple(int(c * f) for c in rgb) + (255,)

def procedural_marks(key, tile):
    """Tiny deterministic pixel marks for small tiles, where generated marks turn to noise."""
    import random
    rng = random.Random(hash(key) & 0xffff)
    d = ImageDraw.Draw(tile)
    ink = darker(TINTS[key][0])
    n = max(2, SIZE // 12)
    for _ in range(n):
        x, y = rng.randrange(1, SIZE - 3), rng.randrange(1, SIZE - 3)
        if key == "grass":       # small V tufts
            d.point([(x, y + 1), (x + 1, y), (x + 2, y + 1)], fill=ink)
        elif key == "sand":      # sparse dots
            d.point([(x, y)], fill=ink)
        elif key == "water":     # short wave dashes
            d.line([(x, y), (x + 2, y)], fill=ink)
            d.point([(x + 3, y - 1)], fill=ink)
    if key == "farm":            # crop rows
        for x in range(2, SIZE - 1, 4):
            d.line([(x, 1), (x, SIZE - 2)], fill=ink)
    return tile

def compose(key, base):
    tint, strength = TINTS[key]
    tinted = ImageChops.multiply(base, Image.new("RGBA", base.size, tint + (255,)))
    tile = Image.blend(base, tinted, strength)
    if SIZE <= 48:
        tile = procedural_marks(key, tile)
        path = os.path.join(out, f"{key}-v9.png")
        tile.save(path)
        return path
    mark = Image.open(generate_mark(key, 4200 + len(key))).convert("RGBA").resize((SIZE, SIZE), Image.NEAREST)
    # Soften marks a bit so they read as ink on paper, not stickers
    alpha = mark.getchannel("A").point(lambda a: int(a * 0.85))
    mark.putalpha(alpha)
    tile.alpha_composite(mark)
    path = os.path.join(out, f"{key}-v9.png")
    tile.save(path)
    return path

base = parchment_base()
paths = [compose(k, base) for k in MARKS]
sheet = Image.new("RGBA", (len(paths) * (SIZE + 6), SIZE), (40, 40, 40, 255))
for i, p in enumerate(paths):
    sheet.alpha_composite(Image.open(p).convert("RGBA"), (i * (SIZE + 6), 0))
    ImageDraw.Draw(sheet).text((i * (SIZE + 6) + 4, 4), os.path.basename(p)[:-7], fill=(255, 255, 0, 255))
sheet.save(os.path.join(out, "sheet-composed.png"))
print("composed:", [os.path.basename(p) for p in paths])
