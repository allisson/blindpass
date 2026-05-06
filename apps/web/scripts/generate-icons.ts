import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svgPath = resolve(root, 'public/favicon.svg');
const svg = readFileSync(svgPath);

const SAFE_ZONE = 0.8; // 80% of canvas = ~10% padding each side (maskable safe zone)

async function generateIcon(size: number, outFile: string, maskable = false) {
  const canvas = maskable ? Math.round(size / SAFE_ZONE) : size;
  const padding = maskable ? Math.round((canvas - size) / 2) : 0;

  const icon = await sharp(svg, { density: 300 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  if (maskable) {
    await sharp({
      create: {
        width: canvas,
        height: canvas,
        channels: 4,
        background: { r: 91, g: 33, b: 182, alpha: 1 }, // #5b21b6 — matches SVG rect fill
      },
    })
      .composite([{ input: icon, top: padding, left: padding }])
      .png()
      .toFile(outFile);
  } else {
    await sharp(icon).png().toFile(outFile);
  }

  console.log(`Generated ${outFile}`);
}

await generateIcon(192, resolve(root, 'public/icons/icon-192.png'));
await generateIcon(512, resolve(root, 'public/icons/icon-512.png'));
await generateIcon(180, resolve(root, 'public/icons/icon-180.png'));
await generateIcon(512, resolve(root, 'public/icons/icon-512-maskable.png'), true);
