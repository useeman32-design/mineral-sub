#!/usr/bin/env node
/**
 * Stamp a cache-busting version onto every local asset URL.
 *
 * GitHub Pages serves assets with `cache-control: max-age=600` and no
 * fingerprinting, so a browser that has loaded the app keeps using its cached
 * CSS/JS after a deploy — making a shipped fix look like it never landed.
 *
 * This stamps `?v=<short sha>` onto:
 *   - <link href> / <script src> for local css, js and vendor files in index.html
 *   - every relative `import ... from '...'` specifier inside js/ ** /*.js
 *
 * ES modules are fetched by their own URL, so versioning main.js alone is not
 * enough: each submodule needs its own stamp or the browser reuses the old copy.
 *
 * Run before committing a deploy:  node tools/stamp-version.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function shortSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return 'dev';
  }
}

/** Recursively collect every .js file under a directory. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function stampIndex(version) {
  const file = path.join(ROOT, 'index.html');
  const src = fs.readFileSync(file, 'utf8');

  const out = src
    .replace(/(href)="((?:css|vendor)\/[^"?]+)(?:\?v=[^"]*)?"/g,
      (_, attr, url) => `${attr}="${url}?v=${version}"`)
    .replace(/(src)="((?:js|vendor)\/[^"?]+)(?:\?v=[^"]*)?"/g,
      (_, attr, url) => `${attr}="${url}?v=${version}"`);

  if (out !== src) { fs.writeFileSync(file, out); return 1; }
  return 0;
}

/** Append ?v= to relative import specifiers so submodules revalidate too. */
function stampModules(version) {
  let changed = 0;
  // from '...'  /  import '...'  /  import('...')
  const re = /(from\s+|import\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+?\.js)(?:\?v=[^'"]*)?\2/g;

  for (const file of walk(path.join(ROOT, 'js'))) {
    const src = fs.readFileSync(file, 'utf8');
    const out = src.replace(re, (_, kw, q, p) => `${kw}${q}${p}?v=${version}${q}`);
    if (out !== src) { fs.writeFileSync(file, out); changed += 1; }
  }
  return changed;
}

const version = shortSha();
const idx = stampIndex(version);
const mods = stampModules(version);
console.log(`stamped ?v=${version} -> index.html:${idx} js modules:${mods}`);
