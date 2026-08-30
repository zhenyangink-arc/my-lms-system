import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

const poses = {
  "pointing-left": { headOffsetX: 78, brooch: { left: 233, top: 230 } },
  listening: { headOffsetX: 15, brooch: { left: 180, top: 245 } },
  "repeat-after-me": { headOffsetX: 8, brooch: { left: 183, top: 228 } },
  "gentle-correction": { headOffsetX: 0, brooch: { left: 178, top: 230 } },
};

const frameNames = ["idle", "speaking", "blink"];

function usage() {
  throw new Error(
    "Usage: node scripts/build-teacher-kim-teaching-frames.mjs <generated-source-dir> <identity-frame-dir> <output-dir>",
  );
}

async function removeGreenScreen(sourcePath) {
  const { data, info } = await sharp(sourcePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);

  for (let source = 0, target = 0; source < data.length; source += 3, target += 4) {
    const red = data[source];
    const green = data[source + 1];
    const blue = data[source + 2];
    const greenDominance = green - Math.max(red, blue);
    const alpha = Math.round(Math.max(0, Math.min(255, ((150 - greenDominance) / 120) * 255)));
    const spill = 1 - alpha / 255;
    const neutralGreen = Math.max(red, blue);

    rgba[target] = red;
    rgba[target + 1] = Math.min(
      Math.round(green * (1 - spill) + neutralGreen * spill),
      neutralGreen + 10,
    );
    rgba[target + 2] = blue;
    rgba[target + 3] = alpha;
  }

  return sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize(512, 1024, { fit: "fill" })
    .png()
    .toBuffer();
}

function identityMask() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="126" height="166">
      <defs><filter id="soft"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
      <ellipse cx="63" cy="78" rx="59" ry="72" filter="url(#soft)" fill="white"/>
    </svg>
  `);
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

async function identityOverlay(identityPath) {
  return sharp(identityPath)
    .extract({ left: 175, top: 50, width: 126, height: 166 })
    .composite([{ input: identityMask(), blend: "dest-in" }])
    .png()
    .toBuffer();
}

const [, , generatedSourceDir, identityFrameDir, outputDir] = process.argv;
if (!generatedSourceDir || !identityFrameDir || !outputDir) usage();

await mkdir(outputDir, { recursive: true });

for (const [pose, configuration] of Object.entries(poses)) {
  const base = await removeGreenScreen(join(generatedSourceDir, `${pose}.png`));

  for (const frame of frameNames) {
    const head = await identityOverlay(
      join(identityFrameDir, `explaining-${frame}.png`),
    );
    const outputPath = join(outputDir, `${pose}-${frame}.png`);
    await sharp(base)
      .composite([
        { input: head, left: 175 + configuration.headOffsetX, top: 50, blend: "over" },
        { input: broochSvg(), ...configuration.brooch, blend: "over" },
      ])
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outputPath);
    process.stdout.write(`${outputPath}\n`);
  }
}
