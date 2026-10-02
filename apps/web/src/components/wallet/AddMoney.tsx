"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { CHAIN, EXPLORER, PLAY_MONEY, TEST_TOKEN } from "@/lib/config";
import { useBalances } from "@/lib/useBalances";

const EVENT = "patched:add-money";

/** Open the Add money sheet from anywhere (the wallet panel, a "not enough USDC" error). */
export function openAddMoney() {
  window.dispatchEvent(new Event(EVENT));
}

const num = (s: string | null) => (s === null ? null : Number(s.replace(/,/g, "")));

/**
 * The zero-balance screen: a new wallet starts at $0, so say exactly how to fund it. The address as a QR code and as
 * text, the network to send on, the faucet on a testnet, and the live balance, which turns into a "Received" line the
 * moment money lands. Mounted once in the layout; opened with openAddMoney().
 */
export function AddMoneyHost() {
  const { walletAddress, login } = usePatchedAuth();
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { usdc } = useBalances(open ? walletAddress : undefined);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const on = () => (walletAddress ? setOpen(true) : login());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [walletAddress, login]);

  useEffect(() => {
    if (!open || !walletAddress) return;
    start.current = null;
    QRCode.toDataURL(walletAddress, { width: 360, margin: 1, color: { dark: "#0B0B0C", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(null));
  }, [open, walletAddress]);

  const balance = num(usdc);
  if (open && balance !== null && start.current === null) start.current = balance;
  const received = balance !== null && start.current !== null ? Math.round((balance - start.current) * 100) / 100 : 0;
  const money = TEST_TOKEN ? "test USD" : "USDC";

  async function copy() {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the address is on screen to copy by hand */
    }
  }

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Add money" description={`Send ${money} on ${CHAIN.name} to your Patched wallet.`}>
      <div className="grid gap-5">
        <div className="flex items-center gap-4">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code of your wallet address" width={132} height={132} className="w-[132px] h-[132px] rounded-xl border-2 border-[var(--line)] flex-none" />
          ) : <div className="w-[132px] h-[132px] rounded-xl bg-[var(--soft)] flex-none" />}
          <div className="grid gap-1 min-w-0">
            <span className="text-xs font-semibold text-[var(--muted)]">Your balance</span>
            <b className="font-mono text-3xl tabular-nums leading-none">{usdc === null ? "…" : `$${usdc}`}</b>
            {received > 0 && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--green)]" role="status"><Check size={14} /> Received ${received.toLocaleString("en-US")}</span>
            )}
          </div>
        </div>

        <div className="grid gap-1.5">
          <span className="field-label">Your address</span>
          <code className="block break-all rounded-xl bg-[var(--soft)] p-3 text-[13px] leading-snug">{walletAddress}</code>
          <div className="flex gap-2 flex-wrap">
            <Button size="small" variant="primary" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy address"}</Button>
            <a className="btn-base btn-small" href={`${EXPLORER}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> View on explorer</a>
          </div>
        </div>

        <ol className="grid gap-2 text-[15px] list-decimal pl-5 m-0">
          <li>Open the wallet or exchange that holds your {money}.</li>
          <li>Send to the address above on the <b>{CHAIN.name}</b> network. Any amount works; bids start at a few dollars.</li>
          <li>This screen shows the money the moment it arrives, usually within seconds.</li>
        </ol>

        {PLAY_MONEY && (
          <p className="rounded-xl bg-[var(--accent-soft)] p-3 text-sm">
            {TEST_TOKEN
              ? <>Test run: get free test USD from the faucet on <b>My bids</b>.</>
              : <>Test network: get free test USDC from <a className="font-semibold underline" href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">Circle&apos;s faucet</a>, and choose {CHAIN.name}.</>}
          </p>
        )}
        <p className="text-xs text-[var(--muted)]">Only send {money} on {CHAIN.name}. Other tokens or networks can&apos;t be recovered.</p>
      </div>
    </Sheet>
  );
}
