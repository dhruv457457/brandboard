"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { ArrowLeft, Copy, Download, ExternalLink, Loader2, Printer, Share2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Seg } from "@/components/ui/Seg";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
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

type Template = "launch" | "war" | "lastcall" | "thanks";
type Format = "story" | "square" | "x";
type Accent = "orange" | "ink" | "lilac" | "mint";

const TEMPLATES: { value: Template; label: string; hint: string }[] = [
  { value: "launch", label: "Launch", hint: "Announce your spots" },
  { value: "war", label: "Bidding war", hint: "Show the bids piling up" },
  { value: "lastcall", label: "Last call", hint: "Spots left and time to close" },
  { value: "thanks", label: "Thank sponsors", hint: "Shout out the brands on you" },
];
const FORMATS: { value: Format; label: string; ratio: string }[] = [
  { value: "story", label: "Story", ratio: "9 / 16" },
  { value: "square", label: "Square", ratio: "1 / 1" },
  { value: "x", label: "X post", ratio: "1200 / 630" },
];
const ACCENTS: { value: Accent; color: string; label: string }[] = [
  { value: "orange", color: "#FF5A1F", label: "Orange" },
  { value: "ink", color: "#0B0B0C", label: "Ink" },
  { value: "lilac", color: "#D9CCFF", label: "Lilac" },
  { value: "mint", color: "#BDEBD3", label: "Mint" },
];

export function ShareKit({ listing }: { listing: ShareListing }) {
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template>("launch");
  const [format, setFormat] = useState<Format>("story");
  const [accent, setAccent] = useState<Accent>("orange");
  const [headline, setHeadline] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = origin ? `${origin}${listing.path}` : "";

  // Wait for typing to pause before re-rendering the poster.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(headline.trim()), 500);
    return () => clearTimeout(t);
  }, [headline]);

  const poster = useMemo(() => {
    const q = new URLSearchParams({ format, template, accent, ...(debounced ? { headline: debounced } : {}) });
    return `/share/${listing.id}/poster?${q}`;
  }, [format, template, accent, debounced, listing.id]);
  useEffect(() => setLoading(true), [poster]);

  const posts = useMemo<Record<Template, string>>(() => {
    const where = listing.eventName ? ` at ${listing.eventName}` : "";
    const left = origin ? formatCountdown(listing.biddingEndsAt) : null;
    const closes = left && !left.hasEnded ? `Bidding closes in ${left.text.split(" ")[0]}.` : "";
    return {
      launch:
        `I'm getting patched${where}.\n\n${listing.patchCount} logo spots, brands bid in USDC and the money sits in escrow until I show up.\n\n` +
        `Pick a spot: ${url}`,
      war: `The bidding on "${listing.title}" is heating up: ${formatUsdc(listing.topBidsTotal)} in bids so far.\n\n${closes}\n\nGet in: ${url}`,
      lastcall:
        `Last call: ${listing.openCount} of ${listing.patchCount} spots still open on "${listing.title}". ${closes}\n\n` +
        `${formatUsdc(listing.topBidsTotal)} in bids so far: ${url}`,
      thanks: listing.leaderBrands.length
        ? `Thank you ${listing.leaderBrands.join(", ")} for sponsoring "${listing.title}".\n\nA few spots are still open: ${url}`
        : `No brand has claimed a spot on "${listing.title}" yet. Be the first: ${url}`,
    };
  }, [listing, origin, url]);

  useEffect(() => setText(posts[template]), [posts, template]);
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

  /** Phone share sheet with the poster file (Instagram, WhatsApp...), or copy the image on desktop. */
  async function sharePoster() {
    try {
      const blob = await (await fetch(poster)).blob();
      const file = new File([blob], `patched-${listing.id}-${format}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: posts[template] });
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast("Poster copied. Paste it into your post.");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast("Sharing isn't available here. Use Download instead.");
    }
  }

  const ratio = FORMATS.find((f) => f.value === format)!.ratio;

  return (
    <main className="wrap pt-6 pb-24 grid gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Link href={listing.path} className="btn-base btn-ghost btn-small mb-2"><ArrowLeft size={14} /> Back to your page</Link>
          <span className="eyebrow block">Share kit</span>
          <h1 className="font-extrabold text-4xl tracking-tight mt-1">{listing.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button size="small" onClick={() => copy(url, "Link")}><Copy size={13} /> Copy link</Button>
          <a href={listing.path} className="btn-base btn-small" target="_blank" rel="noopener noreferrer">Open page <ExternalLink size={12} /></a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] items-start">
        {/* ── Poster maker ── */}
        <Card className="p-5 grid gap-5 lg:grid-cols-[1fr_minmax(0,300px)] items-start">
          <div className="grid gap-4 content-start">
            <div>
              <h2 className="font-bold text-xl">Make a poster</h2>
              <p className="text-sm text-[var(--muted)]">Live numbers, your spots and a QR code that opens your page.</p>
            </div>
            <div className="grid gap-1.5">
              <span className="field-label">Format</span>
              <Seg options={FORMATS.map((f) => ({ value: f.value, label: f.label }))} value={format} onChange={(v) => setFormat(v as Format)} />
            </div>
            <div className="grid gap-1.5">
              <span className="field-label">Moment</span>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTemplate(t.value)}
                    aria-pressed={template === t.value}
                    className="text-left rounded-xl border-2 px-3 py-2 border-[var(--soft)] hover:border-[var(--muted)] aria-pressed:border-[var(--line)] aria-pressed:bg-[var(--accent-soft)]"
                  >
                    <b className="block text-sm">{t.label}</b>
                    <span className="text-xs text-[var(--muted)]">{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="field-label">Colour</span>
              <div className="flex gap-2">
                {ACCENTS.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setAccent(a.value)}
                    aria-label={a.label}
                    aria-pressed={accent === a.value}
                    className={cn("w-9 h-9 rounded-xl border-2 border-[var(--line)]", accent === a.value && "ring-4 ring-[var(--accent)]/40")}
                    style={{ background: a.color }}
                  />
                ))}
              </div>
            </div>
            <label className="grid gap-1.5">
              <span className="field-label">Headline (optional)</span>
              <input
                className="border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)] text-sm"
                maxLength={60}
                value={headline}
                placeholder="Leave empty to use the moment's headline"
                onChange={(e) => setHeadline(e.target.value)}
              />
            </label>
            <div className="flex gap-2 flex-wrap">
              <a href={`${poster}&download=1`} className="btn-base btn-primary"><Download size={15} /> Download PNG</a>
              <Button onClick={sharePoster}><Share2 size={15} /> Share</Button>
            </div>
          </div>

          <div className="relative w-full mx-auto max-w-[300px] rounded-2xl overflow-hidden border-2 border-[var(--line)] bg-[var(--soft)]" style={{ aspectRatio: ratio }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={poster} src={poster} alt="Poster preview" className="absolute inset-0 w-full h-full object-contain" onLoad={() => setLoading(false)} onError={() => setLoading(false)} />
            {loading && (
              <div className="absolute inset-0 grid place-items-center bg-[var(--soft)]/80">
                <Loader2 className="animate-spin" />
              </div>
            )}
          </div>
        </Card>

        {/* ── Post, link, QR ── */}
        <div className="grid gap-6">
          <Card className="p-5 grid gap-3">
            <h2 className="font-bold text-xl">Post it on X</h2>
            <p className="text-sm text-[var(--muted)]">Text for the <b>{TEMPLATES.find((t) => t.value === template)?.label}</b> moment. Attach the poster for the most reach.</p>
            <textarea className="border-2 border-[var(--line)] rounded-xl p-3 bg-[var(--paper)] min-h-[150px] text-sm" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex justify-between items-center">
              <span className={cn("font-mono text-xs", text.length > 280 ? "text-[var(--red)]" : "muted")}>{text.length}/280</span>
              <Button size="small" onClick={() => copy(text, "Post")}><Copy size={13} /> Copy</Button>
            </div>
            <a className="btn-base btn-primary" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
              Post on X <ExternalLink size={14} />
            </a>
          </Card>

          <Card className="p-5 flex gap-5 items-center flex-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt="QR code for your page" className="w-32 h-32 rounded-xl border-2 border-[var(--line)]" /> : <div className="w-32 h-32 rounded-xl bg-[var(--soft)]" />}
            <div className="grid gap-2 max-w-[30ch]">
              <b>Put it on your patches</b>
              <p className="text-sm muted">People who see your patches scan it and land on your page, so every photo can bring in the next bidder.</p>
              <div className="flex gap-2 flex-wrap">
                {qr && <a href={qr} download={`patched-${listing.id}-qr.png`} className="btn-base btn-small">QR code</a>}
                <a href={`/share/${listing.id}/poster?format=stickers&accent=${accent}&download=1`} className="btn-base btn-small"><Printer size={13} /> Sticker sheet</a>
              </div>
            </div>
          </Card>

          <Card className="p-5 grid gap-2">
            <b>Link preview</b>
            <p className="text-sm muted">What people see when your link is pasted on X, Telegram or Discord.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${listing.path}/opengraph-image`} alt="Link preview" className="w-full rounded-xl border-2 border-[var(--line)]" />
          </Card>
        </div>
      </div>
    </main>
  );
}
