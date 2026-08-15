/**
 * Placeholder module factory.
 * Every not-yet-built module renders through here so the design language stays
 * identical across the app. Replacing one is a one-line change in main.js.
 */

import { icon } from '../core/icons.js?v=a404c97';

export function createStub({ title, glyph, blurb, features = [], tag = 'In development' }) {
  return () => ({
    mount(view) {
      view.innerHTML = `
        <div class="stub">
          <div class="stub-inner">
            <div class="stub-glyph">${icon(glyph, { size: 34, sw: 1.4 })}</div>
            <span class="stub-tag">${tag}</span>
            <h2>${title}</h2>
            <p>${blurb}</p>
            <div class="stub-feats">
              ${features.map((f) => `<span class="stub-feat">${f}</span>`).join('')}
            </div>
          </div>
        </div>`;
    },
  });
}
