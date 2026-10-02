// Traction numbers for the metrics slide, straight from the database. Everything is shown twice: all, and "real",
// which leaves out our own wallets: the demo bots (privy_did demo:*), the deployer/admin wallets and the Privy test
// account, so the slide never counts us as users. Run from apps/web:
//   npx tsx scripts/metrics.mts            (chain from NEXT_PUBLIC_CHAIN_ID, default 10143)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const file of ["../../.env.local", "../../contracts/.env"]) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const CHAIN = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

const fetchAll = async <T,>(table: string, cols: string, chain = true): Promise<T[]> => {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(cols).range(from, from + 999);
    if (chain) q = q.eq("chain_id", CHAIN);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) return out;
  }
};

type Profile = { privy_did: string; wallet: string | null; handle: string | null; x_handle: string | null };
const profiles = await fetchAll<Profile>("profiles", "privy_did, wallet, handle, x_handle", false);
// Ours: the bots, the Privy test account (handle ptest*), the deployer and admin wallets.
const ours = new Set(
  profiles.filter((p) => p.privy_did.startsWith("demo:") || /^ptest/.test(p.handle ?? "")).map((p) => (p.wallet ?? "").toLowerCase()),
);
for (const k of ["DEPLOYER_ADDRESS", "TEST_BRAND_ADDRESS", "OPEN_ADMIN_ADDRESS", "KEEPER_ADDRESS"]) if (process.env[k]) ours.add(process.env[k]!.toLowerCase());
const real = (w?: string | null) => !!w && !ours.has(w.toLowerCase());

const listings = await fetchAll<{ creator: string; status: number; event_id: number }>("listings", "creator, status, event_id");
const bids = await fetchAll<{ bidder: string; amount: number }>("bids", "bidder, amount");
const campaigns = await fetchAll<{ brand: string; kind: string; status: string }>("brand_campaigns", "brand, kind, status");
const proofs = await fetchAll<{ listing_id: number }>("proof_files", "listing_id");
const payouts = await fetchAll<{ amount: number; kind: string }>("payouts", "amount, kind");
const follows = await fetchAll<{ follower: string }>("follows", "follower", false);
const posts = await fetchAll<{ author: string; spotted_wallet: string | null }>("posts", "author, spotted_wallet", false);
const reactions = await fetchAll<{ wallet: string }>("reactions", "wallet", false);

const uniq = (xs: (string | null | undefined)[]) => new Set(xs.filter(Boolean).map((x) => x!.toLowerCase())).size;
const usd = (n: number) => `$${(n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const rows: [string, string | number, string | number][] = [
  ["Profiles", profiles.length, profiles.filter((p) => real(p.wallet)).length],
  ["  with X linked", profiles.filter((p) => p.x_handle).length, profiles.filter((p) => p.x_handle && real(p.wallet)).length],
  ["Creators with a listing", uniq(listings.map((l) => l.creator)), uniq(listings.filter((l) => real(l.creator)).map((l) => l.creator))],
  ["Listings", listings.length, listings.filter((l) => real(l.creator)).length],
  ["Bids", bids.length, bids.filter((b) => real(b.bidder)).length],
  ["Brands that bid (unique wallets)", uniq(bids.map((b) => b.bidder)), uniq(bids.filter((b) => real(b.bidder)).map((b) => b.bidder))],
  ["Bid volume", usd(bids.reduce((s, b) => s + Number(b.amount), 0)), usd(bids.filter((b) => real(b.bidder)).reduce((s, b) => s + Number(b.amount), 0))],
  ["Campaigns", campaigns.filter((c) => c.kind !== "x_offer").length, campaigns.filter((c) => c.kind !== "x_offer" && real(c.brand)).length],
  ["Offers to X handles", campaigns.filter((c) => c.kind === "x_offer").length, campaigns.filter((c) => c.kind === "x_offer" && real(c.brand)).length],
  ["Proofs posted", proofs.length, "-"],
  ["Milestone payouts to creators", usd(payouts.filter((p) => p.kind === "milestone").reduce((s, p) => s + Number(p.amount), 0)), "-"],
  ["Follows", follows.length, follows.filter((f) => real(f.follower)).length],
  ["Spotted photos", posts.filter((p) => p.spotted_wallet).length, posts.filter((p) => p.spotted_wallet && real(p.spotted_wallet)).length],
  ["Reactions", reactions.length, reactions.filter((r) => real(r.wallet)).length],
];
console.log(`\nPatched metrics, chain ${CHAIN}, ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC\n`);
const w = Math.max(...rows.map((r) => r[0].length));
console.log(`${"".padEnd(w)}  ${"all".padStart(10)}  ${"real".padStart(10)}`);
for (const [label, all, realN] of rows) console.log(`${label.padEnd(w)}  ${String(all).padStart(10)}  ${String(realN).padStart(10)}`);
console.log("\n\"real\" leaves out the demo bots, the Privy test account and our deployer/admin/keeper wallets.");
