// Manual try-out (spends OpenRouter credit): npx tsx test/car.try.ts <photo.jpg> <outDir> [views...]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describeCar, makeCarView, type CarView } from "../src/index";
import { cutoutGreen } from "../src/cutout";

for (const line of readFileSync(new URL("../../../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

async function main() {
  const [photoPath, outDir, ...views] = process.argv.slice(2);
  const photo = `data:image/jpeg;base64,${readFileSync(photoPath).toString("base64")}`;
  let t = Date.now();
  const description = await describeCar(photo);
  console.log(`description (${Date.now() - t} ms):`, description);
  let reference: string | undefined;
  for (const view of (views.length ? views : ["left"]) as CarView[]) {
    t = Date.now();
    const { image, model } = await makeCarView({ photo, description, view, reference });
    const cut = await cutoutGreen(image);
    writeFileSync(join(outDir, `car-${view}.webp`), cut.data);
    writeFileSync(join(outDir, `car-${view}-raw.txt`), image); // data: URL before the cutout
    console.log(`${view}: ${Date.now() - t} ms via ${model}, cut=${cut.cut}, removed ${(cut.removed * 100).toFixed(0)}%`);
    reference ??= image;
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
