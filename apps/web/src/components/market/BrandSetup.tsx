"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, Upload, X } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useProfile, type Profile } from "@/lib/profile";
import { useEnsureOnchainName } from "@/lib/market/useOnchainName";

const EVENT = "patched:brand-setup";
let skipped = false;

interface Request {
  resolve: (go: boolean) => void;
}

/** A brand needs a name and a logo before it bids, or its patch shows a wallet address. */
export function brandIncomplete(profile: Profile | null): boolean {
  return !!profile && !skipped && (!profile.brand_name || !profile.brand_logo_url);
}

/**
 * Ask for the brand before a bid. Resolves true when the bid should go on (saved, or skipped for now) and false when
 * the person closed the window. Skipping is remembered for the visit, so it asks once, not on every bid.
 */
export function requireBrand(): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<Request>(EVENT, { detail: { resolve } }));
  });
}

/**
 * "Create your brand", in the middle of the page: logo and name, saved to the profile and written on-chain for the
 * patch NFT. Mounted once in the layout; opened by requireBrand().
 */
export function BrandSetupHost() {
  const { profile, save } = useProfile();
  const authedFetch = useAuthedFetch();
  const ensureName = useEnsureOnchainName();
  const [req, setReq] = useState<Request | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [busy, setBusy] = useState<"save" | "logo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const r = (e as CustomEvent<Request>).detail;
      setName(profile?.brand_name ?? "");
      setLogo(profile?.brand_logo_url ?? "");
      setError(null);
      setReq(r);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [profile]);

  const finish = (go: boolean) => {
    req?.resolve(go);
    setReq(null);
  };

  useEffect(() => {
    if (!req) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && finish(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  });

  if (!req) return null;

  async function upload(f: File) {
    setBusy("logo");
    setError(null);
    try {
      const form = new FormData();
      form.set("file", f);
      form.set("bucket", "logos");
      const res = await authedFetch("/api/uploads", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed. Try again.");
      setLogo(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const brandName = name.trim();
    if (!brandName) return setError("Give your brand a name.");
    setBusy("save");
    setError(null);
    const problem = await save({ brandName, brandLogoUrl: logo || null });
    if (problem) {
      setBusy(null);
      return setError(problem);
    }
    toast("Brand saved. It shows on every patch you lead.");
    // The name on the patch NFT is written on-chain too (silent for Patched wallets).
    await ensureName("brand", brandName);
    setBusy(null);
    finish(true);
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4 bg-[rgba(11,11,12,0.45)] backdrop-blur-xs" onMouseDown={() => finish(false)}>
      <form role="dialog" aria-modal="true" aria-labelledby="brand-title" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}
        className="card-surface w-full max-w-[420px] p-6 grid gap-4 relative">
        <button type="button" onClick={() => finish(false)} aria-label="Close" className="absolute top-3 right-3 w-8 h-8 rounded-full grid place-items-center hover:bg-[var(--soft)]">
          <X size={16} />
        </button>
        <span className="w-10 h-10 rounded-full grid place-items-center bg-[var(--accent-soft)] text-[var(--accent-text)]"><BadgeCheck size={20} /></span>
        <div className="grid gap-1">
          <h2 id="brand-title" className="text-xl font-extrabold">Create your brand</h2>
          <p className="text-sm text-[var(--muted)]">This is what shows on the spot when you lead it, and on your patch NFT. It takes a few seconds.</p>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => file.current?.click()} disabled={!!busy} aria-label="Upload your logo"
            className="w-16 h-16 rounded-xl border-2 border-dashed border-[var(--line)] grid place-items-center overflow-hidden bg-[var(--paper)] flex-none">
            {busy === "logo" ? <Loader2 size={18} className="animate-spin" />
              // eslint-disable-next-line @next/next/no-img-element
              : logo ? <img src={logo} alt="Your logo" className="w-full h-full object-contain" /> : <Upload size={18} />}
          </button>
          <span className="text-xs text-[var(--muted)]">Your logo: PNG, SVG or WebP up to 2 MB. A transparent background looks best.</span>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
        </div>

        <label className="grid gap-1">
          <span className="field-label">Brand name</span>
          <input autoFocus maxLength={31} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your brand name"
            className="h-11 px-3.5 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)]" />
        </label>

        {error && <p className="text-sm text-[var(--red)]" role="alert">{error}</p>}

        <div className="grid gap-2">
          <button type="submit" disabled={!!busy} className="btn-base btn-primary justify-center h-11">
            {busy === "save" ? <Loader2 size={16} className="animate-spin" /> : null} Save and continue
          </button>
          <button type="button" disabled={!!busy} onClick={() => { skipped = true; finish(true); }}
            className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] py-1">
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}
