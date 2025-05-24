const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const { SKINS } = require('./public/store');

const outDir = path.join(__dirname, 'public', 'images', 'skins');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const width = 100;
const height = 100;

const bgColors = [
  '#e0f7fa', '#ffe0b2', '#f8bbd0', '#dcedc8', '#fff9c4', '#cfd8dc', '#f0f4c3', '#f3e5f5', '#b2dfdb'
];

Object.values(SKINS).forEach((skin, i) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = bgColors[i % bgColors.length];
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, width-4, height-4);

  // Text
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(skin.name, width/2, height/2);

  // Save
  const outPath = path.join(outDir, `${skin.id}.png`);
  const out = fs.createWriteStream(outPath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  out.on('finish', () => console.log('Generated', outPath));
}); 