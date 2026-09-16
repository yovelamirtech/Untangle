// Asset generator: rasterizes the SVG source-of-truth logos (assets/game_logo,
// assets/studio_logo) into the PNGs the app actually loads.
// Re-run with `node scripts/generate-icons.mjs` whenever a source SVG changes.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(root, '..', 'assets');

const jobs = [
  // App icon (home screen) + native splash image: the game's own mark.
  { svg: 'game_logo/icon-main.svg', out: 'icon.png', width: 1024, height: 1024 },
  { svg: 'game_logo/icon-main.svg', out: 'splash-icon.png', width: 1024, height: 1024 },
  // Studio splash asset used by the animated StudioSplashScreen component.
  // icon-appstore.svg (not icon-primary.svg) — same mark without the
  // cartridge-notch rect on top, which read as a stray purple bar here.
  { svg: 'studio_logo/icon-appstore.svg', out: 'studio-splash-logo.png', width: 1024, height: 1024 },
  // Main menu wordmark (icon + "Untangle" title) — 640x200 source, scaled 2x.
  { svg: 'game_logo/wordmark.svg', out: 'game-logo-wordmark.png', width: 1280, height: 400 },
];

for (const job of jobs) {
  const inPath = path.join(assets, job.svg);
  const outPath = path.join(assets, job.out);
  await sharp(inPath, { density: 384 })
    .resize(job.width, job.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  console.log(`wrote ${job.out}`);
}
