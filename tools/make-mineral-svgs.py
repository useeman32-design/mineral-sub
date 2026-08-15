#!/usr/bin/env python3
"""
Generate procedural specimen artwork for the minerals that have no photograph.

The image generator caps at 10 images per session, so seven commodities need a
fallback. Rather than a flat colour tile, each gets a deterministic faceted
"crystal mass" built from seeded polygons — same dark studio framing, same
rim-lit look, so a card with an SVG sits beside a card with a photo without
looking like a placeholder.

Deterministic: the same commodity always produces the same specimen.

Run:  python3 tools/make-mineral-svgs.py
"""
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'minerals'
SIZE = 480

# base, highlight, shadow, glow — tuned per commodity to match RESOURCE_META
SPECS = {
    'oil':     ('#1b3b2f', '#3ddc91', '#08160f', '#00e676', 'core'),
    'gas':     ('#17384a', '#5eead4', '#071720', '#2dd8c3', 'core'),
    'kaolin':  ('#d8d2c8', '#fdfbf7', '#6f6a62', '#e8dfd2', 'mass'),
    'gypsum':  ('#cfd6da', '#f4f9fb', '#697276', '#dce6ea', 'blade'),
    'talc':    ('#c3ccc2', '#eef3ec', '#636b62', '#d4ddd2', 'mass'),
    'granite': ('#8d8f96', '#d5d7dc', '#3f4046', '#a9abb2', 'speckle'),
    'clay':    ('#9a6f4f', '#d3a276', '#4a3323', '#b98a63', 'mass'),
}


def facets(rnd, cx, cy, r, n):
    """A convex-ish blob of points to slice into facets."""
    pts = []
    for i in range(n):
        a = (i / n) * math.tau + rnd.uniform(-0.13, 0.13)
        rad = r * rnd.uniform(0.66, 1.0)
        pts.append((cx + math.cos(a) * rad, cy + math.sin(a) * rad * 0.82))
    return pts


def poly(pts, fill, op=1.0, stroke=None):
    d = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    s = f' stroke="{stroke}" stroke-width="1"' if stroke else ''
    return f'<polygon points="{d}" fill="{fill}" opacity="{op:.2f}"{s}/>'


def build(key, base, hi, sh, glow, style):
    rnd = random.Random(key)
    cx = cy = SIZE / 2
    out = []

    out.append(f'<rect width="{SIZE}" height="{SIZE}" fill="#050809"/>')
    out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="205" ry="180" fill="url(#g-{key})" opacity=".5"/>')

    if style == 'core':
        # Cylindrical drill core, upright, with a lit rim and pore speckle.
        w, h = 150, 300
        x, y = cx - w / 2, cy - h / 2
        out.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{w}" height="{h}" rx="12" fill="{base}"/>')
        out.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="34" height="{h}" rx="12" fill="{hi}" opacity=".26"/>')
        out.append(f'<rect x="{x + w - 26:.0f}" y="{y:.0f}" width="26" height="{h}" rx="12" fill="{sh}" opacity=".62"/>')
        out.append(f'<ellipse cx="{cx}" cy="{y:.0f}" rx="{w/2}" ry="17" fill="{hi}" opacity=".5"/>')
        out.append(f'<ellipse cx="{cx}" cy="{y + h:.0f}" rx="{w/2}" ry="17" fill="{sh}" opacity=".8"/>')
        for _ in range(150):
            px = rnd.uniform(x + 8, x + w - 8)
            py = rnd.uniform(y + 14, y + h - 14)
            out.append(f'<circle cx="{px:.0f}" cy="{py:.0f}" r="{rnd.uniform(1, 3.4):.1f}" '
                       f'fill="{glow}" opacity="{rnd.uniform(.1, .5):.2f}"/>')

    elif style == 'blade':
        # Bladed / tabular crystal habit.
        for i in range(18):
            a = rnd.uniform(-0.6, 0.6) + (i - 9) * 0.12
            ln, wd = rnd.uniform(130, 205), rnd.uniform(22, 46)
            dx, dy = math.cos(a - math.pi / 2), math.sin(a - math.pi / 2)
            px, py = math.cos(a), math.sin(a)
            ox, oy = cx + rnd.uniform(-52, 52), cy + rnd.uniform(-40, 40)
            p = [(ox + dx * ln / 2 + px * wd / 2, oy + dy * ln / 2 + py * wd / 2),
                 (ox + dx * ln / 2 - px * wd / 2, oy + dy * ln / 2 - py * wd / 2),
                 (ox - dx * ln / 2 - px * wd / 2, oy - dy * ln / 2 - py * wd / 2),
                 (ox - dx * ln / 2 + px * wd / 2, oy - dy * ln / 2 + py * wd / 2)]
            out.append(poly(p, base if i % 2 else hi, rnd.uniform(.62, .95), sh))

    else:
        # Faceted mineral mass: overlapping shards, lit from upper-left.
        for ring, (r, n, op) in enumerate([(178, 11, .85), (132, 9, .9), (86, 8, .95)]):
            pts = facets(rnd, cx, cy, r, n)
            out.append(poly(pts, sh if ring == 0 else base, op))
            for i in range(len(pts)):
                a, bpt = pts[i], pts[(i + 1) % len(pts)]
                mid = (cx + (a[0] - cx) * .34, cy + (a[1] - cy) * .34)
                lit = (a[0] + a[1]) < (cx + cy)  # upper-left facets catch light
                out.append(poly([a, bpt, mid], hi if lit else sh,
                                rnd.uniform(.24, .62) if lit else rnd.uniform(.3, .7)))

        if style == 'speckle':
            for _ in range(240):
                a, rr = rnd.uniform(0, math.tau), rnd.uniform(0, 158)
                px, py = cx + math.cos(a) * rr, cy + math.sin(a) * rr * .84
                c = rnd.choice([hi, sh, '#2c2f36', glow])
                out.append(f'<circle cx="{px:.0f}" cy="{py:.0f}" r="{rnd.uniform(1.4, 4.6):.1f}" '
                           f'fill="{c}" opacity="{rnd.uniform(.3, .85):.2f}"/>')

    # Rim light + vignette to match the photographed specimens.
    out.append(f'<ellipse cx="{cx - 46}" cy="{cy - 54}" rx="112" ry="86" fill="{hi}" opacity=".1"/>')
    out.append(f'<rect width="{SIZE}" height="{SIZE}" fill="url(#v-{key})"/>')

    defs = (f'<defs>'
            f'<radialGradient id="g-{key}" cx="38%" cy="32%">'
            f'<stop offset="0" stop-color="{glow}" stop-opacity=".5"/>'
            f'<stop offset="1" stop-color="{glow}" stop-opacity="0"/></radialGradient>'
            f'<radialGradient id="v-{key}" cx="50%" cy="50%">'
            f'<stop offset=".55" stop-color="#000" stop-opacity="0"/>'
            f'<stop offset="1" stop-color="#000" stop-opacity=".8"/></radialGradient>'
            f'</defs>')

    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" '
            f'width="{SIZE}" height="{SIZE}" role="img" aria-label="{key} specimen">'
            f'{defs}{"".join(out)}</svg>')


def main() -> None:
    for key, (base, hi, sh, glow, style) in SPECS.items():
        svg = build(key, base, hi, sh, glow, style)
        p = OUT / f'{key}.svg'
        p.write_text(svg)
        print(f'{p.name:16} {len(svg)/1024:6.1f} KB  ({style})')


if __name__ == '__main__':
    main()
