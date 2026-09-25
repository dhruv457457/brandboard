"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { encodeFunctionData, erc20Abi, stringToHex } from "viem";
import { Copy, Droplet, ExternalLink, Upload } from "lucide-react";
import { patchedMarketAbi, patchReceiptAbi, testUsdAbi } from "@patched/shared";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { toast } from "@/components/ui/Toast";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useProfile } from "@/lib/profile";
import { useAuthedFetch } from "@/lib/authedFetch";
import { CHAIN_ID, EXPLORER, MARKET, RECEIPT, TEST_TOKEN, USDC, publicClient } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { formatShortAddress, formatTimeAgo, formatUsdc, parseUsdc } from "@/lib/format";
import { friendlyError } from "@/lib/market/useBid";
import { useTx } from "@/lib/market/useTx";
import { BrandVerify } from "@/components/market/BrandVerify";
import { Skeleton } from "@/components/ui/Skeleton";

const usd = (v: number | string | bigint) => formatUsdc(Number(v) / 1e6);
const INPUT = "border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)]";

/** Receipt art is drawn on-chain (one RPC call each), so keep what we fetched for this session. */
const receiptArt = new Map<string, string | null>();
async function receiptImage(tokenId: string): Promise<string | null> {
  if (receiptArt.has(tokenId)) return receiptArt.get(tokenId)!;
  let image: string | null = null;
  try {
    const uri = await publicClient.readContract({ address: RECEIPT, abi: patchReceiptAbi, functionName: "tokenURI", args: [BigInt(tokenId)] });
    image = JSON.parse(atob(uri.replace("data:application/json;base64,", ""))).image ?? null;
  } catch { /* token art unavailable */ }
  receiptArt.set(tokenId, image);
  return image;
}

interface Row {
  listing_id: number;
  patch_id: number;
  label: string;
  top_bid: number;
  top_bidder: string | null;
  bought: boolean;
  title: string;
  href: string;
  status: number;
}
interface ReceiptRow {
  token_id: string;
  listing_id: number;
  patch_id: number;
  owner: string;
  resale_price: number | null;
  label: string;
  title: string;
  href: string;
  image: string | null;
}

export default function MyBidsPage() {
  const { ready, authenticated, login, walletAddress } = usePatchedAuth();
  const { profile, save } = useProfile();
  const authedFetch = useAuthedFetch();
  const send = useTx();
  const me = walletAddress?.toLowerCase();

  const [leading, setLeading] = useState<Row[]>([]);
  const [outbid, setOutbid] = useState<Row[]>([]);
  const [mine, setMine] = useState<ReceiptRow[]>([]);
  const [market, setMarket] = useState<ReceiptRow[]>([]);
  const [history, setHistory] = useState<{ id: string; label: string; title: string; amount: number; time: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const [brand, setBrand] = useState({ name: "", website: "", logo: "" });
  const logoRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (profile) setBrand({ name: profile.brand_name ?? "", website: profile.brand_website ?? "", logo: profile.brand_logo_url ?? "" });
  }, [profile]);

  const load = useCallback(async () => {
    if (!me) return;
    const db = supabase();
    const [{ data: myBids }, { data: myReceipts }, { data: forSale }] = await Promise.all([
      db.from("bids").select("tx_hash, log_index, listing_id, patch_id, amount, block_time").eq("chain_id", CHAIN_ID).eq("bidder", me).order("block_number", { ascending: false }).limit(100),
      db.from("receipts").select("token_id, listing_id, patch_id, owner, resale_price").eq("chain_id", CHAIN_ID).eq("owner", me),
      db.from("receipts").select("token_id, listing_id, patch_id, owner, resale_price").eq("chain_id", CHAIN_ID).not("resale_price", "is", null).neq("owner", me),
    ]);
    const ids = [...new Set([...(myBids ?? []), ...(myReceipts ?? []), ...(forSale ?? [])].map((r) => r.listing_id))];
    const [{ data: cards }, { data: patches }] = ids.length
      ? await Promise.all([
          db.from("listing_cards").select("listing_id, creator, creator_handle, status, metadata").eq("chain_id", CHAIN_ID).in("listing_id", ids),
          db.from("patches").select("listing_id, patch_id, label, top_bid, top_bidder, bought").eq("chain_id", CHAIN_ID).in("listing_id", ids),
        ])
      : [{ data: [] as never[] }, { data: [] as never[] }];

    const info = (listingId: number, patchId: number) => {
      const c = cards?.find((x) => x.listing_id === listingId);
      const meta = c?.metadata as { title?: string; patches?: { id: number; name: string }[] } | null;
      const p = patches?.find((x) => x.listing_id === listingId && x.patch_id === patchId);
      return {
        title: meta?.title ?? `Listing #${listingId}`,
        label: meta?.patches?.find((x) => x.id === patchId)?.name ?? p?.label ?? `Patch ${patchId}`,
        href: `/${c?.creator_handle ?? c?.creator}/${listingId}`,
        status: c?.status ?? 0,
        patch: p,
      };
    };

    const seen = new Set<string>();
    const lead: Row[] = [];
    const lost: Row[] = [];
    for (const b of myBids ?? []) {
      const key = `${b.listing_id}:${b.patch_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const i = info(b.listing_id, b.patch_id);
      if (!i.patch || i.status !== 1) continue;
      const row = { ...i.patch, title: i.title, label: i.label, href: i.href, status: i.status } as Row;
      (i.patch.top_bidder === me ? lead : lost).push(row);
    }
    setLeading(lead);
    setOutbid(lost);
    setHistory((myBids ?? []).slice(0, 30).map((b) => {
      const i = info(b.listing_id, b.patch_id);
      return { id: `${b.tx_hash}:${b.log_index}`, label: i.label, title: i.title, amount: b.amount, time: b.block_time };
    }));

    // Show the rows now; each receipt's on-chain art fills in as it arrives.
    const toRow = (r: { token_id: string; listing_id: number; patch_id: number; owner: string; resale_price: number | null }): ReceiptRow => {
      const i = info(r.listing_id, r.patch_id);
      const token_id = String(r.token_id);
      return { ...r, token_id, label: i.label, title: i.title, href: i.href, image: receiptArt.get(token_id) ?? null };
    };
    const own = (myReceipts ?? []).map(toRow);
    const sale = (forSale ?? []).map(toRow);
    setMine(own);
    setMarket(sale);
    setLoading(false);
    const withArt = (set: typeof setMine) => (row: ReceiptRow) =>
      receiptImage(row.token_id).then((image) => image && set((rs) => rs.map((x) => (x.token_id === row.token_id ? { ...x, image } : x))));
    own.filter((r) => !r.image).forEach(withArt(setMine));
    sale.filter((r) => !r.image).forEach(withArt(setMarket));
  }, [me]);

  // Load straight away; catch the indexer up alongside and reload only if it found new events.
  useEffect(() => {
    void load();
    fetch("/api/indexer/sync", { method: "POST" })
      .then((r) => r.json())
      .then((r: { logs?: number }) => {
        if ((r.logs ?? 0) > 0) void load();
      })
      .catch(() => {});
  }, [load]);

  async function run(key: string, label: string, calls: { to: `0x${string}`; data: `0x${string}` }[]) {
    setBusy(key);
    try {
      for (const c of calls) await send(c.to, c.data);
      await fetch("/api/indexer/sync", { method: "POST" });
      toast(label);
      await load();
    } catch (err) {
      toast(friendlyError(err).replace("The bid didn't", "That didn't"));
    } finally {
      setBusy(null);
    }
  }

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

  /** Test run only: mint 1,000 tUSD from the TestUSD faucet (once a day per wallet). */
  async function claimFaucet() {
    if (!walletAddress) return;
    setBusy("faucet");
    try {
      // Surfaces FaucetCooldown by name instead of a bare revert.
      await publicClient.simulateContract({ address: USDC, abi: testUsdAbi, functionName: "faucet", account: walletAddress });
      await send(USDC, encodeFunctionData({ abi: testUsdAbi, functionName: "faucet" }));
      toast("1,000 test USD added to your wallet.");
    } catch (err) {
      toast(friendlyError(err).replace("The bid didn't", "That didn't"));
    } finally {
      setBusy(null);
    }
  }

  /** Wallets are funded with USDC only: copy the address to send USDC on Monad from another wallet or exchange. */
  function copyAddress() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress)
      .then(() => toast("Wallet address copied. Send USDC on Monad to it."))
      .catch(() => toast(walletAddress));
  }

  const leadTotal = useMemo(() => leading.reduce((s, r) => s + Number(r.top_bid), 0), [leading]);

  if (!ready) return <BidsSkeleton />;
  if (!authenticated) {
    return (
      <main className="wrap pt-10 pb-24"><Card className="p-8 text-center grid gap-3 justify-items-center">
        <h1 className="text-3xl font-extrabold">My bids</h1>
        <p className="muted">Sign in to see your bids, the patches you won and their receipts.</p>
        <Button variant="primary" onClick={login}>Sign in</Button>
      </Card></main>
    );
  }

  return (
    <main className="wrap pt-8 pb-24 grid gap-8">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <span className="eyebrow">My bids</span>
          <h1 className="font-extrabold text-4xl tracking-tight mt-1">{profile?.brand_name || "Your brand"}</h1>
        </div>
        {TEST_TOKEN ? (
          <Button onClick={claimFaucet} disabled={busy === "faucet"}>
            <Droplet size={15} /> {busy === "faucet" ? "Minting…" : "Get 1,000 test USD"}
          </Button>
        ) : (
          <Button onClick={copyAddress}><Copy size={15} /> Copy wallet address</Button>
        )}
      </div>

      <Card className="grid grid-cols-2 sm:grid-cols-4">
        <div className="kpi"><b>{loading ? "–" : usd(leadTotal)}</b><span>in escrow, leading</span></div>
        <div className="kpi"><b>{loading ? "–" : leading.length}</b><span>patches you lead</span></div>
        <div className="kpi"><b>{loading ? "–" : outbid.length}</b><span>outbid, still open</span></div>
        <div className="kpi"><b>{loading ? "–" : mine.length}</b><span>patches won</span></div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
        <div className="grid gap-6">
          <section className="grid gap-3">
            <h2 className="font-extrabold text-2xl">Live auctions</h2>
            {loading ? <div className="grid gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div> : leading.length + outbid.length === 0 ? (
              <Card className="p-6"><p className="muted">You have no bids on live auctions. <Link href="/explore" className="underline">Find a patch</Link>.</p></Card>
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead><tr className="text-left font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
                    {["Patch", "Listing", "Top bid", "Status", ""].map((h) => <th key={h} className="p-3 border-b-2 border-[var(--line)]">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {[...leading, ...outbid].map((r) => (
                      <tr key={`${r.listing_id}:${r.patch_id}`} className="border-b border-[var(--soft)]">
                        <td className="p-3 font-semibold">{r.label}</td>
                        <td className="p-3">{r.title}</td>
                        <td className="p-3 font-mono">{usd(r.top_bid)}</td>
                        <td className="p-3">{r.top_bidder === me ? <Pill variant="top">{r.bought ? "Bought" : "You lead"}</Pill> : <Pill variant="out">Outbid</Pill>}</td>
                        <td className="p-3"><Link href={r.href} className="btn-base btn-small">{r.top_bidder === me ? "View" : "Bid again"}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>

          <section className="grid gap-3">
            <h2 className="font-extrabold text-2xl">Patches you won</h2>
            {!loading && mine.length === 0 && <Card className="p-6"><p className="muted">Won patches show up here with their receipt NFT when bidding closes.</p></Card>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mine.map((r) => (
                <Card key={r.token_id} className="p-4 grid gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.image ? <img src={r.image} alt={`Receipt for ${r.label}`} className="w-full rounded-xl border-2 border-[var(--line)]" /> : <Skeleton className="aspect-square" />}
                  <div>
                    <b>{r.label}</b>
                    <p className="text-sm muted">{r.title} · receipt #{r.listing_id}-{r.patch_id}</p>
                  </div>
                  {r.resale_price ? (
                    <div className="flex justify-between items-center gap-2">
                      <Pill variant="wait">For resale at {usd(r.resale_price)}</Pill>
                      <Button size="small" variant="ghost" disabled={!!busy}
                        onClick={() => run(`c${r.token_id}`, "Resale listing removed.", [{ to: MARKET, data: encodeFunctionData({ abi: patchedMarketAbi, functionName: "cancelResale", args: [BigInt(r.token_id)] }) }])}>
                        Stop selling
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input className={INPUT + " font-mono w-full"} placeholder="Resale price, USDC" inputMode="decimal"
                        value={prices[r.token_id] ?? ""} onChange={(e) => setPrices((p) => ({ ...p, [r.token_id]: e.target.value }))} />
                      <Button size="small" disabled={!!busy || !(parseUsdc(prices[r.token_id] ?? "") > 0n)}
                        onClick={() => run(`l${r.token_id}`, "Listed for resale. The creator gets 5% when it sells.", [{
                          to: MARKET, data: encodeFunctionData({ abi: patchedMarketAbi, functionName: "listForResale", args: [BigInt(r.token_id), parseUsdc(prices[r.token_id] ?? "")] }),
                        }])}>
                        Resell
                      </Button>
                    </div>
                  )}
                  <Link href={r.href} className="text-sm underline">Open listing</Link>
                </Card>
              ))}
            </div>
          </section>

          {market.length > 0 && (
            <section className="grid gap-3">
              <h2 className="font-extrabold text-2xl">Patches for resale</h2>
              <p className="text-sm muted">Buy a won patch from another brand. You take over its spot and its rights; the creator gets 5%.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {market.map((r) => (
                  <Card key={r.token_id} className="p-4 grid gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.image ? <img src={r.image} alt={`Receipt for ${r.label}`} className="w-full rounded-xl border-2 border-[var(--line)]" /> : <Skeleton className="aspect-square" />}
                    <div><b>{r.label}</b><p className="text-sm muted">{r.title} · held by {formatShortAddress(r.owner)}</p></div>
                    <Button variant="primary" disabled={!!busy}
                      onClick={() => run(`b${r.token_id}`, `You bought ${r.label}.`, [
                        { to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [MARKET, BigInt(r.resale_price!)] }) },
                        { to: MARKET, data: encodeFunctionData({ abi: patchedMarketAbi, functionName: "buyResale", args: [BigInt(r.token_id), BigInt(r.resale_price!)] }) },
                      ])}>
                      {busy === `b${r.token_id}` ? "Buying…" : `Buy for ${usd(r.resale_price!)}`}
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-3">
            <h2 className="font-extrabold text-2xl">Bid history</h2>
            {history.length === 0 ? <p className="muted text-sm">No bids yet.</p> : (
              <Card><ul className="feed">
                {history.map((h) => (
                  <li key={h.id}><span>{h.label} · {h.title}</span><span className="font-mono">{usd(h.amount)} · {formatTimeAgo(h.time)}</span></li>
                ))}
              </ul></Card>
            )}
          </section>
        </div>

        <Card className="p-5 grid gap-3 lg:sticky lg:top-24">
          <h3 className="font-bold text-lg">Your brand</h3>
          <p className="text-sm muted">Shown on every patch you lead and on your receipt NFTs.</p>
          <div className="flex gap-3 items-center">
            <button onClick={() => logoRef.current?.click()} disabled={!!busy}
              className="w-16 h-16 rounded-xl border-2 border-dashed border-[var(--line)] grid place-items-center overflow-hidden bg-[var(--paper)] flex-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {brand.logo ? <img src={brand.logo} alt="Brand logo" className="w-full h-full object-contain" /> : <Upload size={18} />}
            </button>
            <span className="text-xs muted">Logo: PNG, SVG or WebP up to 2 MB. Transparent backgrounds look best.</span>
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
          </div>
          <label className="grid gap-1"><span className="field-label">Brand name</span>
            <input className={INPUT} maxLength={31} value={brand.name} placeholder="Your brand name" onChange={(e) => setBrand({ ...brand, name: e.target.value })} /></label>
          <label className="grid gap-1"><span className="field-label">Website</span>
            <input className={INPUT} value={brand.website} placeholder="https://" onChange={(e) => setBrand({ ...brand, website: e.target.value })} /></label>
          <Button variant="primary" onClick={saveBrand} disabled={!!busy || !profile}>{busy === "brand" ? "Saving…" : "Save brand"}</Button>
          <BrandVerify />
          {walletAddress && (
            <a className="text-xs muted inline-flex items-center gap-1" href={`${EXPLORER}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer">
              Wallet {formatShortAddress(walletAddress)} <ExternalLink size={11} />
            </a>
          )}
        </Card>
      </div>
    </main>
  );
}

/** Page shape while the wallet loads, instead of a blank screen. */
function BidsSkeleton() {
  return (
    <main className="wrap pt-8 pb-24 grid gap-8" aria-busy="true" aria-label="Loading your bids">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-20" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
        <div className="grid gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        <Skeleton className="h-80" />
      </div>
    </main>
  );
}
