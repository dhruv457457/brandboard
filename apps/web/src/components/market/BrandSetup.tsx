"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, Pencil, Upload, X } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { CHAIN_ID } from "@/lib/config";
import { useProfile, type Profile } from "@/lib/profile";
import { useEnsureOnchainName } from "@/lib/market/useOnchainName";

const EVENT = "patched:brand-setup";
const STORE = "patched.brand.ok";
let skipped = false;

interface Request {
  listingId: number;
  resolve: (go: boolean) => void;
}

const key = (listingId: number, wallet: string) => `${CHAIN_ID}:${listingId}:${wallet.toLowerCase()}`;

function confirmedBefore(listingId: number, wallet: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(STORE) ?? "[]") as string[]).includes(key(listingId, wallet));
  } catch {
    return false;
  }
}

function remember(listingId: number, wallet: string) {
  try {
    const all = (JSON.parse(localStorage.getItem(STORE) ?? "[]") as string[]).filter((k) => k !== key(listingId, wallet));
    all.push(key(listingId, wallet));
    localStorage.setItem(STORE, JSON.stringify(all.slice(-200)));
  } catch {
    // Private windows can refuse storage: it then asks again next time, which is harmless.
  }
}

/**
 * Whether to stop before a bid and ask about the brand: no brand yet (create one), or the first bid on this listing
 * (check that this is the brand to bid as). Skipping the creation is remembered for the visit.
 */
export function shouldAskBrand(profile: Profile | null, listingId: number, wallet: string | null | undefined): boolean {
  if (!profile || !wallet) return false;
  if (!profile.brand_name) return !skipped;
  return !confirmedBefore(listingId, wallet);
}

/** Ask about the brand before a bid. Resolves true when the bid should go on, false when the window was closed. */
export function requireBrand(listingId: number): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<Request>(EVENT, { detail: { listingId, resolve } }));
  });
}

/**
 * The brand window, in the middle of the page. With no brand it is "Create your brand" (logo and name). With a brand it
 * asks, on the first bid on each listing, "Bid as this brand?", with a way to change it. Mounted once in the layout;
 * opened by requireBrand().
 */
export function BrandSetupHost() {
  const { profile, save } = useProfile();
  const { walletAddress } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const ensureName = useEnsureOnchainName();
  const [req, setReq] = useState<Request | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [busy, setBusy] = useState<"save" | "logo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = (e: Event) => {
      setName(profile?.brand_name ?? "");
      setLogo(profile?.brand_logo_url ?? "");
      setError(null);
      setEditing(!profile?.brand_name);
      setReq((e as CustomEvent<Request>).detail);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [profile]);

  const finish = (go: boolean) => {
    if (go && req && walletAddress) remember(req.listingId, walletAddress);
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
  const creating = !profile?.brand_name;

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
    // The name on the patch NFT is written on-chain too (silent for Patched wallets), before the bid goes on.
    await ensureName("brand", brandName);
    setBusy(null);
    finish(true);
  }

  const shownName = profile?.brand_name ?? "";
  const shownLogo = profile?.brand_logo_url ?? "";

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4 bg-[rgba(11,11,12,0.45)] backdrop-blur-xs" onMouseDown={() => finish(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="brand-title" onMouseDown={(e) => e.stopPropagation()}
        className="card-surface w-full max-w-[420px] p-6 grid gap-4 relative">
        <button type="button" onClick={() => finish(false)} aria-label="Close" className="absolute top-3 right-3 w-8 h-8 rounded-full grid place-items-center hover:bg-[var(--soft)]">
          <X size={16} />
        </button>

        {!editing ? (
          <>
            <span className="w-10 h-10 rounded-full grid place-items-center bg-[var(--accent-soft)] text-[var(--accent-text)]"><BadgeCheck size={20} /></span>
            <div className="grid gap-1">
              <h2 id="brand-title" className="text-xl font-extrabold">Bid with this brand?</h2>
              <p className="text-sm text-[var(--muted)]">This is the brand that shows on the spot if you lead it, and on your patch NFT.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-[var(--soft)] p-3">
              <span className="w-14 h-14 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)] grid place-items-center overflow-hidden flex-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {shownLogo ? <img src={shownLogo} alt="" className="w-full h-full object-contain" /> : <Upload size={16} className="text-[var(--muted)]" />}
              </span>
              <span className="grid min-w-0">
                <b className="truncate text-lg">{shownName}</b>
                {!shownLogo && <span className="text-xs text-[var(--muted)]">No logo yet. Add one so people see your mark.</span>}
              </span>
            </div>
            <div className="grid gap-2">
              <button type="button" onClick={() => finish(true)} className="btn-base btn-primary justify-center h-11">Bid as {shownName}</button>
              <button type="button" onClick={() => setEditing(true)} className="btn-base justify-center h-11"><Pencil size={14} /> {shownLogo ? "Change brand" : "Add a logo or change brand"}</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <span className="w-10 h-10 rounded-full grid place-items-center bg-[var(--accent-soft)] text-[var(--accent-text)]"><BadgeCheck size={20} /></span>
            <div className="grid gap-1">
              <h2 id="brand-title" className="text-xl font-extrabold">{creating ? "Create your brand" : "Edit your brand"}</h2>
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
              {creating ? (
                <button type="button" disabled={!!busy} onClick={() => { skipped = true; finish(true); }}
                  className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] py-1">
                  Skip for now
                </button>
              ) : (
                <button type="button" disabled={!!busy} onClick={() => setEditing(false)}
                  className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] py-1">
                  Back
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
