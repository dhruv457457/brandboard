"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { encodeFunctionData, stringToHex } from "viem";
import { Check, Copy, ExternalLink, Fingerprint, KeyRound, LogOut, Upload } from "lucide-react";
import { patchedMarketAbi } from "@patched/shared";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Seg } from "@/components/ui/Seg";
import { toast } from "@/components/ui/Toast";
import { BrandVerify } from "@/components/market/BrandVerify";
import { NetworkOptions } from "@/components/navigation/NetworkSwitch";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useProfile } from "@/lib/profile";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useTx } from "@/lib/market/useTx";
import { friendlyError } from "@/lib/market/useBid";
import { STEP_UP_USD, useStepUp } from "@/lib/market/stepUp";
import { EXPLORER, GAS_SPONSORED, MARKET, CHAIN } from "@/lib/config";
import PageLoading from "@/app/loading";

const TABS = [
  { value: "profile", label: "Profile" },
  { value: "brand", label: "Brand" },
  { value: "security", label: "Security" },
  { value: "network", label: "Network" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const INPUT = "border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)]";
const COLORS = ["#FF5A1F", "#836EF9", "#16A34A", "#F5B400", "#FF6FA4", "#2F9BFF"];

/** Everything you configure, in one place: your public page, your brand, security and the network. */
export function SettingsView() {
  const { ready, authenticated, login } = usePatchedAuth();
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.some((t) => t.value === params.get("tab")) ? params.get("tab") : "profile") as Tab;

  if (!ready) return <PageLoading />;
  if (!authenticated) {
    return (
      <main className="wrap pt-10 pb-24"><Card className="p-8 text-center grid gap-3 justify-items-center">
        <h1 className="text-3xl font-extrabold">Settings</h1>
        <p className="muted">Sign in to edit your page, your brand and your security settings.</p>
        <Button variant="primary" onClick={login}>Sign in</Button>
      </Card></main>
    );
  }

  return (
    <main className="wrap pt-8 pb-24 grid gap-6 max-w-3xl">
      <div>
        <span className="eyebrow">Account</span>
        <h1 className="font-extrabold text-4xl tracking-tight mt-1">Settings</h1>
      </div>
      <div className="overflow-x-auto">
        <Seg options={TABS.map((t) => ({ value: t.value, label: t.label }))} value={tab}
          onChange={(v) => router.replace(`/settings?tab=${v}`, { scroll: false })} />
      </div>
      {tab === "profile" && <ProfileSettings />}
      {tab === "brand" && <BrandSettings />}
      {tab === "security" && <SecuritySettings />}
      {tab === "network" && (
        <Card className="p-5 grid gap-3">
          <h2 className="font-bold text-xl">Network</h2>
          <p className="text-sm text-[var(--muted)]">Patched runs on Monad testnet and on Monad mainnet. Each is its own site with its own listings and bids.</p>
          <NetworkOptions />
        </Card>
      )}
    </main>
  );
}

/** Your public page: name, address (handle), bio and banner colour. */
function ProfileSettings() {
  const { profile, save } = useProfile();
  const { walletAddress } = usePatchedAuth();
  const [form, setForm] = useState({ displayName: "", handle: "", bio: "", bannerColor: "#FF5A1F" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (profile) setForm({ displayName: profile.display_name ?? "", handle: profile.handle ?? "", bio: profile.bio ?? "", bannerColor: profile.banner_color ?? "#FF5A1F" });
  }, [profile]);

  async function onSave() {
    setSaving(true);
    const error = await save({
      displayName: form.displayName, bio: form.bio, bannerColor: form.bannerColor,
      ...(form.handle && form.handle !== profile?.handle ? { handle: form.handle } : {}),
    });
    setSaving(false);
    toast(error ?? "Profile saved.");
  }

  const pageHref = `/${profile?.handle ?? walletAddress?.toLowerCase() ?? ""}`;
  return (
    <Card className="p-5 grid gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-bold text-xl">Your page</h2>
          <p className="text-sm text-[var(--muted)]">What brands see on your profile and next to your listings.</p>
        </div>
        <Link href={pageHref} className="btn-base btn-small">View my page <ExternalLink size={12} /></Link>
      </div>
      <label className="grid gap-1"><span className="field-label">Display name</span>
        <input className={INPUT} maxLength={40} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
      <label className="grid gap-1"><span className="field-label">Handle, your page address</span>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-[var(--muted)] font-mono">patched/</span>
          <input className={INPUT + " flex-1"} maxLength={31} value={form.handle} placeholder="yourname" onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase() })} />
        </div>
      </label>
      <label className="grid gap-1"><span className="field-label">Bio</span>
        <textarea className={INPUT} rows={3} maxLength={200} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label>
      <div className="grid gap-1.5"><span className="field-label">Banner colour</span>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button key={c} aria-label={`Banner colour ${c}`} aria-pressed={form.bannerColor === c} onClick={() => setForm({ ...form, bannerColor: c })}
              className="w-8 h-8 rounded-lg border-2 border-[var(--line)] aria-pressed:shadow-[0_0_0_3px_var(--paper),0_0_0_5px_var(--ink)]" style={{ background: c }} />
          ))}
        </div>
      </div>
      <Button variant="primary" onClick={onSave} disabled={saving || !profile} className="justify-self-start">{saving ? "Saving…" : "Save profile"}</Button>
    </Card>
  );
}

/** The brand shown on every patch you lead: name, logo, website, and the verified badge. */
function BrandSettings() {
  const { profile, save } = useProfile();
  const authedFetch = useAuthedFetch();
  const send = useTx();
  const [busy, setBusy] = useState<string | null>(null);
  const [brand, setBrand] = useState({ name: "", website: "", logo: "" });
  const logoRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (profile) setBrand({ name: profile.brand_name ?? "", website: profile.brand_website ?? "", logo: profile.brand_logo_url ?? "" });
  }, [profile]);

  async function saveBrand() {
    setBusy("brand");
    const error = await save({ brandName: brand.name, brandWebsite: brand.website, brandLogoUrl: brand.logo || null });
    if (error) {
      setBusy(null);
      return toast(error);
    }
    // Also record the name on-chain so receipt NFTs show it.
    if (brand.name && brand.name !== profile?.brand_name) {
      try {
        await send(MARKET, encodeFunctionData({ abi: patchedMarketAbi, functionName: "setBrandName", args: [stringToHex(brand.name.slice(0, 31), { size: 32 })] }));
      } catch (err) {
        toast(`Saved, but the on-chain name wasn't updated: ${friendlyError(err)}`);
        return setBusy(null);
      }
    }
    toast("Brand saved. It shows on every patch you lead.");
    setBusy(null);
  }

  async function uploadLogo(file: File) {
    setBusy("logo");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("bucket", "logos");
      const res = await authedFetch("/api/uploads", { method: "POST", body: form });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed.");
      setBrand((b) => ({ ...b, logo: json.url! }));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5 grid gap-4">
      <div>
        <h2 className="font-bold text-xl">Your brand</h2>
        <p className="text-sm text-[var(--muted)]">Shown on every patch you lead and on your receipt NFTs.</p>
      </div>
      <div className="flex gap-3 items-center">
        <button onClick={() => logoRef.current?.click()} disabled={!!busy} aria-label="Upload brand logo"
          className="w-16 h-16 rounded-xl border-2 border-dashed border-[var(--line)] grid place-items-center overflow-hidden bg-[var(--paper)] flex-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {brand.logo ? <img src={brand.logo} alt="Brand logo" className="w-full h-full object-contain" /> : <Upload size={18} />}
        </button>
        <span className="text-xs muted">{busy === "logo" ? "Uploading…" : "Logo: PNG, SVG or WebP up to 2 MB. Transparent backgrounds look best."}</span>
        <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.target.value = ""; }} />
      </div>
      <label className="grid gap-1"><span className="field-label">Brand name</span>
        <input className={INPUT} maxLength={31} value={brand.name} placeholder="Your brand name" onChange={(e) => setBrand({ ...brand, name: e.target.value })} /></label>
      <label className="grid gap-1"><span className="field-label">Website</span>
        <input className={INPUT} value={brand.website} placeholder="https://" onChange={(e) => setBrand({ ...brand, website: e.target.value })} /></label>
      <Button variant="primary" onClick={saveBrand} disabled={!!busy || !profile} className="justify-self-start">{busy === "brand" ? "Saving…" : "Save brand"}</Button>
      <BrandVerify />
    </Card>
  );
}

/** Your wallet, your passkey for big moves, and exporting the key. */
function SecuritySettings() {
  const { walletAddress, isEmbeddedWallet, exportWallet, logout } = usePatchedAuth();
  const stepUp = useStepUp();
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid gap-4">
      <Card className="p-5 grid gap-3">
        <h2 className="font-bold text-xl">Your wallet</h2>
        <p className="font-mono text-sm break-all select-all">{walletAddress}</p>
        <p className="text-sm text-[var(--muted)]">
          {isEmbeddedWallet
            ? GAS_SPONSORED
              ? `Patched wallet on ${CHAIN.name}. Gas is sponsored, so you don't need MON.`
              : `Patched wallet on ${CHAIN.name}. Send USDC to bid and a little MON for gas to this address.`
            : `External wallet on ${CHAIN.name}. You pay gas in MON for each transaction.`}
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button size="small" onClick={() => walletAddress && navigator.clipboard.writeText(walletAddress).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy address"}
          </Button>
          <a className="btn-base btn-small btn-ghost" href={`${EXPLORER}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer">Explorer <ExternalLink size={13} /></a>
        </div>
      </Card>

      <Card className="p-5 flex items-start justify-between gap-4 flex-wrap">
        <span className="flex gap-3 items-start">
          <Fingerprint size={22} className="flex-none text-[var(--accent-text)] mt-0.5" />
          <span>
            <b className="block">Passkey</b>
            <span className="text-sm text-[var(--muted)]">
              {stepUp.hasPasskey
                ? `On. Bids and sweeps of $${STEP_UP_USD.toLocaleString("en-US")} or more ask for Face ID, Touch ID or Windows Hello first.`
                : `Needed for bids of $${STEP_UP_USD.toLocaleString("en-US")} or more, so a stolen session can't move big money.`}
            </span>
          </span>
        </span>
        {!stepUp.hasPasskey && <Button size="small" variant="primary" onClick={stepUp.setUpPasskey}>Set up passkey</Button>}
      </Card>

      {isEmbeddedWallet && walletAddress && (
        <Card className="p-5 flex items-start justify-between gap-4 flex-wrap">
          <span className="flex gap-3 items-start">
            <KeyRound size={22} className="flex-none text-[var(--accent-text)] mt-0.5" />
            <span>
              <b className="block">Your wallet is yours</b>
              <span className="text-sm text-[var(--muted)]">Export the private key to MetaMask or any wallet. Patched never sees it.</span>
            </span>
          </span>
          <Button size="small" onClick={() => exportWallet({ address: walletAddress }).catch(() => {})}>Export key</Button>
        </Card>
      )}

      <Button variant="ghost" onClick={() => void logout()} className="justify-self-start"><LogOut size={14} /> Sign out</Button>
    </div>
  );
}
