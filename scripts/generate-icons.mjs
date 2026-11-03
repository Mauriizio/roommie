import fs from "node:fs/promises";
import sharp from "sharp";

const source = "LOGO/LOGO.png";
const output = "public/icons";
await fs.mkdir(output, { recursive: true });
// The official square artwork includes white padding and a wordmark. PWA tiles
// use the complete house-and-roommates symbol, extracted without stretching.
const mark = await sharp(source)
  .flatten({ background: "#ffffff" })
  .extract({ left: 292, top: 250, width: 670, height: 570 })
  .png()
  .toBuffer();
for (const size of [192, 512]) {
  const padding = Math.round(size * 0.11);
  const logo = await sharp(mark)
    .resize(size - padding * 2, size - padding * 2, { fit: "inside" })
    .removeAlpha()
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: "#ffffff" },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(`${output}/icon-${size}.png`);
}
const size = 512;
const logo = await sharp(mark)
  .resize(360, 360, { fit: "inside" })
  .removeAlpha()
  .png()
  .toBuffer();
await sharp({
  create: { width: size, height: size, channels: 4, background: "#ffffff" },
})
  .composite([{ input: logo, gravity: "centre" }])
  .png()
  .toFile(`${output}/icon-maskable-512.png`);
const apple = await sharp(mark)
  .resize(160, 160, { fit: "inside" })
  .removeAlpha()
  .png()
  .toBuffer();
await sharp({
  create: { width: 180, height: 180, channels: 4, background: "#ffffff" },
})
  .composite([{ input: apple, gravity: "centre" }])
  .png()
  .toFile(`${output}/apple-touch-icon.png`);
console.log("ROOMMIE icons generated from LOGO/LOGO.png");
