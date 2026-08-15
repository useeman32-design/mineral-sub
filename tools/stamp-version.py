#!/usr/bin/env python3
"""
Stamp a cache-busting version onto every local asset URL.

GitHub Pages serves assets with `cache-control: max-age=600` and no
fingerprinting, so a browser that has loaded the app will keep using its cached
CSS/JS for ten minutes after a deploy -- and an aggressive cache can hold on far
longer. That makes a shipped fix look like it never landed.

This stamps `?v=<short sha>` onto:
  - <link href> / <script src> for local css, js and vendor files in index.html
  - every relative `import ... from '...'` specifier inside js/**.js

ES modules are fetched by their own URL, so versioning main.js alone is not
enough: each submodule needs its own stamp or the browser reuses the old copy.

Run before committing a deploy:  python3 tools/stamp-version.py
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def short_sha() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT
        ).decode().strip()
    except subprocess.CalledProcessError:
        return "dev"


def stamp_index(version: str) -> int:
    path = ROOT / "index.html"
    src = path.read_text()

    def repl(m):
        attr, url = m.group(1), m.group(2).split("?")[0]
        return f'{attr}="{url}?v={version}"'

    out = src
    for pattern in (
        r'(href)="((?:css|vendor)/[^"]+)"',
        r'(src)="((?:js|vendor)/[^"]+)"',
    ):
        out = re.sub(pattern, repl, out)

    if out != src:
        path.write_text(out)
        return 1
    return 0


def stamp_modules(version: str) -> int:
    """Append ?v= to relative import specifiers so submodules revalidate too."""
    changed = 0
    # from '...'  /  import '...'  /  import('...')
    pattern = re.compile(
        r"""(from\s+|import\s*\(?\s*)(['"])(\.{1,2}/[^'"]+?\.js)(?:\?v=[^'"]*)?\2"""
    )

    for f in sorted((ROOT / "js").rglob("*.js")):
        src = f.read_text()
        out = pattern.sub(lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}?v={version}{m.group(2)}", src)
        if out != src:
            f.write_text(out)
            changed += 1
    return changed


def main() -> int:
    version = short_sha()
    idx = stamp_index(version)
    mods = stamp_modules(version)
    print(f"stamped ?v={version} -> index.html:{idx} js modules:{mods}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
