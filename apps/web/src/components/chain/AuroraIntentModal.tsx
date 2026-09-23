"use client";

import React, { useState } from "react";
import { ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatUsdc } from "@/lib/format";

interface AuroraIntentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUsdcAmount: bigint;
  patchLabel: string;
  brandName: string;
  onIntentSettled: (details: {
    amount: bigint;
    sourceChain: string;
    sourceToken: string;
    txHash: string;
  }) => void;
}

const CHAINS = [
  { id: "base", name: "Base", icon: "B", rate: 1.0, token: "USDC", altToken: "ETH", ethPrice: 2600 },
  { id: "ethereum", name: "Ethereum", icon: "Ξ", rate: 1.0, token: "ETH", altToken: "USDC", ethPrice: 2600 },
  { id: "arbitrum", name: "Arbitrum", icon: "A", rate: 1.0, token: "USDC", altToken: "ETH", ethPrice: 2600 },
  { id: "solana", name: "Solana", icon: "◎", rate: 1.0, token: "SOL", altToken: "USDC", solPrice: 140 },
  { id: "optimism", name: "Optimism", icon: "O", rate: 1.0, token: "USDC", altToken: "ETH", ethPrice: 2600 },
];

export function AuroraIntentModal({
  isOpen,
  onClose,
  targetUsdcAmount,
  patchLabel,
  brandName,
  onIntentSettled,
}: AuroraIntentModalProps) {
  const [selectedChainId, setSelectedChainId] = useState("base");
  const [selectedToken, setSelectedToken] = useState<"native" | "usdc">("usdc");
  const [status, setStatus] = useState<"idle" | "solving" | "settled">("idle");
  const [stepText, setStepText] = useState("");

  if (!isOpen) return null;

  const currentChain = CHAINS.find((c) => c.id === selectedChainId) || CHAINS[0];
  const targetUsdNum = Number(targetUsdcAmount) / 1e6;

  // Calculate required amount
  let requiredAmountStr = `${targetUsdNum.toFixed(2)} USDC`;
  if (selectedToken === "native") {
    if (currentChain.id === "solana") {
      const price = currentChain.solPrice || 140;
      const solNeeded = (targetUsdNum / price).toFixed(3);
      requiredAmountStr = `${solNeeded} SOL`;
    } else {
      const price = currentChain.ethPrice || 2600;
      const ethNeeded = (targetUsdNum / price).toFixed(4);
      requiredAmountStr = `${ethNeeded} ETH`;
    }
  }

  const handleExecuteIntent = async () => {
    setStatus("solving");
    setStepText("Broadcasting intent to Aurora solvers…");

    await new Promise((res) => setTimeout(res, 1400));
    setStepText("Solvers routing liquidity to Monad testnet…");

    await new Promise((res) => setTimeout(res, 1600));
    setStepText("USDC arriving in Patched Escrow on Monad…");

    await new Promise((res) => setTimeout(res, 1200));
    setStatus("settled");

    const fakeTx = `0xaurora_${Math.random().toString(16).slice(2, 10)}`;
    onIntentSettled({
      amount: targetUsdcAmount,
      sourceChain: currentChain.name,
      sourceToken: selectedToken === "native" ? (currentChain.id === "solana" ? "SOL" : "ETH") : "USDC",
      txHash: fakeTx,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="aurora-intent-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <Card className="w-full max-w-lg p-6 bg-[var(--paper)] border-2 border-[var(--line)] shadow-2xl relative space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#E65100]/10 text-[#E65100] border border-[#E65100]/30">
              <Sparkles className="w-3 h-3" />
              <span>Aurora Intents</span>
            </div>
            <h2 id="aurora-intent-title" className="font-display font-black text-2xl text-[var(--ink)]">
              Pay from another chain
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Bid in your native tokens. Aurora solvers deposit native USDC into Monad Escrow in 3 seconds.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg border border-[var(--line)] hover:bg-[var(--soft)] cursor-pointer text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {status === "idle" && (
          <>
            {/* Step 1: Select Source Chain */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                1. Select source chain
              </label>
              <div className="grid grid-cols-5 gap-2">
                {CHAINS.map((c) => {
                  const isSel = c.id === selectedChainId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedChainId(c.id)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                        isSel
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]/40 shadow-[2px_2px_0_var(--accent)]"
                          : "border-[var(--line)] bg-[var(--card)] hover:bg-[var(--soft)]"
                      }`}
                    >
                      <span className="w-7 h-7 rounded-full border border-[var(--line)] bg-[var(--paper)] grid place-items-center font-bold text-xs">
                        {c.icon}
                      </span>
                      <span className="text-[11px] font-bold text-[var(--ink)] mt-1">
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Select Token */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                2. Pay with
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedToken("usdc")}
                  className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                    selectedToken === "usdc"
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]/40 shadow-[2px_2px_0_var(--accent)]"
                      : "border-[var(--line)] bg-[var(--card)]"
                  }`}
                >
                  <span className="font-bold text-sm text-[var(--ink)]">USDC</span>
                  <span className="text-xs font-mono text-[var(--muted)]">1:1 Bridge</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedToken("native")}
                  className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                    selectedToken === "native"
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]/40 shadow-[2px_2px_0_var(--accent)]"
                      : "border-[var(--line)] bg-[var(--card)]"
                  }`}
                >
                  <span className="font-bold text-sm text-[var(--ink)]">
                    {currentChain.id === "solana" ? "SOL" : "ETH"}
                  </span>
                  <span className="text-xs font-mono text-[var(--muted)]">Auto-swap</span>
                </button>
              </div>
            </div>

            {/* Rate & Route Card */}
            <div className="bg-[var(--soft)] p-4 rounded-xl space-y-2.5 border border-[var(--line)]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--muted)]">You pay on {currentChain.name}:</span>
                <span className="font-mono font-bold text-sm text-[var(--ink)]">
                  {requiredAmountStr}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--muted)]">Escrow receives on Monad:</span>
                <span className="font-mono font-bold text-sm text-[var(--accent-text)]">
                  {formatUsdc(targetUsdcAmount)}
                </span>
              </div>
              <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11px] text-[var(--muted)]">
                <span>Solver: Aurora Intents Network</span>
                <span className="font-semibold text-[var(--green)]">Zero slippage</span>
              </div>
            </div>

            {/* Action */}
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" onClick={onClose} className="flex-none">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleExecuteIntent}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <span>Bid with {requiredAmountStr}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}

        {status === "solving" && (
          <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
            <div className="space-y-1">
              <h3 className="font-display font-extrabold text-xl text-[var(--ink)]">
                Executing Intent
              </h3>
              <p className="text-xs font-mono text-[var(--muted)]">{stepText}</p>
            </div>
            <div className="w-full bg-[var(--soft)] h-1.5 rounded-full overflow-hidden mt-2">
              <div className="bg-[var(--accent)] h-full animate-[progress_2s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {status === "settled" && (
          <div className="py-6 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--p2)] border-2 border-[var(--line)] grid place-items-center shadow-[3px_3px_0_var(--shadow)]">
              <Check className="w-7 h-7 text-[#0B0B0C]" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-black text-2xl text-[var(--ink)]">
                Intent Settled!
              </h3>
              <p className="text-xs text-[var(--muted)] max-w-sm">
                <b>{brandName || "Your brand"}</b> is now top bidder on <b>{patchLabel}</b>.{" "}
                {formatUsdc(targetUsdcAmount)} locked in Monad Escrow.
              </p>
            </div>
            <Button variant="primary" onClick={onClose} className="w-full mt-2">
              Done
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
