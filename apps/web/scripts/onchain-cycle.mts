// The on-chain test cycle (docs/final-plan.md, M1): the steps that don't need a Privy wallet in a browser, run with the
// deployer (admin and creator) and the rival bot wallets on Monad testnet. Every transaction is appended to
// docs/evidence.md with an explorer link. The browser steps (Privy test account) live in e2e/money.spec.ts.
//
// Run from apps/web, one step at a time:
//   STEP=profile                                                     the deployer's creator profile (Team Patched)
//   STEP=create SHOTS=shots.json SPOTS=spots.json TITLE=... EVENT=4 FLOORS=2,3,1,3 BUYNOWS=40,50,20,50
//        BID_END=+20 (minutes from now, or an ISO date) DEADLINES=+40,+60 HEADLINE=... STORY=... DAYS=2
//   STEP=approve LISTING=5                                           admin approves (deployer)
//   STEP=bid BOT=Alice LISTING=5 SPOT=0 [AMOUNT=4]                    a rival bot bids (minimum next bid by default)
//   STEP=proof LISTING=5 MILESTONE=0 FILES=url1,url2 NOTE=...         creator stores proof files, then submitProof
//   STEP=note ACTOR=... WHAT=... HASH=0x...                       log a browser step (Privy test account)
//   STEP=status LISTING=5
// Bot keys come from BIDDERS_FILE ([{ name, pk, address }], kept outside the repo). LABEL= names the step in the log.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient, createWalletClient, erc20Abi, formatUnits, http, keccak256, maxUint256, parseEventLogs, stringToBytes, stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
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
const EXPLORER = "https://testnet.monadexplorer.com";
const SITE = process.env.SITE ?? "https://monad.patched.world";
const EVIDENCE = "../../docs/evidence.md";
const STEP = process.env.STEP ?? "status";
const LABEL = process.env.LABEL ?? STEP;

const transport = http(env.MONAD_TESTNET_RPC_URL);
const pub = createPublicClient({ chain: monadTestnet, transport });
const deployer = createWalletClient({ chain: monadTestnet, transport, account: privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY as `0x${string}`) });
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const $ = (v: bigint) => `$${formatUnits(v, 6)}`;
const usd = (s: string) => BigInt(Math.round(Number(s) * 1e6));
const sync = () => fetch(`${SITE}/api/indexer/sync`, { method: "POST" }).then((r) => r.json()).catch(() => null);

/** Minutes from now ("+20") or an ISO date, as unix seconds. */
const when = (s: string) => (s.startsWith("+") ? Math.floor(Date.now() / 1000) + Number(s.slice(1)) * 60 : Math.floor(new Date(s).getTime() / 1000));

function evidence(actor: string, what: string, hash: string) {
  if (!existsSync(EVIDENCE)) {
    writeFileSync(EVIDENCE, "# On-chain evidence\n\nEvery step of the test cycle in docs/final-plan.md, run on Monad testnet (chain 10143), newest last.\n\n| Step | Actor | What happened | Transaction | When (UTC) |\n|---|---|---|---|---|\n");
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

const labelOf = (hex: string) => Buffer.from(hex.slice(2), "hex").toString().replace(/\0/g, "");

if (STEP === "profile") {
  const wallet = deployer.account.address.toLowerCase();
  const { error } = await db.from("profiles").upsert({
    privy_did: "demo:team", wallet, handle: "teampatched", display_name: "Team Patched",
    bio: "The team behind Patched. Our own outfits, listed for real events on Monad.",
  }, { onConflict: "privy_did" });
  if (error) throw error;
  console.log("profile saved for", wallet);
}

if (STEP === "create") {
  const shots = JSON.parse(readFileSync(process.env.SHOTS!, "utf8")) as { front: string; back: string; style: string };
  const spots = JSON.parse(readFileSync(process.env.SPOTS!, "utf8")) as { name: string; side: string; x: number; y: number; w: number; h: number; tier?: string }[];
  const floors = process.env.FLOORS!.split(",").map(usd);
  const buyNows = process.env.BUYNOWS!.split(",").map(usd);
  if (floors.length !== spots.length || buyNows.length !== spots.length) throw new Error("one floor and buy-now per spot");
  const biddingEndsAt = when(process.env.BID_END ?? "+20");
  const deadlines = (process.env.DEADLINES ?? "+40,+60").split(",").map(when);
  const milestones = [{ name: "Print proof", bps: 3000 }, { name: "Event photos and X post", bps: 7000 }].slice(0, deadlines.length);
  if (deadlines.length === 1) milestones[0] = { name: "Event photos and X post", bps: 10000 };

  // The same shape and key order /api/listings/metadata stores (the hash is over this exact JSON).
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
    deal: {
      days: Number(process.env.DAYS ?? 2),
      payout: "upfront",
      deliverables: ["Worn every event day", "5 venue photos with the patch in view", "An X post tagging the brand with #patched"],
    },
  };
  const metadataHash = keccak256(stringToBytes(JSON.stringify(metadata)));
  const creator = deployer.account.address.toLowerCase();
  const { error } = await db.from("listing_metadata").upsert({ metadata_hash: metadataHash, creator, metadata }, { onConflict: "metadata_hash" });
  if (error) throw error;

  const bond = await pub.readContract({ address: d.market, abi: patchedMarketAbi, functionName: "minBond" });
  await ensureAllowance(deployer, BigInt(bond));
  const params = {
    surface: 0, eventId: Number(process.env.EVENT ?? 0), biddingEndsAt, bond: BigInt(bond), floors, buyNows,
    labels: spots.map((p) => stringToHex(p.name.slice(0, 31), { size: 32 })),
    milestoneBps: milestones.map((m) => m.bps), deadlines, payees: [], shares: [],
    metadataURI: `patched://metadata/${metadataHash}`, metadataHash,
  } as const;
  await pub.simulateContract({ address: d.market, abi: patchedMarketAbi, functionName: "createListing", args: [params], account: deployer.account });
  const receipt = await send(deployer, { address: d.market, abi: patchedMarketAbi, functionName: "createListing", args: [params], chain: monadTestnet, account: deployer.account });
  const [created] = parseEventLogs({ abi: patchedMarketAbi, eventName: "ListingCreated", logs: receipt.logs });
  const id = created?.args.listingId;
  evidence("Team Patched (creator)", `Created listing #${id} "${metadata.title}" with ${spots.length} spots and a ${$(BigInt(bond))} stake`, receipt.transactionHash);
  await sync();
}

if (STEP === "approve") {
  const id = BigInt(process.env.LISTING!);
  const receipt = await send(deployer, { address: d.market, abi: patchedMarketAbi, functionName: "approveListing", args: [id], chain: monadTestnet, account: deployer.account });
  evidence("Admin", `Approved listing #${id}; bidding is open`, receipt.transactionHash);
  await sync();
}

if (STEP === "bid") {
  const bots = JSON.parse(readFileSync(process.env.BIDDERS_FILE!, "utf8")) as { name: string; pk: `0x${string}`; address: `0x${string}` }[];
  const bot = bots.find((b) => b.name === process.env.BOT) ?? (() => { throw new Error(`no bot ${process.env.BOT}`); })();
  const w = createWalletClient({ chain: monadTestnet, transport, account: privateKeyToAccount(bot.pk) });
  const id = BigInt(process.env.LISTING!);
  const spot = Number(process.env.SPOT ?? 0);
  const amount = process.env.AMOUNT ? usd(process.env.AMOUNT) : await pub.readContract({ address: d.market, abi: patchedMarketAbi, functionName: "minNextBid", args: [id, spot] });
  const before = await pub.readContract({ address: d.market, abi: patchedMarketAbi, functionName: "getPatch", args: [id, spot] });
  await ensureAllowance(w as typeof deployer, amount);
  await pub.simulateContract({ address: d.market, abi: patchedMarketAbi, functionName: "bid", args: [id, spot, amount], account: w.account });
  const receipt = await send(w as typeof deployer, { address: d.market, abi: patchedMarketAbi, functionName: "bid", args: [id, spot, amount], chain: monadTestnet, account: w.account });
  const outbid = before.topBidder !== "0x0000000000000000000000000000000000000000" ? `; ${before.topBidder.slice(0, 8)}… refunded ${$(before.topBid)} in the same transaction` : "";
  evidence(`${bot.name} (rival brand)`, `Bid ${$(amount)} on "${labelOf(before.label)}" of listing #${id}${outbid}`, receipt.transactionHash);
  await sync();
}

if (STEP === "proof") {
  const id = Number(process.env.LISTING!);
  const milestone = Number(process.env.MILESTONE ?? 0);
  const files = process.env.FILES!.split(",");
  const note = process.env.NOTE ?? null;
  // Same record and hash as /api/proofs.
  const record = { chainId: CHAIN_ID, listingId: id, milestone, files, note };
  const proofHash = keccak256(stringToBytes(JSON.stringify(record)));
  const { error } = await db.from("proof_files").upsert(
    { chain_id: CHAIN_ID, listing_id: id, milestone, files, note, x_url: null, ai_check: null },
    { onConflict: "chain_id,listing_id,milestone" },
  );
  if (error) throw error;
  const receipt = await send(deployer, {
    address: d.market, abi: patchedMarketAbi, functionName: "submitProof",
    args: [BigInt(id), milestone, proofHash, `patched://proof/${CHAIN_ID}/${id}/${milestone}`], chain: monadTestnet, account: deployer.account,
  });
  evidence("Team Patched (creator)", `Submitted proof for milestone ${milestone + 1} of listing #${id} (${files.length} photos); review window started`, receipt.transactionHash);
  await sync();
}

// Admin settles a dispute: SHARE is the creator's part in basis points (5000 = half to each side).
if (STEP === "resolve") {
  const id = BigInt(process.env.LISTING!);
  const milestone = Number(process.env.MILESTONE ?? 0);
  const patchId = Number(process.env.SPOT!);
  const share = Number(process.env.SHARE ?? 5000);
  const receipt = await send(deployer, {
    address: d.market, abi: patchedMarketAbi, functionName: "resolveDispute", args: [id, milestone, patchId, share], chain: monadTestnet, account: deployer.account,
  });
  evidence("Admin", `Settled the dispute on spot ${patchId + 1} of listing #${id}, milestone ${milestone + 1}: ${share / 100}% to the creator, the rest back to the holder`, receipt.transactionHash);
  await sync();
}

// A step done in the browser (Privy test account): log its hash with ACTOR, WHAT and HASH.
if (STEP === "note") {
  const receipt = await pub.waitForTransactionReceipt({ hash: process.env.HASH as `0x${string}` });
  if (receipt.status !== "success") throw new Error("that transaction reverted");
  evidence(process.env.ACTOR!, process.env.WHAT!, receipt.transactionHash);
  await sync();
}

// Find what a browser step did on-chain: the market events of LISTING in the last BLOCKS blocks (default 3000), with
// their transaction hashes, so they can be logged with STEP=note.
if (STEP === "events") {
  const to = await pub.getBlockNumber();
  const from = to - BigInt(process.env.BLOCKS ?? 3000);
  const logs = [];
  for (let b = from; b <= to; b += 100n) {
    logs.push(...(await pub.getContractEvents({ address: d.market, abi: patchedMarketAbi, fromBlock: b, toBlock: b + 99n > to ? to : b + 99n })));
  }
  for (const l of logs) {
    const args = l.args as Record<string, unknown>;
    if (process.env.LISTING && String(args.listingId) !== process.env.LISTING) continue;
    console.log(l.blockNumber, l.eventName, JSON.stringify(args, (_, v) => (typeof v === "bigint" ? v.toString() : v)), l.transactionHash);
  }
}

if (STEP === "status") {
  const id = BigInt(process.env.LISTING!);
  const L = await pub.readContract({ address: d.market, abi: patchedMarketAbi, functionName: "getListing", args: [id] });
  const patches = await pub.readContract({ address: d.market, abi: patchedMarketAbi, functionName: "getPatches", args: [id] });
  console.log(`listing #${id} status ${L.status} ends ${new Date(Number(L.biddingEndsAt) * 1000).toISOString()} next milestone ${L.nextMilestone}`);
  for (const [i, p] of patches.entries()) console.log(`  ${i} ${labelOf(p.label).padEnd(14)} top ${$(p.topBid)} by ${p.topBidder} floor ${$(p.floor)} buy-now ${$(p.buyNow)}`);
  for (let m = 0; m < Number(L.milestoneCount); m++) {
    const ms = await pub.readContract({ address: d.market, abi: patchedMarketAbi, functionName: "getMilestone", args: [id, m] });
    console.log(`  milestone ${m}`, ms);
  }
}
