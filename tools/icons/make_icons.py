"""Draws the Warbler app icons (a small yellow bird) as PNG files.

Only the Python standard library is used, so it runs anywhere with
`python3 tools/icons/make_icons.py`. Shapes are drawn on a 100 x 100 grid and
anti-aliased by sampling 4 x 4 points per pixel. The same shapes are written
by hand in web/static/favicon.svg.

Output (web/static/icons/): icon-180.png, icon-192.png, icon-512.png and
icon-maskable-512.png. The bird sits inside the central 70 percent so the
maskable version survives any rounded or circular crop.
"""

import math
import struct
import sys
import zlib
from pathlib import Path

BG = (0xF4, 0xE9, 0xCF)  # warm cream
BODY = (0xF0, 0xC0, 0x30)  # warbler yellow
WING = (0xC9, 0x93, 0x1B)  # darker gold
BEAK = (0xDB, 0x7A, 0x36)  # orange
EYE = (0x2B, 0x21, 0x18)  # dark brown
BELLY = (0xFB, 0xE3, 0x8A)  # pale yellow


def ellipse(cx, cy, rx, ry, angle=0.0):
    ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))

    def inside(x, y):
        dx, dy = x - cx, y - cy
        u, v = dx * ca + dy * sa, -dx * sa + dy * ca
        return (u / rx) ** 2 + (v / ry) ** 2 <= 1.0

    return inside


def polygon(points):
    def inside(x, y):
        hit = False
        j = len(points) - 1
        for i, (xi, yi) in enumerate(points):
            xj, yj = points[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                hit = not hit
            j = i
        return hit

    return inside


# Drawn back to front. Coordinates are on a 100 x 100 grid, bird facing right.
SHAPES = [
    (polygon([(30, 58), (12, 46), (10, 66)]), WING),  # tail
    (ellipse(48, 58, 24, 18, -8), BODY),  # body
    (ellipse(52, 64, 15, 9, -8), BELLY),  # belly
    (ellipse(66, 42, 13, 13), BODY),  # head
    (polygon([(77, 39), (92, 45), (77, 49)]), BEAK),  # beak
    (ellipse(44, 55, 14, 8, -20), WING),  # wing
    (ellipse(70, 40, 2.6, 2.6), EYE),  # eye
]


def render(size, scale=0.70):
    """Return rows of RGB bytes for a size x size icon."""
    off = (100 - 100 * scale) / 2
    rows = []
    ss = 4
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = 0
            for sy in range(ss):
                for sx in range(ss):
                    # Position on the icon's 100 x 100 grid, then into the
                    # bird's own (scaled, centred) coordinates.
                    gx = (px + (sx + 0.5) / ss) / size * 100
                    gy = (py + (sy + 0.5) / ss) / size * 100
                    x, y = (gx - off) / scale, (gy - off) / scale + 6  # +6 lifts the bird to optical centre
                    colour = BG
                    for inside, c in SHAPES:
                        if inside(x, y):
                            colour = c
                    r += colour[0]
                    g += colour[1]
                    b += colour[2]
            n = ss * ss
            row += bytes((r // n, g // n, b // n))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + row for row in rows)  # filter type 0 per row

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    out = Path(__file__).resolve().parents[2] / "web" / "static" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    for name, size, scale in [
        ("icon-180.png", 180, 0.78),
        ("icon-192.png", 192, 0.78),
        ("icon-512.png", 512, 0.78),
        ("icon-maskable-512.png", 512, 0.62),
    ]:
        write_png(out / name, size, render(size, scale))
        print("wrote", out / name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
