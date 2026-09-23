"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { formatCountdown, formatUsdc } from "@/lib/format";

interface ShareListing {
  id: number;
  path: string;
  title: string;
  eventName: string | null;
  patchCount: number;
  openCount: number;
  topBidsTotal: number;
  biddingEndsAt: number;
  leaderBrands: string[];
}

type Template = "launch" | "lastcall" | "brands";

export function ShareKit({ listing }: { listing: ShareListing }) {
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template>("launch");
  const [text, setText] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = origin ? `${origin}${listing.path}` : "";

  const templates = useMemo<Record<Template, string>>(() => {
    const where = listing.eventName ? ` at ${listing.eventName}` : "";
    const left = origin ? formatCountdown(listing.biddingEndsAt) : null;
    return {
      launch:
        `I'm getting patched${where}.\n\n${listing.patchCount} logo spots, brands bid in USDC and the money sits in escrow until I show up.\n\n` +
        `Bid on a patch: ${url}`,
      lastcall:
        `${listing.openCount} of ${listing.patchCount} patches still open on "${listing.title}"` +
        `${left && !left.hasEnded ? `, bidding closes in ${left.text.split(" ")[0]}` : ""}.\n\n` +
        `${formatUsdc(listing.topBidsTotal)} in bids so far: ${url}`,
      brands: listing.leaderBrands.length
        ? `Thanks ${listing.leaderBrands.join(", ")} for bidding on "${listing.title}".\n\nA few patches are still open: ${url}`
        : `No brand has claimed a patch on "${listing.title}" yet. Be the first: ${url}`,
    };
  }, [listing, origin, url]);

  useEffect(() => setText(templates[template]), [templates, template]);
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: "#0B0B0C", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(null));
  }, [url]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied.`);
    } catch {
      toast("Copy didn't work. Select the text and copy it manually.");
    }
  }

  return (
    <main className="wrap pt-8 pb-24 grid gap-6">
      <div>
        <span className="eyebrow">Share kit</span>
        <h1 className="font-extrabold text-4xl tracking-tight mt-1">{listing.title}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] items-start">
        <div className="grid gap-5">
          <div>
            <p className="text-sm muted mb-2">This preview shows up when your link is posted on X, Telegram or Discord.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${listing.path}/opengraph-image`} alt="Link preview" className="w-full rounded-2xl border-2 border-[var(--line)] shadow-[4px_4px_0_var(--shadow)]" />
          </div>
          <Card className="p-5 flex gap-5 items-center flex-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt="QR code for your listing" className="w-36 h-36 rounded-xl border-2 border-[var(--line)]" /> : <div className="w-36 h-36 rounded-xl bg-[var(--soft)]" />}
            <div className="grid gap-2 max-w-[34ch]">
              <b>Print this on your patches</b>
              <p className="text-sm muted">People at the event scan it and land on your listing, so your outfit brings in the next bidder.</p>
              {qr && <a href={qr} download={`patched-${listing.id}-qr.png`} className="btn-base btn-small justify-self-start">Download QR code</a>}
            </div>
          </Card>
        </div>

        <Card className="p-5 grid gap-3">
          <h2 className="font-bold text-xl">Post it on X</h2>
          <div className="flex gap-2 flex-wrap">
            {([["launch", "Launch"], ["lastcall", "Last call"], ["brands", "Thank brands"]] as const).map(([k, label]) => (
              <Button key={k} size="small" variant={template === k ? "primary" : "ghost"} onClick={() => setTemplate(k)}>{label}</Button>
            ))}
          </div>
          <textarea className="border-2 border-[var(--line)] rounded-xl p-3 bg-[var(--paper)] min-h-[160px]" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex justify-between items-center">
            <span className="font-mono text-xs muted">{text.length}/280</span>
            <Button size="small" onClick={() => copy(text, "Post")}><Copy size={13} /> Copy</Button>
          </div>
          <a className="btn-base btn-primary" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            Post on X <ExternalLink size={14} />
          </a>
          <div className="border-t-2 border-dashed border-[var(--soft)] pt-3 grid gap-2">
            <span className="field-label">Your link</span>
            <div className="flex gap-2">
              <input readOnly className="border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)] font-mono text-xs w-full" value={url} />
              <Button size="small" onClick={() => copy(url, "Link")}><Copy size={13} /></Button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
