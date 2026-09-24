// Manual timing check for describeCar with different models: npx tsx test/describe.try.ts <photo.jpg> <model...>
import { readFileSync } from "node:fs";
import { describeCar } from "../src/index";

for (const line of readFileSync(new URL("../../../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}
async function main() {
  const [photoPath, ...models] = process.argv.slice(2);
  const photo = `data:image/jpeg;base64,${readFileSync(photoPath).toString("base64")}`;
  for (const model of models) {
    process.env.AI_VISION_MODEL = model;
    const t = Date.now();
    try {
      const d = await describeCar(photo);
      console.log(`${model}: ${Date.now() - t} ms\n  ${d.slice(0, 200)}…`);
    } catch (e) {
      console.log(`${model}: failed ${(e as Error).message}`);
    }
  }
}
main();
