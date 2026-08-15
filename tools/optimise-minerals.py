#!/usr/bin/env python3
"""
Crop and compress the generated mineral specimen images for web delivery.

The generator returns 1408x768 landscape PNGs at ~1.5 MB each. The cards show
a square thumbnail, so we centre-crop to square, resize to 480px and save a
palette-quantised PNG. That drops ~16 MB to well under 1 MB total without any
visible loss at the size the cards actually render.

Run:  python3 tools/optimise-minerals.py
"""
from pathlib import Path
from PIL import Image

SRC = Path(__file__).resolve().parent.parent / 'assets' / 'minerals'
SIZE = 480


def optimise(path: Path) -> tuple[int, int]:
    before = path.stat().st_size
    im = Image.open(path).convert('RGB')

    # Centre-crop to square. The specimen is centred in every generation, so a
    # centre crop keeps it whole.
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    im = im.crop((left, top, left + side, top + side))
    im = im.resize((SIZE, SIZE), Image.LANCZOS)

    # These are dark studio shots on black — an adaptive palette holds up well
    # and beats full-colour PNG by a wide margin.
    im = im.quantize(colors=192, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
    im.save(path, format='PNG', optimize=True)

    return before, path.stat().st_size


def main() -> None:
    total_before = total_after = 0
    for p in sorted(SRC.glob('*.png')):
        b, a = optimise(p)
        total_before += b
        total_after += a
        print(f'{p.name:16} {b/1024:8.0f} KB -> {a/1024:6.0f} KB')
    print(f'{"TOTAL":16} {total_before/1024:8.0f} KB -> {total_after/1024:6.0f} KB')


if __name__ == '__main__':
    main()
