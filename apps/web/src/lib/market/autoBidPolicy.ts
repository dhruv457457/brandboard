/**
 * The Privy policy on a brand's own wallet for auto-bid through signers. Patched's key quorum is added to the
 * wallet as a signer with exactly this policy, so the server can only send what these rules allow: a bid on a spot
 * the brand turned auto-bid on, up to that spot's maximum, and an approval of the market for at most the largest
 * maximum. Anything else from the server is refused by Privy before it is signed. The brand sees the same rules
 * in plain words.
 */
import { DEPLOYMENTS } from "@patched/shared";
import { ERC20_SPEND_ABI } from "./campaignPolicy";

export const MARKET_BID_ABI = [
  {
    type: "function", name: "bid", stateMutability: "nonpayable", outputs: [],
    inputs: [
      { name: "id", type: "uint256" },
      { name: "patchId", type: "uint8" },
      { name: "amount", type: "uint96" },
    ],
  },
] as const;

export interface SignerAutoBid {
  chainId: number;
  listingId: number;
  patchId: number;
  /** Most per bid, 6-decimal USDC. */
  max: bigint;
}

/** Every active auto-bid of one wallet, across chains. No auto-bids means no rules, so Privy refuses everything. */
export function signerAutoBidRules(bids: SignerAutoBid[]) {
  const lc = (a: string) => a.toLowerCase();
  const rules = [];
  const byChain = new Map<number, SignerAutoBid[]>();
  for (const b of bids) byChain.set(b.chainId, [...(byChain.get(b.chainId) ?? []), b]);

  for (const [chainId, list] of byChain) {
    const d = DEPLOYMENTS[chainId];
    if (!d) continue;
    const chain = { field_source: "ethereum_transaction" as const, field: "chain_id" as const, operator: "eq" as const, value: String(chainId) };
    for (const b of list) {
      rules.push({
        // Privy rule names must be under 50 characters.
        name: `Bid c${chainId} #${b.listingId}/${b.patchId} max ${b.max}`.slice(0, 49),
        method: "eth_sendTransaction" as const,
        action: "ALLOW" as const,
        conditions: [
          { field_source: "ethereum_transaction" as const, field: "to" as const, operator: "eq" as const, value: lc(d.market) },
          chain,
          { field_source: "ethereum_calldata" as const, field: "function_name", operator: "eq" as const, value: "bid", abi: MARKET_BID_ABI },
          { field_source: "ethereum_calldata" as const, field: "bid.id", operator: "eq" as const, value: String(b.listingId), abi: MARKET_BID_ABI },
          { field_source: "ethereum_calldata" as const, field: "bid.patchId", operator: "eq" as const, value: String(b.patchId), abi: MARKET_BID_ABI },
          { field_source: "ethereum_calldata" as const, field: "bid.amount", operator: "lte" as const, value: b.max.toString(), abi: MARKET_BID_ABI },
        ],
      });
    }
    const largest = list.reduce((m, b) => (b.max > m ? b.max : m), 0n);
    rules.push({
      name: `Approve market c${chainId} max ${largest}`.slice(0, 49),
      method: "eth_sendTransaction" as const,
      action: "ALLOW" as const,
      conditions: [
        { field_source: "ethereum_transaction" as const, field: "to" as const, operator: "eq" as const, value: lc(d.usdc) },
        chain,
        { field_source: "ethereum_calldata" as const, field: "function_name", operator: "eq" as const, value: "approve", abi: ERC20_SPEND_ABI },
        { field_source: "ethereum_calldata" as const, field: "approve.spender", operator: "eq" as const, value: lc(d.market), abi: ERC20_SPEND_ABI },
        { field_source: "ethereum_calldata" as const, field: "approve.amount", operator: "lte" as const, value: largest.toString(), abi: ERC20_SPEND_ABI },
      ],
    });
  }
  return rules;
}

/** The same rules, as the brand reads them. */
export function signerAutoBidRulesInWords(bids: { label: string; max: number }[]) {
  return [
    ...bids.map((b) => ({ title: `${b.label}: up to $${b.max.toLocaleString("en-US")}`, body: "Patched bids the minimum step for you when you're outbid, never above this." })),
    { title: "Nothing else", body: "No transfers, no other spots, no other contracts. Privy refuses anything outside these rules before it is signed." },
    { title: "Revoke any time", body: "One tap in Settings removes Patched from your wallet." },
  ];
}
