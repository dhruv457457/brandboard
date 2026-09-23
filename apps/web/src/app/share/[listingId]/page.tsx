"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Copy,
  ExternalLink,
  Link as LinkIcon,
  Camera,
  Trophy,
  LayoutGrid,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/brand/Logo";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import { FIXTURE_LISTINGS } from "@/lib/data/fixtures";
import { toast } from "sonner";

interface SharePageProps {
  params: Promise<{
    listingId: string;
  }>;
}

type TemplateKey = "launch" | "left" | "sold" | "brand";

const TEMPLATES: Record<TemplateKey, (creator: string, event: string) => string> = {
  launch: (creator, event) =>
    `I'm getting patched at ${event}.\n\n7 spots on my outfit. Brands bid in USDC, and the top bid gets worn in front of 20k attendees.\n\nBidding closes in 2 days:\nhttps://patched.fun/${creator}`,
  left: (creator, event) =>
    `3 patches left on my ${event} fit.\n\nThe neckline already went for $420. Hips and hem are still open.\n\nhttps://patched.fun/${creator}`,
  sold: (creator, event) =>
    `Fully patched!\n\n7/7 spots sold · $2,340 raised on @patched.\nSee you all at ${event}!`,
  brand: (creator, event) =>
    `We just claimed a patch on @${creator}'s ${event} fit.\n\nFind our logo right on the neckline.\nhttps://patched.fun/${creator}`,
};

export default function ShareKitPage({ params }: SharePageProps) {
  const resolvedParams = React.use(params);
  const listing =
    FIXTURE_LISTINGS.find(
      (l) => l.id === resolvedParams.listingId || l.creatorHandle === resolvedParams.listingId
    ) || FIXTURE_LISTINGS[0];

  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>("launch");
  const [xPostText, setXPostText] = useState(
    TEMPLATES.launch(listing.creatorHandle, listing.eventName || listing.event || listing.title)
  );
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR pattern
  useEffect(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const n = 21;
    const s = 132 / n;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 132, 132);
    ctx.fillStyle = "#0B0B0C";

    let seed = 12;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (rnd() > 0.54) {
          ctx.fillRect(i * s, j * s, s, s);
        }
      }
    }

    // Corner finder patterns
    const corners = [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ];
    corners.forEach(([a, b]) => {
      ctx.fillStyle = "#0B0B0C";
      ctx.fillRect(a * s, b * s, 7 * s, 7 * s);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect((a + 1) * s, (b + 1) * s, 5 * s, 5 * s);
      ctx.fillStyle = "#FF5A1F";
      ctx.fillRect((a + 2) * s, (b + 2) * s, 3 * s, 3 * s);
    });
  }, []);

  const handleSelectTemplate = (tpl: TemplateKey) => {
    setActiveTemplate(tpl);
    setXPostText(TEMPLATES[tpl](listing.creatorHandle, listing.eventName || listing.event || listing.title));
  };

  const handleCopyX = () => {
    navigator.clipboard.writeText(xPostText);
    toast.success("Post copy copied to clipboard!");
  };

  const handleCopyBadge = () => {
    const code = `<a href="https://patched.fun/${listing.creatorHandle}"><img src="https://patched.fun/b/${listing.creatorHandle}.svg" alt="Patch me on Patched"></a>`;
    navigator.clipboard.writeText(code);
    toast.success("Bio badge HTML copied to clipboard!");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
          Published · now get it seen
        </span>
        <h1 className="font-display font-extrabold text-3xl sm:text-5xl text-[var(--ink)] tracking-tight mt-1">
          Share kit
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
        {/* Left Column: Visual Previews */}
        <div className="space-y-6">
          <div>
            <p className="text-xs text-[var(--muted)] mb-2">
              Link preview: appears automatically when your link is pasted on X,
              Telegram or Discord
            </p>

            {/* OG Card Mockup (1200x630 aspect ratio) */}
            <div className="aspect-[1200/630] w-full rounded-2xl border-2 border-[var(--line)] shadow-[4px_4px_0_var(--shadow)] overflow-hidden bg-[#FFE58F] grid grid-cols-[34%_1fr]">
              <div className="bg-[var(--stage)] border-r-2 border-[var(--line)] flex items-center justify-center p-4">
                <div className="h-[85%] w-auto flex items-center justify-center">
                  <SurfaceFigure
                    surface={listing.surface}
                    patches={listing.patches}
                    mode="static"
                    showPrices={false}
                  />
                </div>
              </div>

              <div className="p-4 sm:p-6 flex flex-col justify-between text-[#0B0B0C]">
                <div className="flex items-center gap-2 font-display font-extrabold text-lg sm:text-xl tracking-tight">
                  <Logo size={24} />
                  <span>patched</span>
                </div>

                <div>
                  <h3 className="font-display font-extrabold text-lg sm:text-2xl tracking-tight text-[#0B0B0C] line-clamp-2">
                    {listing.creatorName} is getting patched at {listing.eventName || listing.event || listing.title}
                  </h3>

                  <div className="flex items-center gap-4 font-mono text-xs sm:text-sm mt-2">
                    <div>
                      <b className="block text-sm sm:text-lg">4/7</b> patches
                    </div>
                    <div>
                      <b className="block text-sm sm:text-lg">$1,355</b> top bids
                    </div>
                    <div>
                      <b className="block text-sm sm:text-lg">2d 5h</b> left
                    </div>
                  </div>
                </div>

                <div className="font-mono text-xs bg-[#0B0B0C] text-[#FAFAF7] rounded-md px-3 py-1 self-start font-semibold">
                  patched.fun/{listing.creatorHandle}
                </div>
              </div>
            </div>
          </div>

          {/* Story & QR Subgrid */}
          <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-6 items-start">
            {/* Story Card (9:16) */}
            <div>
              <p className="text-xs text-[var(--muted)] mb-2">Story card · 9:16</p>
              <div className="aspect-[9/16] w-full max-w-[220px] rounded-2xl border-2 border-[var(--line)] bg-[var(--accent)] p-4 shadow-[4px_4px_0_var(--shadow)] flex flex-col justify-between text-[#0B0B0C]">
                <div className="font-display font-black text-lg tracking-tight">
                  patched
                </div>
                <div className="flex items-center justify-center py-2">
                  <div className="h-[180px] w-auto">
                    <SurfaceFigure
                      surface={listing.surface}
                      patches={listing.patches}
                      mode="static"
                      showPrices={false}
                    />
                  </div>
                </div>
                <h3 className="font-display font-extrabold text-lg tracking-tight text-[#0B0B0C]">
                  3 patches left
                </h3>
              </div>
            </div>

            {/* QR & Bio Badge Box */}
            <div className="space-y-4">
              <Card className="p-4 flex items-center gap-4 flex-wrap">
                <canvas
                  ref={qrCanvasRef}
                  width={132}
                  height={132}
                  className="rounded-xl border-2 border-[var(--line)] bg-white flex-none"
                  aria-label="Patch QR code"
                />
                <div className="space-y-1">
                  <b className="text-sm text-[var(--ink)] block">
                    Printed on the patch itself
                  </b>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    People at the conference scan it directly from your outfit and
                    land on your auction page.
                  </p>
                  <p className="font-hand text-base text-[var(--accent-text)] -rotate-1">
                    instant scan · Monad speed
                  </p>
                </div>
              </Card>

              <Card className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-display font-bold text-base text-[var(--ink)]">
                    Bio badge
                  </h3>
                  <button
                    type="button"
                    onClick={handleCopyBadge}
                    className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> Copy embed
                  </button>
                </div>

                <div className="inline-flex items-center gap-2 border-2 border-[var(--line)] rounded-full px-3 py-1 bg-[var(--card)] shadow-[2px_2px_0_var(--shadow)] text-xs font-bold">
                  <Logo size={18} />
                  <span>Patch me · patched.fun/{listing.creatorHandle}</span>
                </div>

                <code className="block font-mono text-[11px] bg-[var(--soft)] p-2 rounded-lg text-[var(--muted)] overflow-x-auto whitespace-nowrap">
                  {`<a href="https://patched.fun/${listing.creatorHandle}"><img src="https://patched.fun/b/${listing.creatorHandle}.svg"></a>`}
                </code>
              </Card>
            </div>
          </div>
        </div>

        {/* Right Column: Post to X & Built-in Perks */}
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="font-display font-bold text-xl text-[var(--ink)]">
              Post it on X
            </h3>

            {/* Template Buttons */}
            <div className="flex gap-1.5 flex-wrap">
              {(["launch", "left", "sold", "brand"] as TemplateKey[]).map((tpl) => (
                <Button
                  key={tpl}
                  size="sm"
                  variant={activeTemplate === tpl ? "default" : "ghost"}
                  onClick={() => handleSelectTemplate(tpl)}
                  className="capitalize"
                >
                  {tpl === "launch"
                    ? "Launch"
                    : tpl === "left"
                    ? "Last call"
                    : tpl === "sold"
                    ? "Sold out"
                    : "Brand"}
                </Button>
              ))}
            </div>

            <div>
              <label
                htmlFor="xpost-text"
                className="block text-xs text-[var(--muted)] mb-1"
              >
                AI copy suggestion · edit before posting
              </label>
              <textarea
                id="xpost-text"
                value={xPostText}
                onChange={(e) => setXPostText(e.target.value)}
                className="w-full min-h-[140px] rounded-xl border-2 border-[var(--line)] bg-[var(--paper)] p-3 text-sm focus:outline-hidden focus:border-[var(--accent)] resize-y leading-relaxed font-sans"
              />
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="font-mono text-[var(--muted)]">
                {xPostText.length} / 280
              </span>
              <Button size="sm" variant="ghost" onClick={handleCopyX}>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copy
              </Button>
            </div>

            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                xPostText
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline block"
            >
              <Button variant="primary" className="w-full">
                Post on X <ExternalLink className="w-4 h-4 ml-1.5" />
              </Button>
            </a>

            <hr className="border-dashed border-[var(--soft)] my-4" />

            {/* Perks */}
            <div className="space-y-3">
              <h4 className="font-display font-bold text-base text-[var(--ink)]">
                Also built in
              </h4>
              <div className="space-y-2 text-xs text-[var(--muted)]">
                <div className="flex items-start gap-2">
                  <LinkIcon className="w-4 h-4 text-[var(--accent)] flex-none mt-0.5" />
                  <span>
                    <b>Referral link:</b> Earn 1% protocol fee when any brand you
                    invited bids anywhere.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Camera className="w-4 h-4 text-[var(--green)] flex-none mt-0.5" />
                  <span>
                    <b>Recap carousel:</b> Automated post-event image recap
                    generated by AI.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Trophy className="w-4 h-4 text-[var(--monad)] flex-none mt-0.5" />
                  <span>
                    <b>Weekly leaderboard:</b> Featured on @patched official social
                    accounts.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <LayoutGrid className="w-4 h-4 text-[var(--ink)] flex-none mt-0.5" />
                  <span>
                    <b>Wall of brands:</b> Permanent on-chain showcase of sponsors
                    who backed you.
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
