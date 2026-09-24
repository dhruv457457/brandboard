// Self-check for the green-screen cutout: npx tsx test/cutout.check.ts
// Builds a white "person" with a muted green logo inside on an uneven green screen, cuts it out and checks the alpha.
import sharp from "sharp";
import { cutoutGreen } from "../src/cutout";

async function main() {
  const W = 400, H = 600;
  const raw = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const inBody = (x - 200) ** 2 / 90 ** 2 + (y - 330) ** 2 / 240 ** 2 < 1;
    const logo = inBody && Math.abs(x - 200) < 25 && Math.abs(y - 250) < 25;
    const noise = (x * 7 + y * 13) % 17;
    const [r, g, b] = logo ? [40, 130, 70] : inBody ? [245, 245, 242] : [8 + noise, 240 - noise, 12 + noise];
    raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
  }
  const png = await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  const res = await cutoutGreen(`data:image/png;base64,${png.toString("base64")}`);
  const { data } = await sharp(res.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = (x: number, y: number) => data[(y * W + x) * 4 + 3];
  const checks = [
    ["cut happened", res.cut],
    ["corner is transparent", alpha(5, 5) === 0],
    ["body stays opaque", alpha(200, 450) === 255],
    ["green logo inside the body stays", alpha(200, 250) === 255],
  ] as const;
  for (const [name, ok] of checks) console.log(ok ? "PASS" : "FAIL", name);
  console.log(`removed ${(res.removed * 100).toFixed(1)}% as ${res.contentType}`);
  if (checks.some(([, ok]) => !ok)) process.exit(1);
}
main();
