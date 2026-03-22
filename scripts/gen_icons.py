"""
Generate minimal placeholder PNG icons for the Chrome extension.
Creates solid orange circles with an hourglass shape on transparent background.
Uses only the Python standard library (struct + zlib).
Outputs: public/icons/icon16.png, icon48.png, icon128.png
"""

import struct
import zlib
import math
from pathlib import Path


def make_png(width, height, pixels):
    """
    Create a valid PNG file from RGBA pixel data.
    pixels[y][x] = (r, g, b, a)
    """

    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = zlib.crc32(c) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + c + struct.pack(">I", crc)

    # PNG signature
    signature = b"\x89PNG\r\n\x1a\n"

    # IHDR: width, height, bit depth 8, color type 6 (RGBA)
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    ihdr = chunk(b"IHDR", ihdr_data)

    # IDAT: image data
    raw = b""
    for y in range(height):
        raw += b"\x00"  # filter type: None
        for x in range(width):
            r, g, b, a = pixels[y][x]
            raw += struct.pack("BBBB", r, g, b, a)
    compressed = zlib.compress(raw)
    idat = chunk(b"IDAT", compressed)

    # IEND
    iend = chunk(b"IEND", b"")

    return signature + ihdr + idat + iend


def generate_circle_icon(size):
    """
    Generate an orange circle with a subtle darker border on transparent background,
    with a white hourglass shape on top.
    """
    # Orange color: #F05A28 (a warm procrastination-fighting orange)
    fill_r, fill_g, fill_b = 240, 90, 40
    border_r, border_g, border_b = 200, 60, 20

    center = size / 2.0
    outer_radius = size / 2.0 - 0.5
    border_width = max(1.0, size / 16.0)
    inner_radius = outer_radius - border_width

    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            dx = x + 0.5 - center
            dy = y + 0.5 - center
            dist = math.sqrt(dx * dx + dy * dy)

            if dist <= inner_radius:
                # Inside the circle - solid fill with slight radial gradient
                t = dist / inner_radius if inner_radius > 0 else 0
                r = int(fill_r + (255 - fill_r) * 0.2 * (1 - t))
                g = int(fill_g + (140 - fill_g) * 0.2 * (1 - t))
                b = int(fill_b + (80 - fill_b) * 0.15 * (1 - t))
                row.append((min(r, 255), min(g, 255), min(b, 255), 255))
            elif dist <= outer_radius:
                # Border ring
                row.append((border_r, border_g, border_b, 255))
            elif dist <= outer_radius + 1.0:
                # Anti-alias the edge
                alpha = int(255 * max(0.0, outer_radius + 1.0 - dist))
                row.append((border_r, border_g, border_b, alpha))
            else:
                # Transparent
                row.append((0, 0, 0, 0))
        pixels.append(row)

    # Draw a simple hourglass/timer shape in white on top of the circle
    draw_hourglass(pixels, size, center, inner_radius)

    return pixels


def draw_hourglass(pixels, size, center, radius):
    """
    Draw a simple hourglass shape in white, centered on the icon.
    The hourglass is made of two triangles pinched at the center.
    """
    white = (255, 255, 255, 230)

    # Hourglass dimensions relative to icon
    hg_half_height = radius * 0.55
    hg_half_width = radius * 0.35
    neck = radius * 0.08  # minimum width at the center

    top = center - hg_half_height
    bottom = center + hg_half_height

    for y in range(size):
        for x in range(size):
            py = y + 0.5
            px = x + 0.5

            # Skip if outside hourglass vertical range
            if py < top or py > bottom:
                continue

            # t: 0 at center, 1 at top/bottom edges
            t = abs(py - center) / hg_half_height if hg_half_height > 0 else 0

            # Width: narrow at center, wide at top/bottom (quadratic curve)
            half_w = neck + (hg_half_width - neck) * (t * t)

            if abs(px - center) <= half_w:
                # Only draw if pixel is already inside the circle (has alpha > 0)
                if pixels[y][x][3] > 0:
                    pixels[y][x] = white


def main():
    sizes = [16, 48, 128]
    output_dir = Path(__file__).resolve().parent.parent / "public" / "icons"
    output_dir.mkdir(parents=True, exist_ok=True)

    for size in sizes:
        print(f"Generating {size}x{size} icon...")
        px = generate_circle_icon(size)
        png_data = make_png(size, size, px)
        out_path = output_dir / f"icon{size}.png"
        out_path.write_bytes(png_data)
        print(f"  Written: {out_path} ({len(png_data)} bytes)")

    print("Done!")


if __name__ == "__main__":
    main()
