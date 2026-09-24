"use client";

import { useMemo, useState } from "react";
import { encodeFunctionData, erc20Abi } from "viem";
import { Layers } from "lucide-react";
import { patchSweeperAbi } from "@patched/shared";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { formatUsdc } from "@/lib/format";
import { SWEEPER, USDC, publicClient } from "@/lib/config";
import type { LivePatch } from "@/lib/market/types";
import { friendlyError } from "@/lib/market/useBid";
import { usePermitSigner } from "@/lib/market/permit";
import { useTx } from "@/lib/market/useTx";
import { useStepUp } from "@/lib/market/stepUp";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";

const usd = (v: bigint) => formatUsdc(Number(v) / 1e6);

interface Props {
  listingId: number;
  patches: LivePatch[];
  /** Lowest bid that leads each patch right now (capped at buy-now). */
  minNext: (p: LivePatch) => bigint;
  me?: string;
}

/**
 * Sweep: pick several open patches and bid the minimum on all of them in one signature and one transaction
 * (PatchSweeper.sweepWithPermit), all or nothing.
 */
export function SweepPanel({ listingId, patches, minNext, me }: Props) {
  const { authenticated, login, walletAddress } = usePatchedAuth();
  const signPermit = usePermitSigner();
  const send = useTx();
  const stepUp = useStepUp();
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useMemo(() => patches.filter((p) => !p.bought && p.topBidder !== me), [patches, me]);
  const chosen = open.filter((p) => picked.includes(p.id));
  const total = chosen.reduce((s, p) => s + minNext(p), 0n);

  if (!SWEEPER || open.length < 2) return null;

  const toggle = (id: number) => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  async function sweep() {
    if (!authenticated) return login();
    if (chosen.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const ids = chosen.map((p) => p.id);
      const amounts = chosen.map((p) => minNext(p));
      const balance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress!] });
      if (balance < total) throw new Error("insufficient USDC");
      await stepUp.ensure(total);
      const { deadline, v, r, s } = await signPermit(SWEEPER!, total);
      // Fail fast with the contract's own reason (e.g. someone just outbid one of the picks).
      await publicClient.simulateContract({
        address: SWEEPER!, abi: patchSweeperAbi, functionName: "sweepWithPermit",
        args: [BigInt(listingId), ids, amounts, deadline, v, r, s], account: walletAddress!,
      });
      const data = encodeFunctionData({
        abi: patchSweeperAbi, functionName: "sweepWithPermit", args: [BigInt(listingId), ids, amounts, deadline, v, r, s],
      });
      await send(SWEEPER!, data);
      fetch("/api/indexer/sync", { method: "POST" }).catch(() => {});
      toast(`You lead ${chosen.length} patches · ${usd(total)} locked in escrow`);
      setPicked([]);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 grid gap-3">
      <div className="flex items-center gap-2 font-bold">
        <Layers size={18} className="text-[var(--accent-text)]" /> Sweep
      </div>
      <p className="text-sm text-[var(--muted)]">Take several spots at once. One signature, all bids land together or none do.</p>
      <div className="grid gap-1.5">
        {open.map((p) => {
          const on = picked.includes(p.id);
          return (
            <label
              key={p.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-2 cursor-pointer text-sm transition-colors",
                on ? "border-[var(--line)] bg-[var(--accent-soft)]" : "border-[var(--soft)] hover:border-[var(--muted)]",
              )}
            >
              <span className="flex items-center gap-2.5 font-semibold">
                <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="accent-[var(--accent)] w-4 h-4" disabled={busy} />
                {p.label}
              </span>
              <span className="font-mono">{usd(minNext(p))}</span>
            </label>
          );
        })}
      </div>
      {error && <p className="text-sm text-[var(--red)]" role="alert">{error}</p>}
      <Button variant="primary" disabled={busy || (authenticated && chosen.length < 2)} onClick={sweep}>
        {!authenticated
          ? "Sign in to sweep"
          : busy
            ? "Placing bids…"
            : chosen.length < 2
              ? "Pick at least 2 patches"
              : `Bid on ${chosen.length} patches · ${usd(total)}`}
      </Button>
    </Card>
  );
}
