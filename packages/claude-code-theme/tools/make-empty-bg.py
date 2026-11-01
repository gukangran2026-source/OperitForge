"""Generate one empty-state background per greeting, in light and dark.

Every greeting gets its own image so the runtime only has to swap a file path.
Each image is a flat color with exactly two ink areas (the mark and the
greeting); everything else is one uniform color, which is what keeps PNG small.

Anti-aliasing: PIL's polygon fill is hard-edged, so the art is rendered at 3x and
downsampled with Lanczos. That produces genuine smooth edges instead of the
stair-stepped output of a direct 1x render.

The greeting list is read from src/greetings.ts so the art can never drift out of
sync with the code that selects it.
"""
import os
import re

from PIL import Image, ImageDraw, ImageFont

SVG = '/root/ovl/claude.svg'
FONT = '/storage/emulated/0/Download/Claude字体/ClaudeSans.ttf'
ROOT = '/sdcard/Download/Operit/dev_package/local.operit.claude_code_theme'
OUT = os.path.join(ROOT, 'resources', 'empty3')

W, H = 1080, 2400
# Measured from the official app screenshot.
MARK_CENTER_Y = 0.4323
MARK_WIDTH_RATIO = 0.10
GAP_PX = 54
TEXT_SIZE = 64
# Render at Nx then downsample; this is what removes the jaggies.
SUPERSAMPLE = 3
# 16 colors holds the anti-aliased edge ramps without visible banding.
COLORS = 16

LIGHT = {'bg': (250, 249, 245), 'mark': (184, 83, 53), 'text': (61, 58, 50), 'suffix': 'light'}
DARK = {'bg': (28, 27, 25), 'mark': (217, 119, 87), 'text': (232, 230, 220), 'suffix': 'dark'}


def greetings():
    """(id, text) pairs for every greeting the grid can show.

    Parses src/greetings.ts for `{ id: '...', text: '...', ... }` entries and
    appends the habit-only night-owl line, which is produced by code rather than
    by a table row.
    """
    src = open(os.path.join(ROOT, 'src', 'greetings.ts'), encoding='utf-8').read()
    pattern = r"\{ id: '([a-z0-9-]+)', text: '([^']+)'"
    seen = {}
    out = []
    for entry_id, text in re.findall(pattern, src):
        if entry_id in seen:
            continue
        seen[entry_id] = text
        out.append((entry_id, text))
    # Reachable through the habit branch, so it needs art of its own.
    if 'night-owl' not in seen:
        out.append(('night-owl', '你好，夜猫子'))
    if not out:
        raise SystemExit('no greeting text found in src/greetings.ts')
    return out


def slug(index):
    """Stable file name per greeting slot, e.g. slot00-light.png.

    Indexed names avoid encoding Chinese into paths (which truncated on some
    filesystems) and keep the mirrored directory free of stale files: the
    runtime derives the same index from the selected slot, so only the current
    set of names is ever referenced.
    """
    return 'slot%02d' % index


def svg_path():
    data = open(SVG, encoding='utf-8').read()
    return re.search(r'd="([^"]+)"', data).group(1)


def draw_svg(draw, d, ox, oy, scale, fill):
    """Render the subset of SVG path commands used by the Claude mark."""
    tokens = re.findall(r'[MmLlHhVvCcZz]|-?\d*\.?\d+', d)
    i = 0
    cmd = None
    cx = cy = sx = sy = 0.0
    pts = []

    def num():
        nonlocal i
        v = float(tokens[i])
        i += 1
        return v

    while i < len(tokens):
        t = tokens[i]
        if t.isalpha():
            cmd = t
            i += 1
            if cmd in 'Zz':
                if pts:
                    draw.polygon(pts, fill=fill)
                    pts = []
                cx, cy = sx, sy
            continue

        rel = cmd.islower()
        up = cmd.upper()
        if up == 'M':
            x, y = num(), num()
            if rel:
                x, y = cx + x, cy + y
            pts.append((ox + x * scale, oy + y * scale))
            cx, cy = x, y
            sx, sy = x, y
            cmd = 'l' if rel else 'L'
        elif up == 'L':
            x, y = num(), num()
            if rel:
                x, y = cx + x, cy + y
            pts.append((ox + x * scale, oy + y * scale))
            cx, cy = x, y
        elif up == 'H':
            x = num()
            if rel:
                x = cx + x
            pts.append((ox + x * scale, oy + cy * scale))
            cx = x
        elif up == 'V':
            y = num()
            if rel:
                y = cy + y
            pts.append((ox + cx * scale, oy + y * scale))
            cy = y
        elif up == 'C':
            x1, y1, x2, y2, x3, y3 = (num() for _ in range(6))
            if rel:
                x1, y1 = cx + x1, cy + y1
                x2, y2 = cx + x2, cy + y2
                x3, y3 = cx + x3, cy + y3
            x0, y0 = cx, cy
            # Flatten generously; the supersampled downsample hides the seams.
            steps = 16
            for s in range(1, steps + 1):
                u = s / steps
                mu = 1 - u
                bx = mu ** 3 * x0 + 3 * mu ** 2 * u * x1 + 3 * mu * u ** 2 * x2 + u ** 3 * x3
                by = mu ** 3 * y0 + 3 * mu ** 2 * u * y1 + 3 * mu * u ** 2 * y2 + u ** 3 * y3
                pts.append((ox + bx * scale, oy + by * scale))
            cx, cy = x3, y3

    if pts:
        draw.polygon(pts, fill=fill)


def build(cfg, text, stem):
    ss = SUPERSAMPLE
    w, h = W * ss, H * ss
    img = Image.new('RGB', (w, h), cfg['bg'])
    draw = ImageDraw.Draw(img)

    mark_px = int(W * MARK_WIDTH_RATIO) * ss
    mark_cy = H * MARK_CENTER_Y * ss
    draw_svg(
        draw, svg_path(),
        (w - mark_px) / 2.0, mark_cy - mark_px / 2.0,
        mark_px / 24.0, cfg['mark'],
    )

    if text:
        font = ImageFont.truetype(FONT, TEXT_SIZE * ss)
        bbox = draw.textbbox((0, 0), text, font=font)
        tx = (w - (bbox[2] - bbox[0])) / 2.0 - bbox[0]
        ty = mark_cy + mark_px / 2.0 + GAP_PX * ss - bbox[1]
        draw.text((tx, ty), text, font=font, fill=cfg['text'])

    # Downsample to the real size: this is the anti-aliasing step.
    img = img.resize((W, H), Image.LANCZOS)

    # Everything except the two ink areas is one flat color, so a modest palette
    # captures the edge ramps and still compresses to ~10 KB.
    q = img.quantize(colors=COLORS, method=Image.MEDIANCUT, dither=Image.NONE)
    path = os.path.join(OUT, stem + '-' + cfg['suffix'] + '.png')
    q.save(path, optimize=True)
    return path, os.path.getsize(path)


def build_text_only(cfg, text, stem):
    """Slogan without the starburst, for icon-off / text-on."""
    ss = SUPERSAMPLE
    w, h = W * ss, H * ss
    img = Image.new('RGB', (w, h), cfg['bg'])
    draw = ImageDraw.Draw(img)
    mark_px = int(W * MARK_WIDTH_RATIO) * ss
    mark_cy = H * MARK_CENTER_Y * ss

    font = ImageFont.truetype(FONT, TEXT_SIZE * ss)
    bbox = draw.textbbox((0, 0), text, font=font)
    tx = (w - (bbox[2] - bbox[0])) / 2.0 - bbox[0]
    # Keep the baseline where it sits when the mark is present, so toggling the
    # icon does not make the text jump.
    ty = mark_cy + mark_px / 2.0 + GAP_PX * ss - bbox[1]
    draw.text((tx, ty), text, font=font, fill=cfg['text'])

    img = img.resize((W, H), Image.LANCZOS)
    q = img.quantize(colors=COLORS, method=Image.MEDIANCUT, dither=Image.NONE)
    path = os.path.join(OUT, 'text-' + stem + '-' + cfg['suffix'] + '.png')
    q.save(path, optimize=True)
    return path, os.path.getsize(path)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    # Stale art is overwritten in place rather than deleted up front: these files
    # may be held open by another process, and unlink then fails with EBUSY.
    items = greetings()
    total = 0
    biggest = 0
    count = 0
    for stem, text in items:
        for cfg in (LIGHT, DARK):
            _, size = build(cfg, text, stem)
            total += size
            count += 1
            biggest = max(biggest, size)
            _, size = build_text_only(cfg, text, stem)
            total += size
            count += 1
            biggest = max(biggest, size)
    # Icon-only art is the same for every greeting, so it is emitted once.
    for cfg in (LIGHT, DARK):
        _, size = build(cfg, None, 'mark')
        total += size
        count += 1
        biggest = max(biggest, size)
    print('greetings:', len(items))
    for stem, text in items:
        print('  %-14s = %s' % (stem, text))
    print('images:', count, '(%d x2 with-text, %d x2 text-only, 2 icon-only)'
          % (len(items), len(items)))
    print('total bytes:', total, '(%.2f MB)' % (total / 1048576))
    print('largest image:', biggest)