// One-off script: generates HIREON app icon PNGs from an inline SVG monogram.
// Run: node scripts/gen-icon.js   (needs `sharp`, installed with --no-save for this)
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const BRAND_RED = '#C62828';
const H_PATH = 'M27,27 L43,27 L43,81 L27,81 Z M65,27 L81,27 L81,81 L65,81 Z M27,46 L81,46 L81,62 L27,62 Z';

const squareSvg = `
<svg width="108" height="108" viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="108" height="108" rx="22" ry="22" fill="${BRAND_RED}"/>
  <path fill="#FFFFFF" d="${H_PATH}"/>
</svg>`;

const roundSvg = `
<svg width="108" height="108" viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg">
  <circle cx="54" cy="54" r="54" fill="${BRAND_RED}"/>
  <path fill="#FFFFFF" d="${H_PATH}"/>
</svg>`;

const flatStoreSvg = `
<svg width="108" height="108" viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="108" height="108" fill="${BRAND_RED}"/>
  <path fill="#FFFFFF" d="${H_PATH}"/>
</svg>`;

const mipmapSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const resRoot = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const storeRoot = path.join(__dirname, '..', 'store-assets');
fs.mkdirSync(storeRoot, { recursive: true });

async function run() {
  for (const [dir, size] of Object.entries(mipmapSizes)) {
    const dirPath = path.join(resRoot, dir);
    fs.mkdirSync(dirPath, { recursive: true });
    await sharp(Buffer.from(squareSvg)).resize(size, size).png().toFile(path.join(dirPath, 'ic_launcher.png'));
    await sharp(Buffer.from(roundSvg)).resize(size, size).png().toFile(path.join(dirPath, 'ic_launcher_round.png'));
    console.log(`wrote ${dir} (${size}x${size})`);
  }
  await sharp(Buffer.from(flatStoreSvg)).resize(512, 512).png().toFile(path.join(storeRoot, 'play-store-icon-512.png'));
  console.log('wrote store-assets/play-store-icon-512.png');
}

run().catch(e => { console.error(e); process.exit(1); });
