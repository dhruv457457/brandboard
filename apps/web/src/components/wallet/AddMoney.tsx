"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Check, Copy, ExternalLink, Droplets, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { CHAIN, EXPLORER, PLAY_MONEY, TEST_TOKEN } from "@/lib/config";
import { useBalances } from "@/lib/useBalances";

const EVENT = "patched:add-money";
export const CIRCLE_FAUCET = "https://faucet.circle.com";

/** Why the sheet opened: an action that needs more money than the wallet holds. Dollars. */
export interface MoneyNeed {
  need: number;
  have: number;
  /** What the money is for, as it reads after "This": "bid", "sweep", "auto-bid limit", "listing stake", "campaign budget". */
  what: string;
}

/** Open the Add money sheet from anywhere (the wallet panel, a "Get free USDC" button). */
export function openAddMoney() {
  window.dispatchEvent(new CustomEvent<MoneyNeed | undefined>(EVENT, { detail: undefined }));
}

/** Open it for an action that came up short: it starts by saying how much is missing and for what. */
export function openAddMoneyFor(need: MoneyNeed) {
  window.dispatchEvent(new CustomEvent<MoneyNeed | undefined>(EVENT, { detail: need }));
}

const num = (s: string | null) => (s === null ? null : Number(s.replace(/,/g, "")));
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/**
 * The zero-balance screen: a new wallet starts at $0, so say exactly how to fund it. Opened by hand (the wallet panel)
 * or by any action that came up short, in which case it opens with what's missing. On a testnet the free faucet comes
 * first, with the address to paste right inside its steps; the live balance turns into "Received" the moment money
 * lands, and "Back to my bid" once there's enough. Mounted once in the layout; opened with openAddMoney().
 */
export function AddMoneyHost() {
  const { walletAddress, login } = usePatchedAuth();
  const [open, setOpen] = useState(false);
  const [need, setNeed] = useState<MoneyNeed | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { usdc } = useBalances(open ? walletAddress : undefined);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      if (!walletAddress) return login();
      setNeed((e as CustomEvent<MoneyNeed | undefined>).detail ?? null);
      start.current = null;
      setOpen(true);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [walletAddress, login]);

  useEffect(() => {
    if (!open || !walletAddress) return;
    QRCode.toDataURL(walletAddress, { width: 360, margin: 1, color: { dark: "#0B0B0C", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(null));
  }, [open, walletAddress]);

  const balance = num(usdc);
  if (open && balance !== null && start.current === null) start.current = balance;
  const received = balance !== null && start.current !== null ? Math.round((balance - start.current) * 100) / 100 : 0;
  const enough = need !== null && balance !== null && balance >= need.need;
  const money = TEST_TOKEN ? "test USD" : "USDC";
  const faucet = PLAY_MONEY && !TEST_TOKEN;

  async function copy() {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      /* clipboard blocked: the address is on screen to copy by hand */
    }
  }

  // Circle's faucet can't be pre-filled, so copy the address first and open the faucet; the person pastes it there.
  async function openFaucet() {
    await copy();
    window.open(CIRCLE_FAUCET, "_blank", "noopener,noreferrer");
  }

  const address = (
    <div className="grid gap-2">
      <code className="block break-all rounded-xl bg-[var(--card)] border-[1.5px] border-[var(--line)] p-3 font-mono text-[14px] leading-snug select-all">{walletAddress}</code>
      <Button size="small" variant={copied ? "default" : "primary"} onClick={copy} className="justify-center">
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Address copied" : "Copy my address"}
      </Button>
    </div>
  );

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title={faucet ? "Get free test USDC" : "Add money"}
      description={faucet ? `Bidding on ${CHAIN.name} uses free test USDC from Circle's faucet.` : `Send ${money} on ${CHAIN.name} to your Patched wallet.`}
    >
      <div className="grid gap-5">
        {need && (
          enough ? (
            <div role="status" className="rounded-2xl border-[1.5px] border-[var(--green)] bg-[var(--green-soft)] p-4 grid gap-3">
              <span className="flex items-center gap-2 font-extrabold"><Check size={18} /> You have {usd(balance!)} now</span>
              <span className="text-[15px]">That&apos;s enough for this {need.what}. Go back and try again.</span>
              <Button variant="primary" onClick={() => setOpen(false)} className="justify-center"><ArrowLeft size={15} /> Back to my {need.what}</Button>
            </div>
          ) : (
            <div role="alert" className="rounded-2xl border-[1.5px] border-[var(--line)] bg-[var(--soft)] p-4 grid gap-1">
              <span className="flex items-center gap-2 font-extrabold"><Wallet size={18} /> Your wallet needs {usd(Math.max(0, need.need - (balance ?? need.have)))} more</span>
              <span className="text-[15px]">This {need.what} needs {usd(need.need)}. Your wallet has {usd(balance ?? need.have)}.</span>
            </div>
          )
        )}

        {faucet && (
          <div className="rounded-2xl border-[1.5px] border-[var(--accent)] bg-[var(--accent-soft)] p-4 grid gap-4">
            <span className="flex items-center gap-2 font-extrabold"><Droplets size={18} /> Three steps, about a minute</span>
            <ol className="grid gap-4 list-none m-0 p-0">
              <li className="grid gap-2">
                <span className="text-[15px]"><b>1. Copy your wallet address.</b> This is where the faucet sends the USDC.</span>
                {address}
              </li>
              <li className="grid gap-2">
                <span className="text-[15px]"><b>2. Open Circle&apos;s faucet</b> and fill it in:</span>
                <ul className="m-0 pl-5 grid gap-1 text-[15px] list-disc">
                  <li>Token: <b>USDC</b></li>
                  <li>Network: <b>{CHAIN.name}</b></li>
                  <li>Address: <b>paste</b> the one you copied</li>
                  <li>Press <b>Send</b></li>
                </ul>
                <Button variant="primary" onClick={openFaucet} className="justify-center">
                  <ExternalLink size={15} /> Open Circle faucet{copied ? " (address copied)" : ""}
                </Button>
              </li>
              <li className="text-[15px]"><b>3. Come back here.</b> Your balance below updates by itself, usually within seconds.</li>
            </ol>
            <p className="text-xs text-[var(--muted)] m-0">It&apos;s play money for this test network, enough for several bids, with no value anywhere else.</p>
          </div>
        )}

        <div className="flex items-center gap-4">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code of your wallet address" width={112} height={112} className="w-[112px] h-[112px] rounded-xl border-2 border-[var(--line)] flex-none" />
          ) : <div className="w-[112px] h-[112px] rounded-xl bg-[var(--soft)] flex-none" />}
          <div className="grid gap-1 min-w-0">
            <span className="text-xs font-semibold text-[var(--muted)]">Your balance</span>
            <b className="font-mono text-3xl tabular-nums leading-none">{usdc === null ? "…" : `$${usdc}`}</b>
            {received > 0 && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--green)]" role="status"><Check size={14} /> Received ${received.toLocaleString("en-US")}</span>
            )}
          </div>
        </div>

        {!faucet && (
          <div className="grid gap-1.5">
            <span className="field-label">Your address</span>
            {address}
          </div>
        )}

        <div className="grid gap-2">
          {faucet && <span className="field-label">Or send from another wallet</span>}
          <ol className="grid gap-2 text-[15px] list-decimal pl-5 m-0">
            <li>Open the wallet or exchange that holds your {money}.</li>
            <li>Send to {faucet ? "your address (step 1)" : "the address above"} on the <b>{CHAIN.name}</b> network. Any amount works; bids start at a few dollars.</li>
            <li>This screen shows the money the moment it arrives.</li>
          </ol>
          <a className="btn-base btn-small w-fit" href={`${EXPLORER}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> View my wallet on the explorer</a>
        </div>

        {PLAY_MONEY && TEST_TOKEN && (
          <p className="rounded-xl bg-[var(--accent-soft)] p-3 text-sm">Test run: get free test USD from the faucet on <b>My bids</b>.</p>
        )}
        <p className="text-xs text-[var(--muted)]">Only send {money} on {CHAIN.name}. Other tokens or networks can&apos;t be recovered.</p>
      </div>
    </Sheet>
  );
}
