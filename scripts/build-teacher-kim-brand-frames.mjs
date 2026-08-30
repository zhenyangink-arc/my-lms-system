import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";

import sharp from "sharp";

const posePins = {
  greeting: { left: 225, top: 246 },
  explaining: { left: 152, top: 238 },
  encouraging: { left: 137, top: 310 },
};

function usage() {
  throw new Error(
    "Usage: node scripts/build-teacher-kim-brand-frames.mjs <v2-root> <output-dir>",
  );
}

function broochSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="13.5" fill="#26386f" stroke="#d9b45c" stroke-width="2"/>
      <circle cx="15" cy="15" r="10.25" fill="none" stroke="#d9b45c" stroke-width="1" opacity="0.82"/>
      <path d="M9.2 8.2v7.2c0 4.15 2.15 6.35 5.8 6.35s5.8-2.2 5.8-6.35V8.2h-3.05v7.05c0 2.5-.82 3.55-2.75 3.55s-2.75-1.05-2.75-3.55V8.2z" fill="#d9b45c"/>
      <path d="M8.7 7.2h4.1v2.05H8.7zm8.5 0h4.1v2.05h-4.1z" fill="#d9b45c"/>
    </svg>
  `);
}

async function addBrooch(sourcePath, outputPath, pose) {
  const pin = posePins[pose];
  if (!pin) throw new Error(`Unsupported Teacher Kim pose: ${pose}`);

  const metadata = await sharp(sourcePath).metadata();
  if (metadata.width !== 512 || metadata.height !== 1024 || !metadata.hasAlpha) {
    throw new Error(`${sourcePath} must be a transparent 512x1024 image`);
  }

  await sharp(sourcePath)
    .composite([{ input: broochSvg(), left: pin.left, top: pin.top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);
}

const [, , sourceRoot, outputDir] = process.argv;
if (!sourceRoot || !outputDir) usage();

await mkdir(outputDir, { recursive: true });

for (const pose of Object.keys(posePins)) {
  const inputs = [
    join(sourceRoot, "frames", `${pose}-idle.png`),
    join(sourceRoot, "source", `${pose}-speaking.png`),
    join(sourceRoot, "frames", `${pose}-blink.png`),
  ];

  for (const input of inputs) {
    const output = join(outputDir, basename(input));
    await addBrooch(input, output, pose);
    process.stdout.write(`${output}\n`);
  }
}
