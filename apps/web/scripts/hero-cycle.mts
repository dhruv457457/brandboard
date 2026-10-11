// The hero cycle: one full, fresh money loop on Monad testnet from the CURRENT receipt, so the demo videos have one
// complete patch NFT (list, bid, outbid, proof on IPFS, payout, delivered). Run from apps/web, one step at a time:
//   STEP=setup                                  rival bidder wallets, gas and USDC for them, brand names and profiles
//   STEP=create SHOTS=shots.json SPOTS=spots.json TITLE=... EVENT=5 FLOORS=3,2,2,3 BUYNOWS=30,20,20,30
//        BID_END=+15 DEADLINES=+35,+55,+75 HEADLINE=... STORY=...
//   STEP=approve LISTING=<id>                   admin (deployer) opens bidding
//   STEP=bid BOT=Alice|Bob LISTING=<id> SPOT=0 [AMOUNT=4]
//   STEP=close LISTING=<id>                     close bidding when it ended (the keeper does this too)
//   STEP=proof LISTING=<id> MILESTONE=0 PHOTOS=url1,url2 NOTE=...    pins the photos and the record to IPFS, then submitProof
//   STEP=fasttrack LISTING=<id> MILESTONE=0     admin closes the review window early
//   STEP=release LISTING=<id> MILESTONE=0       pays the creator (the keeper does this too)
//   STEP=status LISTING=<id>
// BOTS_FILE: where the rival wallets are kept (outside the repo). Every transaction is appended to docs/evidence.md.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient, createWalletClient, erc20Abi, formatUnits, http, keccak256, maxUint256, parseEther, parseEventLogs, stringToBytes, stringToHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { createClient } from "@supabase/supabase-js";
import { DEPLOYMENTS, patchedMarketAbi } from "@patched/shared";

const env: Record<string, string> = {};
for (const file of ["../../.env.local", "../../contracts/.env"]) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
}
const CHAIN_ID = 10143;
const d = DEPLOYMENTS[CHAIN_ID]!;
const EXPLORER = "https://testnet.monadvision.com";
const SITE = process.env.SITE ?? "https://monad.patched.world";
const EVIDENCE = "../../docs/evidence.md";
const STEP = process.env.STEP ?? "status";
const LABEL = process.env.LABEL ?? `hero-${STEP}`;
const BOTS_FILE = process.env.BOTS_FILE ?? "";

const transport = http(env.MONAD_TESTNET_RPC_URL);
const pub = createPublicClient({ chain: monadTestnet, transport });
const wallet = (pk: `0x${string}`) => createWalletClient({ chain: monadTestnet, transport, account: privateKeyToAccount(pk) });
const deployer = wallet(env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const $ = (v: bigint) => `$${formatUnits(v, 6)}`;
const usd = (s: string) => BigInt(Math.round(Number(s) * 1e6));
const sync = () => fetch(`${SITE}/api/indexer/sync`, { method: "POST" }).then((r) => r.json()).catch(() => null);
const when = (s: string) => (s.startsWith("+") ? Math.floor(Date.now() / 1000) + Number(s.slice(1)) * 60 : Math.floor(new Date(s).getTime() / 1000));
const labelOf = (hex: string) => Buffer.from(hex.slice(2), "hex").toString().replace(/\0/g, "");
const name32 = (s: string) => stringToHex(s.slice(0, 31), { size: 32 });

type Bot = { name: string; pk: `0x${string}`; address: `0x${string}` };
const bots = (): Bot[] => {
  if (!BOTS_FILE || !existsSync(BOTS_FILE)) throw new Error("BOTS_FILE not found: run STEP=setup first");
  return JSON.parse(readFileSync(BOTS_FILE, "utf8"));
};

function evidence(actor: string, what: string, hash: string) {
  if (!existsSync(EVIDENCE)) {
    writeFileSync(EVIDENCE, "# On-chain evidence\n\nEvery step of the on-chain test cycle, run on Monad testnet (chain 10143), newest last.\n\n| Step | Actor | What happened | Transaction | When (UTC) |\n|---|---|---|---|---|\n");
  }
  appendFileSync(EVIDENCE, `| ${LABEL} | ${actor} | ${what} | [${hash.slice(0, 10)}…](${EXPLORER}/tx/${hash}) | ${new Date().toISOString().slice(0, 16).replace("T", " ")} |\n`);
  console.log(`${LABEL}: ${what}\n  ${EXPLORER}/tx/${hash}`);
}

async function send(w: typeof deployer, req: Parameters<typeof deployer.writeContract>[0]) {
  const hash = await w.writeContract(req);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`reverted: ${hash}`);
  return receipt;
}

async function ensureAllowance(w: typeof deployer, amount: bigint) {
  const owner = w.account.address;
  const allowance = await pub.readContract({ address: d.usdc, abi: erc20Abi, functionName: "allowance", args: [owner, d.market] });
  if (allowance < amount) await send(w, { address: d.usdc, abi: erc20Abi, functionName: "approve", args: [d.market, maxUint256], chain: monadTestnet, account: w.account });
}

/** QuickNode IPFS, the same call the site makes (apps/web/src/lib/server/ipfs.ts). */
async function pinFile(bytes: Uint8Array, name: string, contentType: string): Promise<string> {
  const form = new FormData();
  form.set("Body", new Blob([bytes as BlobPart], { type: contentType }), name);
  form.set("Key", name);
  form.set("ContentType", contentType);
  const res = await fetch("https://api.quicknode.com/ipfs/rest/v1/s3/put-object", { method: "POST", headers: { "x-api-key": env.QUICKNODE_IPFS_API_KEY }, body: form, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`IPFS pin failed (${res.status})`);
  const cid = ((await res.json()) as { pin?: { cid?: string } }).pin?.cid;
  if (!cid) throw new Error("IPFS pin returned no cid");
  return cid;
}

const bal = async (a: `0x${string}`) => ({
  usdc: await pub.readContract({ address: d.usdc, abi: erc20Abi, functionName: "balanceOf", args: [a] }),
  mon: await pub.getBalance({ address: a }),
});

// ───────────────────────────── setup ─────────────────────────────
if (STEP === "setup") {
  if (!BOTS_FILE) throw new Error("set BOTS_FILE to a path outside the repo");
  const alice: Bot = { name: "Alice", pk: env.TEST_BRAND_PRIVATE_KEY as `0x${string}`, address: env.TEST_BRAND_ADDRESS as `0x${string}` };
  const existing: Bot[] = existsSync(BOTS_FILE) ? JSON.parse(readFileSync(BOTS_FILE, "utf8")) : [];
  let bob = existing.find((b) => b.name === "Bob");
  if (!bob) {
    const pk = generatePrivateKey();
    bob = { name: "Bob", pk, address: privateKeyToAccount(pk).address };
  }
  writeFileSync(BOTS_FILE, JSON.stringify([alice, bob], null, 2));
  console.log("bots file written:", BOTS_FILE, "| Bob:", bob.address);

  // Gas for both, from the deployer.
  for (const b of [alice, bob]) {
    const have = (await bal(b.address)).mon;
    if (have < parseEther(Number(process.env.GAS ?? "0.15").toString())) {
      const hash = await deployer.sendTransaction({ to: b.address, value: parseEther(process.env.GAS ?? "0.15") });
      await pub.waitForTransactionReceipt({ hash });
      evidence("Team Patched (admin)", `Sent ${process.env.GAS ?? "0.15"} MON of test gas to ${b.name} (${b.address.slice(0, 8)}…)`, hash);
    }
  }
  // USDC for Bob, from Alice.
  const want = usd(process.env.BOB_USDC ?? "8");
  if ((await bal(bob.address)).usdc < want) {
    const hash = await wallet(alice.pk).writeContract({ address: d.usdc, abi: erc20Abi, functionName: "transfer", args: [bob.address, want], chain: monadTestnet, account: privateKeyToAccount(alice.pk) });
    await pub.waitForTransactionReceipt({ hash });
    evidence("Alice (brand)", `Sent ${$(want)} of test USDC to Bob (${bob.address.slice(0, 8)}…) so he can bid`, hash);
  }
  // Brand names and logos: copied from existing demo brands, so the NFTs look real.
  const logoOf = async (brand: string) => (await db.from("profiles").select("brand_logo_url").ilike("brand_name", brand).not("brand_logo_url", "is", null).limit(1).maybeSingle()).data?.brand_logo_url ?? null;
  for (const [b, brand, handle] of [[alice, "Bone Dry", "hero-bonedry"], [bob, "crickauction", "hero-crickauction"]] as const) {
    const { error } = await db.from("profiles").upsert({ privy_did: `demo:${handle}`, wallet: b.address.toLowerCase(), handle, display_name: brand, brand_name: brand, brand_logo_url: await logoOf(brand), bio: `Demo brand for the hero cycle.` }, { onConflict: "privy_did" });
    if (error) throw error;
  }
  // On-chain names: the card shows them.
  for (const [w, nm, who] of [[deployer, "teampatched", "Team Patched"], [wallet(alice.pk), "Bone Dry", "Alice"], [wallet(bob.pk), "crickauction", "Bob"]] as const) {
    const hash = await w.writeContract({ address: d.market, abi: patchedMarketAbi, functionName: "setBrandName", args: [name32(nm)], chain: monadTestnet, account: w.account });
    await pub.waitForTransactionReceipt({ hash });
    evidence(`${who}`, `Set the on-chain name to "${nm}"`, hash);
  }
  for (const [n, a] of [["deployer", deployer.account.address], ["Alice", alice.address], ["Bob", bob.address]] as const) {
    const b = await bal(a as `0x${string}`);
    console.log(n.padEnd(9), a, "USDC", $(b.usdc), "MON", formatUnits(b.mon, 18).slice(0, 6));
  }
}

// ───────────────────────────── create / approve ─────────────────────────────
if (STEP === "create") {
  const shots = JSON.parse(readFileSync(process.env.SHOTS!, "utf8")) as { front: string; back: string; style: string };
  const spots = JSON.parse(readFileSync(process.env.SPOTS!, "utf8")) as { name: string; side: string; x: number; y: number; w: number; h: number; tier?: string }[];
  const floors = process.env.FLOORS!.split(",").map(usd);
  const buyNows = process.env.BUYNOWS!.split(",").map(usd);
  if (floors.length !== spots.length || buyNows.length !== spots.length) throw new Error("one floor and buy-now per spot");
  const biddingEndsAt = when(process.env.BID_END ?? "+15");
  const deadlines = (process.env.DEADLINES ?? "+35,+55,+75").split(",").map(when);
  const names = ["Print proof", "Venue check-in", "Event photos and X post"];
  const split = deadlines.length === 3 ? [3000, 3000, 4000] : deadlines.length === 2 ? [3000, 7000] : [10000];
  const milestones = split.map((bps, i) => ({ name: deadlines.length === 3 ? names[i]! : i === deadlines.length - 1 ? names[2]! : names[0]!, bps }));
  const metadata = {
    version: 1,
    title: process.env.TITLE!,
    surface: "outfit",
    canvasImage: shots.front,
    canvasImageBack: shots.back,
    views: [{ id: "front", label: "Front", image: shots.front }, { id: "back", label: "Back", image: shots.back }],
    style: shots.style,
    patches: spots.map((p, i) => ({ id: i, name: p.name, side: p.side, x: p.x, y: p.y, w: p.w, h: p.h, rotation: 0, ...(p.tier ? { tier: p.tier } : {}) })),
    milestones,
    ...(process.env.HEADLINE ? { headline: process.env.HEADLINE } : {}),
    ...(process.env.STORY ? { story: process.env.STORY } : {}),
    deal: { days: Number(process.env.DAYS ?? 2), payout: "upfront", deliverables: ["Worn every event day", "Venue photos with the patch in view", "An X post tagging the brand with #patched"] },
  };
  const metadataHash = keccak256(stringToBytes(JSON.stringify(metadata)));
  const { error } = await db.from("listing_metadata").upsert({ metadata_hash: metadataHash, creator: deployer.account.address.toLowerCase(), metadata }, { onConflict: "metadata_hash" });
  if (error) throw error;
  const bond = BigInt(await pub.readContract({ address: d.market, abi: patchedMarketAbi, functionName: "minBond" }));
  await ensureAllowance(deployer, bond);
  const params = {
    surface: 0, eventId: Number(process.env.EVENT ?? 0), biddingEndsAt, bond, floors, buyNows,
    labels: spots.map((p) => stringToHex(p.name.slice(0, 31), { size: 32 })),
    milestoneBps: milestones.map((m) => m.bps), deadlines, payees: [], shares: [],
    metadataURI: `patched://metadata/${metadataHash}`, metadataHash,
  } as const;
  await pub.simulateContract({ address: d.market, abi: patchedMarketAbi, functionName: "createListing", args: [params], account: deployer.account });
  const receipt = await send(deployer, { address: d.market, abi: patchedMarketAbi, functionName: "createListing", args: [params], chain: monadTestnet, account: deployer.account });
  const [created] = parseEventLogs({ abi: patchedMarketAbi, eventName: "ListingCreated", logs: receipt.logs });
  evidence("Team Patched (creator)", `Created listing #${created?.args.listingId} "${metadata.title}" with ${spots.length} spots and a ${$(bond)} stake`, receipt.transactionHash);
  await sync();
}

if (STEP === "approve") {
  const id = BigInt(process.env.LISTING!);
  const receipt = await send(deployer, { address: d.market, abi: patchedMarketAbi, functionName: "approveListing", args: [id], chain: monadTestnet, account: deployer.account });
  evidence("Admin", `Approved listing #${id}; bidding is open`, receipt.transactionHash);
  await sync();
}

// ───────────────────────────── bidding ─────────────────────────────
if (STEP === "bid") {
  const bot = bots().find((b) => b.name === process.env.BOT) ?? (() => { throw new Error(`no bot ${process.env.BOT}`); })();
  const w = wallet(bot.pk);
  const id = BigInt(process.env.LISTING!);
  const spot = Number(process.env.SPOT ?? 0);
  const amount = process.env.AMOUNT ? usd(process.env.AMOUNT) : await pub.readContract({ address: d.market, abi: patchedMarketAbi, functionName: "minNextBid", args: [id, spot] });
  const before = await pub.readContract({ address: d.market, abi: patchedMarketAbi, functionName: "getPatch", args: [id, spot] });
  await ensureAllowance(w, amount);
  await pub.simulateContract({ address: d.market, abi: patchedMarketAbi, functionName: "bid", args: [id, spot, amount], account: w.account });
  const receipt = await send(w, { address: d.market, abi: patchedMarketAbi, functionName: "bid", args: [id, spot, amount], chain: monadTestnet, account: w.account });
  const outbid = before.topBidder !== "0x0000000000000000000000000000000000000000" ? `; ${before.topBidder.slice(0, 8)}… refunded ${$(before.topBid)} in the same transaction` : "";
  evidence(`${bot.name} (brand)`, `Bid ${$(amount)} on "${labelOf(before.label)}" of listing #${id}${outbid}`, receipt.transactionHash);
  await sync();
}

if (STEP === "close") {
  const id = BigInt(process.env.LISTING!);
  const receipt = await send(deployer, { address: d.market, abi: patchedMarketAbi, functionName: "closeBidding", args: [id], chain: monadTestnet, account: deployer.account });
  evidence("Anyone (the keeper does this every minute)", `Closed bidding on listing #${id}; each winner's patch NFT is minted`, receipt.transactionHash);
  await sync();
}

// ───────────────────────────── proof, review, payout ─────────────────────────────
if (STEP === "proof") {
  if (!env.QUICKNODE_IPFS_API_KEY) throw new Error("QUICKNODE_IPFS_API_KEY is not set: the proof would not be on IPFS");
  const id = Number(process.env.LISTING!);
  const milestone = Number(process.env.MILESTONE ?? 0);
  const supa = env.NEXT_PUBLIC_SUPABASE_URL;
  const files = process.env.PHOTOS!.split(",").filter((f) => f.startsWith(supa)).slice(0, 8);
  if (!files.length) throw new Error("PHOTOS must be image links from our storage");
  const note = process.env.NOTE ?? null;
  const sharp = (await import("sharp")).default;
  const photos = await Promise.all(files.map(async (url, i) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`photo ${i} not readable (${res.status})`);
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    return `ipfs://${await pinFile(jpeg, `proof-${id}-${milestone}-${i}.jpg`, "image/jpeg")}`;
  }));
  // The record the site would pin: the photos by IPFS link, hashed as exact bytes.
  const record = { chainId: CHAIN_ID, listingId: id, milestone, files, note };
  const bytes = new TextEncoder().encode(JSON.stringify({ name: "Patched proof", market: d.market, ...record, files: photos }));
  const cid = await pinFile(bytes, `proof-${id}-${milestone}.json`, "application/json");
  const proofHash = keccak256(bytes);
  const { error } = await db.from("proof_files").upsert({ chain_id: CHAIN_ID, listing_id: id, milestone, files, note, x_url: null, ai_check: null }, { onConflict: "chain_id,listing_id,milestone" });
  if (error) throw error;
  const receipt = await send(deployer, {
    address: d.market, abi: patchedMarketAbi, functionName: "submitProof",
    args: [BigInt(id), milestone, proofHash, `ipfs://${cid}`, photos[0]!], chain: monadTestnet, account: deployer.account,
  });
  evidence("Team Patched (creator)", `Submitted proof ${milestone + 1} of listing #${id}: ${files.length} photos pinned to IPFS (record ipfs://${cid.slice(0, 12)}…), hash on-chain`, receipt.transactionHash);
  await sync();
}

if (STEP === "fasttrack") {
  const id = BigInt(process.env.LISTING!);
  const milestone = Number(process.env.MILESTONE ?? 0);
  const receipt = await send(deployer, { address: d.market, abi: patchedMarketAbi, functionName: "fastTrack", args: [id, milestone], chain: monadTestnet, account: deployer.account });
  evidence("Admin", `Fast-tracked the review of milestone ${milestone + 1} on listing #${id} (the proof is clearly fine)`, receipt.transactionHash);
}

if (STEP === "release") {
  const id = BigInt(process.env.LISTING!);
  const milestone = Number(process.env.MILESTONE ?? 0);
  const receipt = await send(deployer, { address: d.market, abi: patchedMarketAbi, functionName: "release", args: [id, milestone], chain: monadTestnet, account: deployer.account });
  evidence("Anyone (the keeper does this every minute)", `Released milestone ${milestone + 1} of listing #${id}: the creator is paid from escrow`, receipt.transactionHash);
  await sync();
}

if (STEP === "status") {
  const id = BigInt(process.env.LISTING!);
  const L = await pub.readContract({ address: d.market, abi: patchedMarketAbi, functionName: "getListing", args: [id] });
  const patches = await pub.readContract({ address: d.market, abi: patchedMarketAbi, functionName: "getPatches", args: [id] });
  console.log(`listing #${id} status ${L.status} ends ${new Date(Number(L.biddingEndsAt) * 1000).toISOString()} next milestone ${L.nextMilestone}`);
  for (const [i, p] of patches.entries()) console.log(`  ${i} ${labelOf(p.label).padEnd(16)} top ${$(p.topBid).padEnd(6)} by ${p.topBidder} floor ${$(p.floor)}`);
  for (let m = 0; m < Number(L.milestoneCount); m++) {
    const ms = await pub.readContract({ address: d.market, abi: patchedMarketAbi, functionName: "getMilestone", args: [id, m] });
    console.log(`  milestone ${m}`, JSON.stringify(ms, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
  }
  console.log("deployer", JSON.stringify({ usdc: $((await bal(deployer.account.address)).usdc), mon: formatUnits((await bal(deployer.account.address)).mon, 18).slice(0, 6) }));
}
