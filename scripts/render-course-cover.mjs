import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import sharp from "sharp";

const [
  inputPath,
  outputPath,
  title,
  series = "UPLY 韩语课程",
  variant = "default",
  subtitle = "",
] = process.argv.slice(2);

if (!inputPath || !outputPath || !title) {
  throw new Error(
    "Usage: node scripts/render-course-cover.mjs <input> <output> <title> [series] [variant] [subtitle]",
  );
}

const escapeXml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const safeTitle = escapeXml(title);
const safeSeries = escapeXml(series);
const safeSubtitle = escapeXml(subtitle);
const coverStyles = {
  beginner: { accent: "#2f82b7", accentSoft: "#f0c64d", volume: "01" },
  intermediate: { accent: "#177f78", accentSoft: "#e47759", volume: "02" },
  advanced: { accent: "#53374f", accentSoft: "#8aa08d", volume: "03" },
  category: { accent: "#303633", accentSoft: "#b56a3b", volume: "" },
  default: { accent: "#303633", accentSoft: "#718d7b", volume: "" },
};
const style = coverStyles[variant] ?? coverStyles.default;
const volumeMarkup = style.volume
  ? `<text x="126" y="350" font-family="Noto Sans CJK SC, sans-serif" font-size="88" font-weight="300" letter-spacing="2" fill="${style.accent}">${style.volume}</text>
     <line x1="126" y1="382" x2="226" y2="382" stroke="${style.accentSoft}" stroke-width="9"/>`
  : `<rect x="126" y="312" width="48" height="9" fill="#2f82b7"/>
     <rect x="184" y="312" width="48" height="9" fill="#177f78"/>
     <rect x="242" y="312" width="48" height="9" fill="#53374f"/>`;
const overlay = Buffer.from(`
  <svg width="2048" height="1152" viewBox="0 0 2048 1152" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="titleFade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#faf7ef" stop-opacity="0.95"/>
        <stop offset="0.34" stop-color="#faf7ef" stop-opacity="0.78"/>
        <stop offset="0.52" stop-color="#faf7ef" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="1120" height="1152" fill="url(#titleFade)"/>
    <text x="126" y="172" font-family="Noto Sans CJK SC, sans-serif" font-size="29" font-weight="650" letter-spacing="4" fill="#4f5853">${safeSeries}</text>
    ${volumeMarkup}
    <text x="126" y="548" font-family="Noto Sans CJK SC, sans-serif" font-size="108" font-weight="760" letter-spacing="3" fill="#202523">${safeTitle}</text>
    ${safeSubtitle ? `<text x="132" y="624" font-family="Noto Sans CJK SC, sans-serif" font-size="34" font-weight="500" letter-spacing="1" fill="#5e6863">${safeSubtitle}</text>` : ""}
    <line x1="126" y1="972" x2="300" y2="972" stroke="${style.accent}" stroke-width="3" opacity="0.75"/>
    <text x="126" y="1030" font-family="Noto Sans CJK SC, sans-serif" font-size="27" font-weight="700" letter-spacing="5" fill="#3c4541">UPLY</text>
  </svg>
`);

await mkdir(dirname(outputPath), { recursive: true });
await sharp(inputPath)
  .resize(2048, 1152, { fit: "cover", position: "centre" })
  .composite([{ input: overlay, top: 0, left: 0 }])
  .webp({ quality: 92, effort: 6 })
  .toFile(outputPath);

console.log(outputPath);
