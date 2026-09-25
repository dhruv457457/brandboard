"use client";

import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { parseUsdc } from "@/lib/format";

/** Bids (or sweep totals, or auto-bid maximums) at or above this many dollars need a passkey check. */
export const STEP_UP_USD = Number(process.env.NEXT_PUBLIC_STEP_UP_USD ?? 1000);
const STEP_UP = parseUsdc(String(STEP_UP_USD));

/** Thrown when a big amount needs a passkey but the user hasn't set one up yet. */
export class PasskeyRequired extends Error {
  constructor() {
    super("passkey required");
    this.name = "PasskeyRequired";
  }
}

/**
 * Passkey step-up for big money moves, through Privy MFA. Small bids stay one tap; at STEP_UP_USD and above
 * the user confirms with their passkey (Face ID, Touch ID, Windows Hello or a security key) first.
 */
export function useStepUp() {
  const { hasPasskey, promptMfa, enrollPasskey } = usePatchedAuth();

  /** Resolve when `amount` (6-decimal USDC) is small or the passkey check passed; throw otherwise. */
  async function ensure(amount: bigint): Promise<void> {
    if (amount < STEP_UP) return;
    if (!hasPasskey) throw new PasskeyRequired();
    await promptMfa();
  }

  return { ensure, hasPasskey, setUpPasskey: enrollPasskey, threshold: STEP_UP };
}
