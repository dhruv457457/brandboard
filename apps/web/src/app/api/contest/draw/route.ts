import { DEADLINE, pickWinner } from "@/lib/contest";
import { drawBlock, drawEntries } from "@/lib/server/contest";
import { EXPLORER_TESTNET } from "@/lib/server/contestChain";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * The lucky-draw result, recomputable by anyone: the eligible entries oldest first, the hash of the first Monad testnet
 * block after the deadline, and winner = entries[hash % count]. Before the deadline (or before that block exists) it only
 * says when the draw happens.
 */
export async function GET() {
  const entries = await drawEntries();
  const block = Date.now() >= DEADLINE ? await drawBlock().catch(() => null) : null;
  const base = { deadline: DEADLINE, count: entries.length };
  if (!block) return Response.json({ ...base, drawn: false }, { headers: { "cache-control": "no-store" } });
  const win = pickWinner(entries, block.hash);
  return Response.json(
    {
      ...base,
      drawn: Boolean(win),
      block: { number: block.number, hash: block.hash, url: `${EXPLORER_TESTNET}/block/${block.number}` },
      index: win?.index ?? null,
      winner: win?.entry.handle ?? null,
      order: entries.map((e) => e.handle),
    },
    { headers: { "cache-control": "public, s-maxage=30" } },
  );
}
