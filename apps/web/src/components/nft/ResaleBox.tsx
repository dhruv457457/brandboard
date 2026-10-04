"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { encodeFunctionData, erc20Abi } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { MARKET, USDC } from "@/lib/config";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { friendlyError } from "@/lib/market/useBid";
import { useTx } from "@/lib/market/useTx";

const INPUT = "border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)] font-mono w-full";

/**
 * Resale on the NFT's own page. Only while the run is in progress: the market refuses it before and after. The holder
 * sets or removes a price; anyone else can buy at that price (the creator gets the royalty).
 */
export function ResaleBox({ tokenId, holder, price, label }: { tokenId: string; holder: string; price: string; label: string }) {
  const { walletAddress, authenticated } = usePatchedAuth();
  const send = useTx();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const mine = !!walletAddress && walletAddress.toLowerCase() === holder.toLowerCase();
  const listed = BigInt(price) > 0n;

  async function run(done: string, calls: { to: `0x${string}`; data: `0x${string}` }[]) {
    setBusy(true);
    try {
      for (const c of calls) await send(c.to, c.data);
      await fetch("/api/indexer/sync", { method: "POST" }).catch(() => {});
      toast(done);
      router.refresh();
    } catch (err) {
      toast(friendlyError(err).replace("The bid didn't", "That didn't"));
    } finally {
      setBusy(false);
    }
  }

  if (mine) {
    return listed ? (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm">For sale at <b className="font-mono">{formatUsdc(BigInt(price))}</b></span>
        <Button size="small" variant="ghost" disabled={busy}
          onClick={() => run("Resale listing removed.", [{ to: MARKET, data: encodeFunctionData({ abi: patchedMarketAbi, functionName: "cancelResale", args: [BigInt(tokenId)] }) }])}>
          Stop selling
        </Button>
      </div>
    ) : (
      <div className="flex gap-2">
        <input className={INPUT} placeholder="Resale price, USDC" inputMode="decimal" aria-label="Resale price in USDC" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button size="small" disabled={busy || !(parseUsdc(draft) > 0n)}
          onClick={() => run("Listed for resale. The creator gets 5% when it sells.", [{ to: MARKET, data: encodeFunctionData({ abi: patchedMarketAbi, functionName: "listForResale", args: [BigInt(tokenId), parseUsdc(draft)] }) }])}>
          Resell
        </Button>
      </div>
    );
  }

  if (!listed) return <p className="text-sm muted">Not for sale. The holder can list it for resale while the creator is still delivering.</p>;
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-sm">For sale at <b className="font-mono">{formatUsdc(BigInt(price))}</b>. The creator gets 5%.</span>
      <Button variant="primary" size="small" disabled={busy || !authenticated}
        onClick={() => run(`You bought ${label}.`, [
          { to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [MARKET, BigInt(price)] }) },
          { to: MARKET, data: encodeFunctionData({ abi: patchedMarketAbi, functionName: "buyResale", args: [BigInt(tokenId), BigInt(price)] }) },
        ])}>
        {busy ? "Buying…" : authenticated ? `Buy for ${formatUsdc(BigInt(price))}` : "Sign in to buy"}
      </Button>
    </div>
  );
}
