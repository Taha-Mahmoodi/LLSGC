// Generates a simple LLSGC app + tray icon as a PNG.
// Run once after `npm install` (pngjs is a devDep). Output:
//   resources/icon.png    256x256 (window / installer)
//   resources/tray.png    32x32  (system tray)
//
// Re-run any time you want to tweak the look. Both files get
// committed to the repo.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'resources');
mkdirSync(out, { recursive: true });

writeIcon(256, path.join(out, 'icon.png'));
writeIcon(32, path.join(out, 'tray.png'), { simpler: true });

console.log(`✓ wrote ${path.relative(root, path.join(out, 'icon.png'))}`);
console.log(`✓ wrote ${path.relative(root, path.join(out, 'tray.png'))}`);

function writeIcon(size, outPath, opts = {}) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.46;
  const innerR = size * 0.18;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let R = 0, G = 0, B = 0, A = 0;

      if (dist <= r) {
        // Outer disc — accent gradient (top-left brighter, bottom-right darker)
        const grad = 1 - (dx + dy) / (size * 1.4);
        const t = Math.max(0, Math.min(1, grad));
        const accentR = 110, accentG = 168, accentB = 254;
        const darkR = 60, darkG = 96, darkB = 200;
        R = Math.round(accentR * t + darkR * (1 - t));
        G = Math.round(accentG * t + darkG * (1 - t));
        B = Math.round(accentB * t + darkB * (1 - t));
        A = 255;

        // Soft edge anti-aliasing
        const fade = r - dist;
        if (fade < 1.5) A = Math.round(255 * (fade / 1.5));
      }

      // Inner mark — a small "L" / activity glyph: a centered dark dot
      // plus a horizontal bar offset slightly down-right (suggests a
      // baseline + signal blip).
      if (!opts.simpler && dist <= r) {
        const bx = x - (cx + size * 0.04);
        const by = y - (cy + size * 0.18);
        const inBar =
          bx >= -size * 0.12 &&
          bx <= size * 0.12 &&
          by >= -size * 0.018 &&
          by <= size * 0.018;
        if (inBar) {
          R = 10; G = 11; B = 15; A = 255;
        }
      }

      if (dist <= innerR) {
        R = 10; G = 11; B = 15; A = 255;
      }

      png.data[idx] = R;
      png.data[idx + 1] = G;
      png.data[idx + 2] = B;
      png.data[idx + 3] = A;
    }
  }

  const buffer = PNG.sync.write(png);
  writeFileSync(outPath, buffer);
}
