import { NextResponse } from "next/server";
import postgres from "postgres";
import { syncChain } from "@patched/indexer";
import { CHAIN_ID, serverRpcUrl } from "@/lib/config";
import { respondAutoBids } from "@/lib/server/keeper";

export const runtime = "nodejs";
export const maxDuration = 60;

let sql: ReturnType<typeof postgres> | null = null;
let running: Promise<unknown> | null = null;

/**
 * Pull new contract events into Supabase. Called by the scheduler every minute and by the app right
 * after a user's transaction, so the database catches up within a second or two. Safe to call often:
 * concurrent calls share one run, and every write is idempotent.
 */
export async function POST() {
  sql ??= postgres(process.env.DATABASE_URL!, { prepare: false, max: 2, onnotice: () => {} });
  running ??= syncChain({ sql, chainId: CHAIN_ID, rpcUrl: serverRpcUrl(), maxBlocks: 5_000n }).finally(() => {
    running = null;
  });
  try {
    const r = (await running) as Awaited<ReturnType<typeof syncChain>>;
    // A new bid may have outbid someone with auto-bid on: answer right away rather than on the next tick.
    // Safe to trigger from here: the auto-bidder contract only ever bids what the brand allowed.
    if (r.logs > 0) await respondAutoBids().catch((err) => console.error("auto-bid failed", err));
    return NextResponse.json({
      ok: true, fromBlock: r.fromBlock.toString(), toBlock: r.toBlock.toString(), logs: r.logs, caughtUp: r.caughtUp,
    });
  } catch (err) {
    console.error("indexer sync failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const GET = POST;
