// Runs the auto-approver once against the configured chain: opens every listing the index shows as Pending.
//   NODE_USE_ENV_PROXY=1 NODE_OPTIONS=--conditions=react-server npx tsx scripts/auto-approve-check.mts
import { readFileSync } from "node:fs";
import { join } from "node:path";
for (const line of readFileSync(join(import.meta.dirname, "..", "..", "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const { approvePending } = await import("../src/lib/server/autoApprove");
const results = await approvePending();
console.log(results.length ? results : "nothing pending");
