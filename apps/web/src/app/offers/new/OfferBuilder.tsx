"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { encodeFunctionData, erc20Abi } from "viem";
import { AtSign, BadgeCheck, CalendarClock, CircleDollarSign, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { toast } from "@/components/ui/Toast";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useTx } from "@/lib/market/useTx";
import { friendlyError } from "@/lib/market/useBid";
import { useStepUp } from "@/lib/market/stepUp";
import { USDC, publicClient } from "@/lib/config";
import { cn } from "@/lib/utils";

export interface OfferEvent {
  id: number;
  name: string;
  endsAt: number;
}

interface Preview {
  username: string;
  name: string;
  avatar: string | null;
  followers: number | null;
  onPatched: string | null;
}

const INPUT = "border-2 border-[var(--line)] rounded-xl px-3 py-2.5 bg-[var(--paper)] w-full";

/**
 * "Patch anyone on X": offer money to any X account for a spot at an event, even if they're not on Patched yet.
 * Privy makes their wallet now; the offer waits in its own policy-limited wallet until they sign in with X and list.
 */
export function OfferBuilder({ events }: { events: OfferEvent[] }) {
  const router = useRouter();
  const { authenticated, login, walletAddress } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const send = useTx();
  const stepUp = useStepUp();

  const [handle, setHandle] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [lookup, setLookup] = useState<"idle" | "loading" | "error">("idle");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [amount, setAmount] = useState(100);
  const [eventId, setEventId] = useState(events[0]?.id ?? 0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Look the handle up as the brand types (after a pause), so they see who they're offering to.
  useEffect(() => {
    const h = handle.trim().replace(/^@/, "");
    setPreview(null);
    setLookupError(null);
    if (!authenticated || !/^[A-Za-z0-9_]{1,15}$/.test(h)) return setLookup("idle");
    setLookup("loading");
    const t = setTimeout(() => {
      authedFetch(`/api/offers/lookup?handle=${encodeURIComponent(h)}`)
        .then(async (r) => {
          const j = (await r.json()) as Preview & { error?: string };
          if (!r.ok) throw new Error(j.error ?? "Couldn't look that account up.");
          setPreview(j);
          setLookup("idle");
        })
        .catch((e: Error) => {
          setLookupError(e.message);
          setLookup("error");
        });
    }, 500);
    return () => clearTimeout(t);
  }, [handle, authenticated, authedFetch]);

  const event = events.find((e) => e.id === eventId);

  async function start() {
    if (!authenticated || !walletAddress) return login();
    if (!preview) return toast("Enter an X handle first.");
    if (!event) return toast("Pick an event first.");
    const total = BigInt(amount) * 1_000_000n;
    try {
      setBusy("Checking your balance…");
      const balance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] });
      if (balance < total) throw new Error("insufficient USDC");
      await stepUp.ensure(total);
      setBusy(`Privy is setting up @${preview.username}'s wallet…`);
      const res = await authedFetch("/api/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: preview.username, amount, eventId, message }),
      });
      const json = (await res.json()) as { id?: string; walletAddress?: `0x${string}`; error?: string };
      if (!res.ok || !json.id || !json.walletAddress) throw new Error(json.error ?? "Couldn't make the offer.");
      setBusy(`Putting $${amount} in the offer…`);
      await send(USDC, encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [json.walletAddress, total] }));
      authedFetch(`/api/campaigns/${json.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ run: true }) }).catch(() => {});
      toast(`Offer ready. Share it so @${preview.username} sees it.`);
      router.push(`/offers/${json.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast(/offer|privy|x |handle|account|event|stake|yourself/i.test(msg) && !/insufficient/i.test(msg) ? msg : friendlyError(err).replace("The bid didn't", "The offer didn't"));
    } finally {
      setBusy(null);
    }
  }

  if (!events.length) {
    return (
      <div className="px-4 sm:px-6 py-16 text-center grid gap-3 justify-items-center">
        <h1 className="text-3xl font-extrabold">No events to make an offer for</h1>
        <p className="text-[var(--muted)]">An offer is for a spot at an event. Check back when the next one is listed.</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-7 grid gap-6 max-w-[760px]">
      <div>
        <span className="eyebrow">Patch anyone on X</span>
        <h1 className="text-4xl font-extrabold tracking-tight mt-1">Offer a spot to anyone on X</h1>
        <p className="text-[var(--muted)] mt-1.5 text-[15px]">
          They don&apos;t need to be on Patched. Privy makes their wallet now, and your offer waits in it until they sign in with X.
        </p>
      </div>

      <div className="rounded-3xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] p-6 grid gap-5">
        <label className="grid gap-1.5">
          <span className="field-label flex items-center gap-1.5"><AtSign size={14} /> Their X handle</span>
          <input className={INPUT} value={handle} placeholder="@dhruv" autoComplete="off" spellCheck={false}
            onChange={(e) => setHandle(e.target.value)} aria-describedby="x-preview" />
        </label>
        <div id="x-preview" aria-live="polite" className="-mt-2">
          {lookup === "idle" && !preview && <span className="text-sm text-[var(--muted)]">We look them up on X as you type, so you can check it&apos;s the right account.</span>}
          {lookup === "loading" && <span className="text-sm text-[var(--muted)] flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Looking up the account on X…</span>}
          {lookup === "error" && <span className="text-sm text-[var(--red)]">{lookupError}</span>}
          {preview && (
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--soft)] p-3">
              {preview.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.avatar} alt="" width={44} height={44} className="rounded-full flex-none" />
              ) : <span className="w-11 h-11 rounded-full bg-[var(--card)] flex-none" />}
              <span className="grid min-w-0">
                <b className="truncate">{preview.name}</b>
                <span className="text-sm text-[var(--muted)]">
                  @{preview.username}{preview.followers !== null && <> · {preview.followers.toLocaleString("en-US")} followers</>}
                </span>
              </span>
              <span className={cn("ml-auto text-xs font-semibold rounded-full px-2.5 py-1 flex items-center gap-1 flex-none", preview.onPatched ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[var(--accent-soft)] text-[var(--accent-text)]")}>
                {preview.onPatched ? <><BadgeCheck size={13} /> On Patched</> : <><UserPlus size={13} /> Not on Patched yet</>}
              </span>
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="grid gap-1.5">
            <span className="field-label flex items-center gap-1.5"><CircleDollarSign size={14} /> Your offer</span>
            <div className="amt">
              <span>$</span>
              <input inputMode="numeric" value={amount} onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)))} aria-label="Offer in dollars" />
              <span>USDC</span>
            </div>
          </label>
          <label className="grid gap-1.5">
            <span className="field-label flex items-center gap-1.5"><CalendarClock size={14} /> At</span>
            <select className={INPUT} value={eventId} onChange={(e) => setEventId(Number(e.target.value))}>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="field-label">What you&apos;d like (optional)</span>
          <textarea className={cn(INPUT, "min-h-[84px]")} maxLength={280} value={message} placeholder="Our logo on your hoodie at the event. We'll repost your photos."
            onChange={(e) => setMessage(e.target.value)} />
        </label>
      </div>

      <div className="rounded-3xl bg-[#0B0B0C] text-[#FAFAF7] p-5 sm:p-6 grid gap-3">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-[var(--accent)] grid place-items-center flex-none"><ShieldCheck size={19} className="text-[#0B0B0C]" /></span>
          <b className="text-[17px]">How Privy keeps it safe</b>
        </div>
        <ul className="grid gap-2 text-sm text-[#C9C7BF] list-none p-0 m-0">
          <li>Your ${amount} sits in its own Privy wallet. Its policy only bids for you, only on {preview ? `@${preview.username}'s` : "their"} spots at {event?.name ?? "the event"}, and never past ${amount} in total.</li>
          <li>If they&apos;re new, it can pay their small listing stake so they can list, to their wallet only.</li>
          <li>Whatever isn&apos;t spent comes back to you the day after the event.</li>
        </ul>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <button type="button" onClick={start} disabled={!!busy || (authenticated && (!preview || amount < 5))} className="btn-base btn-primary h-13 px-7 text-[17px] justify-center">
          {busy ? <><Loader2 size={17} className="animate-spin" /> {busy}</> : authenticated ? `Offer $${amount}${preview ? ` to @${preview.username}` : ""}` : "Sign in to make an offer"}
        </button>
        <span className="text-[13px] text-[var(--muted)] leading-snug">One transfer from your wallet.<br className="hidden sm:inline" /> Then share the offer on X.</span>
      </div>
    </div>
  );
}
