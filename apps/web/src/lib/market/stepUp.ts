"use client";

import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useIsDemoAccount } from "@/lib/demoAccount";
import { parseUsdc } from "@/lib/format";

/** Bids (or sweep totals, or auto-bid maximums) at or above this many dollars need a passkey check. */
export const STEP_UP_USD = Number(process.env.NEXT_PUBLIC_STEP_UP_USD ?? 1000);
const STEP_UP = parseUsdc(String(STEP_UP_USD));

/**
 * Thrown when a big amount needs a passkey but the user hasn't set one up yet. `demo`: this is the shared demo
 * account, which can't have a passkey (it would lock out everyone after), so big moves aren't available there.
 */
export class PasskeyRequired extends Error {
  constructor(readonly demo = false) {
    super("passkey required");
    this.name = "PasskeyRequired";
  }
}

/**
 * Passkey step-up for big money moves, through Privy MFA: at STEP_UP_USD and above the user needs a passkey (Face ID,
 * Touch ID, Windows Hello or a security key) and confirms with it first. Once a passkey is on, Privy itself also asks
 * for it before every embedded-wallet signature, small bids included, and remembers it for the verification window
 * set in the Privy dashboard.
 */
export function useStepUp() {
  const { hasPasskey, promptMfa, enrollPasskey } = usePatchedAuth();
  const demo = useIsDemoAccount();

  /** Resolve when `amount` (6-decimal USDC) is small or the passkey check passed; throw otherwise. */
  async function ensure(amount: bigint): Promise<void> {
    if (amount < STEP_UP) return;
    if (!hasPasskey) throw new PasskeyRequired(demo === true);
    await promptMfa();
  }

  return { ensure, hasPasskey, setUpPasskey: enrollPasskey, threshold: STEP_UP };
}
