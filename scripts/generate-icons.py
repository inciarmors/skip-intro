"""Render the project's existing skip glyph to portable, antialiased PNG icons.

Uses only the Python standard library. No image generation service or media input.
The SVG source and raster geometry use the same 28-unit coordinate system.
"""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1] / "extension" / "icons"
ROOT.mkdir(exist_ok=True)
SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
  <rect x="0.5" y="0.5" width="27" height="27" rx="6" fill="#fbfbfb" stroke="#b8b8b8" stroke-width="0.5"/>
  <g transform="translate(4 4) scale(0.7142857143)" fill="#080808">
    <path d="M2 5v18l10-9z M12 5v18l10-9z M23 5h3v18h-3z"/>
  </g>
</svg>
'''
(ROOT / "icon.svg").write_text(SVG, encoding="utf-8")


def rounded(x, y, left, right, radius):
    if x < left or y < left or x > right or y > right:
        return False
    cx = max(left + radius, min(right - radius, x))
    cy = max(left + radius, min(right - radius, y))
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2


def color(x, y):
    if not rounded(x, y, 0.25, 27.75, 6.25):
        return (0, 0, 0, 0)
    if not rounded(x, y, 0.75, 27.25, 5.75):
        return (184, 184, 184, 255)
    gx, gy = (x - 4) * 1.4, (y - 4) * 1.4
    triangle = 5 <= gy <= 23 and any(left <= gx <= left + 10 * (1 - abs(gy - 14) / 9) for left in (2, 12))
    bar = 23 <= gx <= 26 and 5 <= gy <= 23
    return (8, 8, 8, 255) if triangle or bar else (251, 251, 251, 255)


def chunk(kind, data):
    return struct.pack("!I", len(data)) + kind + data + struct.pack("!I", zlib.crc32(kind + data) & 0xffffffff)


for size in (16, 32, 48, 96, 128):
    rows = bytearray()
    scale = 4
    for y in range(size):
        rows.append(0)
        for x in range(size):
            samples = [color((x + (sx + 0.5) / scale) * 28 / size, (y + (sy + 0.5) / scale) * 28 / size) for sy in range(scale) for sx in range(scale)]
            alpha = sum(p[3] for p in samples)
            rgb = [round(sum(p[c] * p[3] for p in samples) / alpha) if alpha else 0 for c in range(3)]
            rows.extend((*rgb, round(alpha / len(samples))))
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack("!2I5B", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")
    (ROOT / f"icon-{size}.png").write_bytes(data)
