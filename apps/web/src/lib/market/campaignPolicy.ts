/**
 * The Privy policy for a campaign wallet, built from the brand's settings. The API creates exactly this policy
 * with Privy, and the campaign page shows it (plain words and the JSON), so what the brand reads is what Privy
 * enforces. Anything these rules don't allow is refused by Privy before it is signed.
 */

export const BID_FOR_ABI = [
  {
    type: "function", name: "bidFor", stateMutability: "nonpayable", outputs: [],
    inputs: [
      { name: "bidder", type: "address" },
      { name: "id", type: "uint256" },
      { name: "patchId", type: "uint8" },
      { name: "amount", type: "uint96" },
    ],
  },
] as const;

export const ERC20_SPEND_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", outputs: [{ name: "", type: "bool" }], inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", outputs: [{ name: "", type: "bool" }], inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }] },
] as const;

export interface CampaignRulesInput {
  chainId: number;
  market: string;
  usdc: string;
  /** The brand's own wallet: every bid is for it, and leftovers go back to it. */
  brand: string;
  /** Most per bid, 6-decimal USDC. */
  maxPerSpot: bigint;
  /** Unix seconds after which bids are refused. */
  endsAt: number;
  /**
   * The campaign's Privy aggregation (the sum of its bids) and the budget it may not pass. With these, bids must be
   * signed through Privy (eth_signTransaction, broadcast by us), because Privy only checks aggregations on signing.
   */
  aggregationId?: string;
  budget?: bigint;
}

/** Privy keeps an aggregation's running total over a rolling window of at most 72 hours. */
export const MAX_AGGREGATION_WINDOW = 72 * 3600;

/**
 * The Privy aggregation for a campaign: the sum of `bidFor.amount` over every bid its wallet signs on our market.
 * Aggregations are counted per wallet, so each campaign wallet has its own running total.
 */
export function campaignAggregation(c: { chainId: number; market: string; name: string; windowSeconds: number }) {
  return {
    name: c.name.slice(0, 49),
    method: "eth_signTransaction" as const,
    metric: { field_source: "ethereum_calldata", field: "bidFor.amount", function: "sum" as const, abi: BID_FOR_ABI },
    window: { type: "rolling" as const, seconds: Math.max(60, Math.min(MAX_AGGREGATION_WINDOW, Math.ceil(c.windowSeconds))) },
    conditions: [
      { field_source: "ethereum_transaction", field: "to", operator: "eq", value: c.market.toLowerCase() },
      { field_source: "ethereum_transaction", field: "chain_id", operator: "eq", value: String(c.chainId) },
      { field_source: "ethereum_calldata", field: "function_name", operator: "eq", value: "bidFor", abi: BID_FOR_ABI },
    ],
  };
}

/** Privy rule names must be under 50 characters. */
export function campaignRules(c: CampaignRulesInput) {
  const chain = { field_source: "ethereum_transaction" as const, field: "chain_id" as const, operator: "eq" as const, value: String(c.chainId) };
  const lc = (a: string) => a.toLowerCase();
  const total = c.aggregationId && c.budget !== undefined;
  return [
    {
      name: total ? "Bids for the brand, capped, in budget, until end" : "Bids for the brand, capped, until the end",
      method: total ? ("eth_signTransaction" as const) : ("eth_sendTransaction" as const),
      action: "ALLOW" as const,
      conditions: [
        { field_source: "ethereum_transaction" as const, field: "to" as const, operator: "eq" as const, value: lc(c.market) },
        chain,
        { field_source: "ethereum_calldata" as const, field: "function_name", operator: "eq" as const, value: "bidFor", abi: BID_FOR_ABI },
        { field_source: "ethereum_calldata" as const, field: "bidFor.bidder", operator: "eq" as const, value: lc(c.brand), abi: BID_FOR_ABI },
        { field_source: "ethereum_calldata" as const, field: "bidFor.amount", operator: "lte" as const, value: c.maxPerSpot.toString(), abi: BID_FOR_ABI },
        { field_source: "system" as const, field: "current_unix_timestamp" as const, operator: "lte" as const, value: String(c.endsAt) },
        // The running total includes the bid being signed, so the last bid can't overshoot the budget.
        ...(total ? [{ field_source: "reference" as const, field: `aggregation.${c.aggregationId}`, operator: "lte" as const, value: c.budget!.toString() }] : []),
      ],
    },
    {
      name: "Approve the market for bids",
      method: "eth_sendTransaction" as const,
      action: "ALLOW" as const,
      conditions: [
        { field_source: "ethereum_transaction" as const, field: "to" as const, operator: "eq" as const, value: lc(c.usdc) },
        chain,
        { field_source: "ethereum_calldata" as const, field: "function_name", operator: "eq" as const, value: "approve", abi: ERC20_SPEND_ABI },
        { field_source: "ethereum_calldata" as const, field: "approve.spender", operator: "eq" as const, value: lc(c.market), abi: ERC20_SPEND_ABI },
      ],
    },
    {
      name: "Return what's left to the brand",
      method: "eth_sendTransaction" as const,
      action: "ALLOW" as const,
      conditions: [
        { field_source: "ethereum_transaction" as const, field: "to" as const, operator: "eq" as const, value: lc(c.usdc) },
        chain,
        { field_source: "ethereum_calldata" as const, field: "function_name", operator: "eq" as const, value: "transfer", abi: ERC20_SPEND_ABI },
        { field_source: "ethereum_calldata" as const, field: "transfer.to", operator: "eq" as const, value: lc(c.brand), abi: ERC20_SPEND_ABI },
      ],
    },
  ];
}

/**
 * The same rules, as the brand reads them. `privyTotal`: the budget is a Privy aggregation (campaigns started since
 * it was added); `startsAt` lets the text say whether Privy's 72-hour window covers the whole campaign.
 */
export function campaignRulesInWords(c: { maxPerSpot: number; budget: number; endsAt: number; eventName: string; privyTotal?: boolean; startsAt?: number }) {
  const end = new Date(c.endsAt * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const whole = c.startsAt === undefined || c.endsAt - c.startsAt <= MAX_AGGREGATION_WINDOW;
  const budget = `$${c.budget.toLocaleString("en-US")}`;
  return [
    { title: "Only bids on Patched", body: "Always for your wallet: the receipts and any outbid refunds come to you." },
    { title: `At most $${c.maxPerSpot.toLocaleString("en-US")} a bid`, body: "A bigger bid is refused by Privy before it is signed." },
    c.privyTotal
      ? {
          title: `${budget} in total`,
          body: whole
            ? `Privy adds up every bid this campaign signs and refuses the one that would take it past ${budget}.`
            : `Privy adds up the bids this campaign signs and refuses any that would pass ${budget} within 72 hours. The wallet also only ever holds your budget.`,
        }
      : { title: `${budget} in total`, body: "The campaign wallet only ever holds your budget, so it can't spend more." },
    { title: `Stops ${end}`, body: "Checked against Privy's clock, not ours. What's left comes back to you." },
  ];
}
