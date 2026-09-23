// Local indexer: `pnpm indexer` (testnet) or `pnpm indexer -- --chain 143`. Add `--watch` to keep polling.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { syncChain, type IndexedChainId } from "./index";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const argv = process.argv.slice(2);
const chainId = Number(argv[argv.indexOf("--chain") + 1] || 10143) as IndexedChainId;
const watch = argv.includes("--watch");
const rpcUrl = chainId === 143 ? process.env.MONAD_MAINNET_RPC_URL! : process.env.MONAD_TESTNET_RPC_URL!;
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, onnotice: () => {} });

try {
  do {
    const r = await syncChain({ sql, chainId, rpcUrl });
    if (r.logs || !watch) {
      console.log(`chain ${chainId}: blocks ${r.fromBlock}..${r.toBlock}, ${r.logs} logs, ${r.listingsRefreshed} listings refreshed${r.caughtUp ? " (caught up)" : ""}`);
    }
    if (watch && r.caughtUp) await new Promise((res) => setTimeout(res, 2000));
    else if (!watch && !r.caughtUp) continue;
    else if (!watch) break;
  } while (true);
} finally {
  await sql.end();
}
